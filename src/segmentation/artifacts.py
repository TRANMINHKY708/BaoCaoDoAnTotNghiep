"""Trusted-local T5 bundle loading and explicit prediction contract."""

import json
from numbers import Real
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from src.training.artifacts import runtime_versions, sha256
from src.segmentation.pipeline import (
    ATOL, CLIPPED, FEATURES, NAMES, PARAMS, PROTOCOL, SEGMENT_IDS, VERSION, engagement_scores,
)


def load_bundle(directory):
    directory = Path(directory)
    metadata = json.loads((directory / "model_metadata.json").read_text(encoding="utf-8"))
    if (metadata["model_version"] != VERSION or metadata["protocol"] != PROTOCOL
            or metadata["features"] != list(FEATURES) or metadata["hyperparameters"] != PARAMS
            or metadata["feature_schema"] != [{"name": n, "type": "number", "nullable": True} for n in FEATURES]
            or metadata["cluster_names"] != {str(i): NAMES[i] for i in range(3)}
            or metadata["segment_ids"] != {str(i): SEGMENT_IDS[i] for i in range(3)}):
        raise ValueError("Incompatible segmentation model/schema/mapping metadata")
    if metadata["runtime_versions"] != runtime_versions():
        raise ValueError("Segmentation dependency runtime differs from the pinned environment")
    path = directory / "pipeline.joblib"
    if sha256(path) != metadata["artifact_sha256"]:
        raise ValueError("Segmentation artifact checksum mismatch")
    # Trusted local pickle only. Checksums are not signatures or a sandbox.
    pipeline = joblib.load(path)
    if list(pipeline.named_steps["validity"].feature_names_in_) != list(FEATURES):
        raise ValueError("Artifact feature order differs from metadata")
    model = pipeline.named_steps["kmeans"]
    if any(model.get_params()[k] != v for k, v in PARAMS.items()):
        raise ValueError("Artifact KMeans parameters differ from the locked protocol")
    if (pipeline.named_steps["clipper"].bounds_ != metadata["preprocessing"]["clip_bounds"]
            or list(pipeline.named_steps["clipper"].columns) != list(CLIPPED)
            or int(pipeline.named_steps["scaler"].n_samples_seen_) != metadata["fit_rows"]):
        raise ValueError("Preprocessing fitted state differs from metadata")
    scores = engagement_scores(model.cluster_centers_)
    if not (np.diff(scores) >= 0).all():
        raise ValueError("Artifact canonical segment order is invalid")
    if not np.allclose(scores, metadata["canonical_mapping"]["engagement_scores"], atol=ATOL, rtol=0):
        raise ValueError("Canonical scores differ from metadata")
    return pipeline, metadata


def predict_snapshot(customer, pipeline, metadata):
    if not isinstance(customer, dict) or set(customer) != set(FEATURES):
        raise ValueError("Expected exactly ten segmentation keys; missing/extra keys forbidden")
    if all(v is None for v in customer.values()):
        raise ValueError("At least one observed feature is required; all-null snapshots cannot be interpreted")
    for name, value in customer.items():
        if value is not None and (not isinstance(value, Real) or isinstance(value, (bool, np.bool_))
                                  or not np.isfinite(value)):
            raise ValueError(f"{name}: expected finite numeric value or null")
    frame = pd.DataFrame([{n: customer[n] for n in FEATURES}])
    clean = pipeline.named_steps["validity"].transform(frame)
    missing = [n for n in FEATURES if clean[n].isna().any()]
    if len(missing) == len(FEATURES):
        raise ValueError("At least one valid observed feature is required")
    cluster = int(pipeline.predict(frame)[0])
    distance = float(pipeline.transform(frame)[0, cluster])
    clipped = [n for n in CLIPPED if clean[n].notna().any() and
               not metadata["preprocessing"]["clip_bounds"][n]["lower"] <= clean[n].iloc[0]
               <= metadata["preprocessing"]["clip_bounds"][n]["upper"]]
    outside = [n for n in FEATURES if clean[n].notna().any() and
               not metadata["training_ranges"][n]["min"] <= clean[n].iloc[0]
               <= metadata["training_ranges"][n]["max"]]
    return {
        "cluster": cluster, "segment_id": metadata["segment_ids"][str(cluster)],
        "segment_name": metadata["cluster_names"][str(cluster)], "model_version": metadata["model_version"],
        "distance_to_centroid": distance,
        "input_quality": {"imputed_features": missing, "clipped_features": clipped,
                          "outside_training_range": outside,
                          "distance_above_training_cluster_p99": distance > metadata["distance_p99"][str(cluster)]},
        "disclaimer": "Phân khúc mô tả snapshot; khoảng cách không phải xác suất, không dự báo tương lai hoặc nhân quả.",
    }
