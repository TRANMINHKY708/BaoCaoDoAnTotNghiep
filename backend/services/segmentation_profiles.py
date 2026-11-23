"""Descriptive profiles from the fixed cleaned research CSV only. No DB/fitting."""

import hashlib
import io
import threading
from datetime import UTC, datetime

import numpy as np
import pandas as pd
from fastapi import HTTPException
from threadpoolctl import threadpool_limits

from backend.schemas.segment_profiles import ResearchProfiles
from backend.services.model_service import PROJECT_ROOT
from backend.services.versioned_models import failure, versioned_models

DATA_PATH = PROJECT_ROOT / "data/processed/ecommerce_customer_behavior_cleaned.csv"
_CACHE = {}
_LOCK = threading.Lock()


def summarize(frame, pipeline, features):
    frame = frame.loc[:, features].copy()
    if frame.empty:
        frame = frame.astype(float)
    if not all(pd.api.types.is_numeric_dtype(frame[n]) for n in features):
        raise ValueError("Research features must be numeric")
    if np.isinf(frame.to_numpy(dtype=float)).any():
        raise ValueError("Infinite research values")
    # These values retain original units: validity only, no imputation/clip/scale.
    observed = (
        pipeline.named_steps["validity"].transform(frame)
        if len(frame) and "validity" in pipeline.named_steps
        else frame
    )
    if observed.isna().all(axis=1).any():
        raise ValueError("All-missing research record")
    n = len(frame)
    with threadpool_limits(limits=1):
        labels = (
            np.asarray(pipeline.predict(frame), dtype=int)
            if n
            else np.array([], dtype=int)
        )
    k = int(pipeline.named_steps["kmeans"].n_clusters)
    if labels.shape != (n,) or not set(labels).issubset(set(range(k))):
        raise ValueError("Invalid cluster labels")

    def stats(part):
        return {
            name: {
                "mean": float(part[name].mean()) if part[name].count() >= 2 else None,
                "observed_count": int(part[name].count()),
            }
            for name in features
        }

    overall = stats(observed)
    std = observed.std(ddof=0)
    clusters = []
    for cluster in range(k):
        part = observed.loc[labels == cluster]
        means = stats(part)
        notable = []
        if len(part) >= 2 and n >= 2:
            for name in features:
                a, b = means[name]["mean"], overall[name]["mean"]
                if (
                    a is not None
                    and b is not None
                    and pd.notna(std[name])
                    and std[name] > 0
                ):
                    score = float((a - b) / std[name])
                    if abs(score) > 1e-12:
                        notable.append(
                            {
                                "feature": name,
                                "cluster_mean": a,
                                "overall_mean": b,
                                "difference": a - b,
                                "standardized_difference": score,
                            }
                        )
        clusters.append(
            {
                "cluster_id": cluster,
                "record_count": len(part),
                "share_percent": len(part) * 100 / n if n else None,
                "status": "sufficient_for_descriptive_statistics"
                if len(part) >= 2
                else "insufficient_data",
                "features": means,
                "notable_features": sorted(
                    notable,
                    key=lambda x: abs(x["standardized_difference"]),
                    reverse=True,
                )[:3],
            }
        )
    return {
        "total_records": n,
        "records_used": n,
        "actual_cluster_count": len(set(labels)),
        "configured_cluster_count": k,
        "minimum_observed_per_mean": 2,
        "status": "sufficient_for_descriptive_statistics"
        if n >= 2
        else "insufficient_data",
        "feature_names": features,
        "overall": overall,
        "clusters": clusters,
    }


def research_profiles(version):
    state = versioned_models.get("segmentation", version)
    try:
        data = DATA_PATH.read_bytes()
        fingerprint = hashlib.sha256(data).hexdigest()
        key = (version, state["artifact_sha256"], fingerprint)
        with _LOCK:
            if key not in _CACHE:
                features = list(
                    state["metadata_object"].get(
                        "input_features", state["metadata_object"].get("features")
                    )
                )
                frame = pd.read_csv(io.BytesIO(data), usecols=features).loc[:, features]
                result = summarize(frame, state["pipeline"], features)
                result.update(
                    model_id="customer-segmentation-kmeans",
                    model_version=version,
                    artifact_sha256=state["artifact_sha256"],
                    dataset_sha256=fingerprint,
                    source="cleaned_research_dataset",
                    source_name=DATA_PATH.name,
                    computed_at=datetime.now(UTC).isoformat(),
                    count_unit="research_records_not_unique_application_customers",
                    statistics_space="original_units_validity_cleaned_before_imputation_clipping_scaling",
                    disclaimer="Chỉ mô tả dataset nghiên cứu, không phải PostgreSQL hoặc dữ liệu tải lên. ID cụm không phải thứ hạng. Trung bình bỏ qua giá trị thiếu/không hợp lệ; ít nhất 2 quan sát mỗi trung bình chỉ là điều kiện tính mô tả, không bảo đảm ý nghĩa thống kê. Không suy ra nhân quả hoặc tương lai; không gán đơn vị tiền/thời gian chưa xác minh.",
                )
                ResearchProfiles.model_validate(result)
                if len(_CACHE) >= 2:
                    _CACHE.pop(next(iter(_CACHE)))
                _CACHE[key] = result
            return _CACHE[key]
    except HTTPException:
        raise
    except Exception:  # noqa: BLE001 -- never expose data/paths/driver internals
        failure(
            503,
            "SEGMENT_PROFILES_UNAVAILABLE",
            "Research profiles unavailable; no substitute source was used",
        )
