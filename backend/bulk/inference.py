"""F10 vectorized inference over pinned, fitted pipelines. No persistence or fitting."""

from datetime import UTC, datetime

import numpy as np
import pandas as pd
from pydantic import ValidationError

from backend.schemas.v1 import PurchaseResponse, SegmentResponse
from backend.services.persistence_validation import validate_results
from backend.services.versioned_models import INPUT_MODELS, MODEL_NAMES, failure

CLASS_ORDER = ("Low", "Medium", "High")


def infer_batch(task, version, customers, state):
    if not 1 <= len(customers) <= 1000:
        failure(422, "ANALYSIS_BATCH_LIMIT", "Mỗi lô cần từ 1 đến 1.000 snapshot.")
    schema = INPUT_MODELS.get((task, version))
    if schema is None:
        failure(404, "MODEL_VERSION_NOT_FOUND", "Không có phiên bản mô hình được chọn.")
    try:
        rows = [schema.model_validate(row).model_dump() for row in customers]
    except ValidationError:
        failure(
            422,
            "INVALID_MODEL_INPUT",
            "Snapshot không đúng schema mô hình; không tự bổ sung feature.",
        )
    if any("Churned" in row and row["Churned"] not in (0, 1) for row in rows):
        failure(
            422,
            "INVALID_MODEL_INPUT",
            "Churned phải bằng 0 hoặc 1 theo contract hiện tại.",
        )
    pipeline, metadata = state["pipeline"], state["metadata_object"]
    features = metadata.get("input_features", metadata.get("features"))
    if not features or set(features) != set(schema.model_fields) or pipeline is None:
        failure(
            503,
            "MODEL_UNAVAILABLE",
            "Pipeline hoặc metadata không tương thích; không đổi sang mô hình khác.",
        )
    if any(all(value is None for value in row.values()) for row in rows):
        failure(
            422,
            "INVALID_MODEL_INPUT",
            "Không phân tích snapshot thiếu toàn bộ feature.",
        )
    frame = pd.DataFrame(rows, columns=features)
    generated = datetime.now(UTC)
    common = {
        "task": task,
        "model_id": MODEL_NAMES[task],
        "model_version": version,
        "generated_at": generated,
    }
    results = []
    if task == "classification":
        probabilities = np.asarray(pipeline.predict_proba(frame), dtype=float)
        classes = (
            pipeline.named_steps["classifier"].classes_
            if state["default"]
            else np.arange(3)
        )
        labels = (
            np.asarray(pipeline.predict(frame), dtype=int)
            if state["default"]
            else probabilities.argmax(axis=1)
        )
        if (
            probabilities.shape != (len(rows), 3)
            or {int(c) for c in classes} != {0, 1, 2}
            or labels.shape != (len(rows),)
            or not np.isfinite(probabilities).all()
            or not np.isin(labels, [0, 1, 2]).all()
        ):
            failure(
                503,
                "INVALID_MODEL_OUTPUT",
                "Đầu ra mô hình không đúng cấu trúc đa lớp.",
            )
        for index, label in enumerate(labels):
            probs = {
                CLASS_ORDER[int(c)]: float(p)
                for c, p in zip(classes, probabilities[index])
            }
            results.append(
                PurchaseResponse(
                    **common,
                    predicted_class=int(label),
                    purchase_level=CLASS_ORDER[int(label)],
                    probabilities=probs,
                    target_thresholds={"low_inclusive": 10, "medium_inclusive": 15},
                ).model_dump(mode="json")
            )
    else:
        clean = (
            pipeline.named_steps["validity"].transform(frame)
            if not state["default"]
            else None
        )
        if clean is not None and clean.isna().all(axis=1).any():
            failure(
                422,
                "INVALID_MODEL_INPUT",
                "Snapshot không còn feature hợp lệ sau validation hiện có.",
            )
        labels = np.asarray(pipeline.predict(frame), dtype=int)
        distances = np.asarray(pipeline.transform(frame), dtype=float)
        if (
            distances.shape != (len(rows), 3)
            or labels.shape != (len(rows),)
            or not np.isfinite(distances).all()
            or not np.isin(labels, [0, 1, 2]).all()
        ):
            failure(
                503, "INVALID_MODEL_OUTPUT", "Đầu ra phân nhóm không đúng cấu trúc."
            )
        for index, label in enumerate(labels):
            label = int(label)
            quality = None
            if clean is not None:
                observed = clean.iloc[index]
                bounds = metadata["preprocessing"]["clip_bounds"]
                quality = {
                    "imputed_features": [n for n in features if pd.isna(observed[n])],
                    "clipped_features": [
                        n
                        for n in bounds
                        if pd.notna(observed[n])
                        and not bounds[n]["lower"] <= observed[n] <= bounds[n]["upper"]
                    ],
                    "outside_training_range": [
                        n
                        for n in features
                        if pd.notna(observed[n])
                        and not metadata["training_ranges"][n]["min"]
                        <= observed[n]
                        <= metadata["training_ranges"][n]["max"]
                    ],
                    "distance_above_training_cluster_p99": bool(
                        distances[index, label] > metadata["distance_p99"][str(label)]
                    ),
                }
            results.append(
                SegmentResponse(
                    **common,
                    cluster=label,
                    segment_name=metadata["cluster_names"][str(label)],
                    segment_id=f"legacy:1.0.0:cluster:{label}"
                    if state["default"]
                    else metadata["segment_ids"][str(label)],
                    distance_to_centroid=float(distances[index, label]),
                    input_quality=quality,
                ).model_dump(mode="json")
            )
    validate_results(task, "batch", rows, results)
    return rows, results
