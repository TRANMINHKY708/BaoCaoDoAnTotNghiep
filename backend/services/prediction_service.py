"""Input validation and inference services for trained AI pipelines."""

import math
from numbers import Real

import numpy as np
import pandas as pd
from fastapi import HTTPException

from backend.services.model_service import model_service


CLASS_NAMES = {
    0: "Low",
    1: "Medium",
    2: "High",
}


def _pipeline_feature_types(pipeline, features):
    """Read numeric/categorical columns from a fitted ColumnTransformer."""
    numeric_features = set(features)
    categorical_features = set()

    preprocessor = pipeline.named_steps.get("preprocessor")
    if preprocessor is None:
        return numeric_features, categorical_features

    numeric_features = set()
    for name, _transformer, columns in preprocessor.transformers_:
        if name in {"numeric", "num"}:
            numeric_features.update(columns)
        elif name in {"categorical", "cat"}:
            categorical_features.update(columns)

    classified = numeric_features | categorical_features
    numeric_features.update(set(features) - classified)
    return numeric_features, categorical_features


def prepare_customer(customer: dict, pipeline, features: list):
    """Validate one customer and create a correctly ordered DataFrame."""
    missing = [
        feature
        for feature in features
        if feature not in customer
    ]
    extra = [
        feature
        for feature in customer
        if feature not in features
    ]

    if missing or extra:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Invalid customer features",
                "missing_features": missing,
                "unexpected_features": extra,
            },
        )

    numeric_features, categorical_features = (
        _pipeline_feature_types(pipeline, features)
    )
    invalid_numeric = []
    invalid_categorical = []

    for feature in numeric_features:
        value = customer[feature]
        if (
            isinstance(value, bool)
            or not isinstance(value, Real)
            or not math.isfinite(float(value))
        ):
            invalid_numeric.append(feature)

    for feature in categorical_features:
        value = customer[feature]
        if not isinstance(value, str) or not value.strip():
            invalid_categorical.append(feature)

    if invalid_numeric or invalid_categorical:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Invalid customer feature values",
                "invalid_numeric_features": invalid_numeric,
                "invalid_categorical_features": (
                    invalid_categorical
                ),
            },
        )

    frame = pd.DataFrame(
        [[customer[feature] for feature in features]],
        columns=features,
    )

    for feature in numeric_features:
        frame[feature] = pd.to_numeric(frame[feature])

    if not np.isfinite(
        frame[list(numeric_features)].to_numpy(dtype=float)
    ).all():
        raise HTTPException(
            status_code=422,
            detail="Numeric features must be finite",
        )

    return frame


def predict_purchase_level(customer: dict):
    pipeline = model_service.xgboost
    metadata = model_service.xgboost_metadata

    if pipeline is None or metadata is None:
        raise HTTPException(
            status_code=503,
            detail="XGBoost model is unavailable",
        )

    features = metadata.get(
        "input_features",
        metadata.get("features"),
    )
    if not features:
        raise HTTPException(
            status_code=500,
            detail="XGBoost feature metadata is unavailable",
        )

    sample = prepare_customer(
        customer,
        pipeline,
        features,
    )
    predicted_class = int(pipeline.predict(sample)[0])
    predicted_probabilities = pipeline.predict_proba(sample)[0]
    classifier = pipeline.named_steps["classifier"]

    class_mapping = metadata.get("class_mapping", {})
    probabilities = {
        class_mapping.get(str(int(class_id)), CLASS_NAMES[int(class_id)]): (
            float(probability)
        )
        for class_id, probability in zip(
            classifier.classes_,
            predicted_probabilities,
        )
    }
    purchase_level = class_mapping.get(
        str(predicted_class),
        CLASS_NAMES[predicted_class],
    )

    return {
        "predicted_class": predicted_class,
        "purchase_level": purchase_level,
        "probabilities": probabilities,
    }


def predict_segment(customer: dict):
    pipeline = model_service.kmeans
    metadata = model_service.kmeans_metadata

    if pipeline is None or metadata is None:
        raise HTTPException(
            status_code=503,
            detail="K-Means model is unavailable",
        )

    features = metadata.get("features")
    if not features:
        raise HTTPException(
            status_code=500,
            detail="K-Means feature metadata is unavailable",
        )

    sample = prepare_customer(
        customer,
        pipeline,
        features,
    )
    cluster = int(pipeline.predict(sample)[0])
    distances = pipeline.transform(sample)[0]
    cluster_names = metadata["cluster_names"]

    return {
        "cluster": cluster,
        "segment_name": cluster_names[str(cluster)],
        "distance_to_centroid": float(distances[cluster]),
    }


def prepare_batch(customers: list, pipeline, features: list):
    """Validate every customer and return one ordered DataFrame."""
    frames = []
    errors = []

    for index, customer in enumerate(customers):
        try:
            frame = prepare_customer(
                customer=customer,
                pipeline=pipeline,
                features=features,
            )
            frames.append(frame)
        except HTTPException as exc:
            errors.append({
                "index": index,
                "detail": exc.detail,
            })

    if errors:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Invalid customers in batch",
                "errors": errors,
            },
        )

    return pd.concat(frames, ignore_index=True)


def predict_purchase_level_batch(customers: list):
    pipeline = model_service.xgboost
    metadata = model_service.xgboost_metadata

    if pipeline is None or metadata is None:
        raise HTTPException(
            status_code=503,
            detail="XGBoost model is unavailable",
        )

    features = metadata.get(
        "input_features",
        metadata.get("features"),
    )
    if not features:
        raise HTTPException(
            status_code=500,
            detail="XGBoost feature metadata is unavailable",
        )

    batch = prepare_batch(customers, pipeline, features)
    predicted_classes = pipeline.predict(batch)
    predicted_probabilities = pipeline.predict_proba(batch)
    classifier = pipeline.named_steps["classifier"]
    class_mapping = metadata.get("class_mapping", {})
    class_ids = [int(value) for value in classifier.classes_]

    results = []
    for index, (predicted_class, probabilities) in enumerate(
        zip(predicted_classes, predicted_probabilities)
    ):
        predicted_class = int(predicted_class)
        probability_map = {
            class_mapping.get(
                str(class_id),
                CLASS_NAMES[class_id],
            ): float(probability)
            for class_id, probability in zip(
                class_ids,
                probabilities,
            )
        }
        results.append({
            "index": index,
            "predicted_class": predicted_class,
            "purchase_level": class_mapping.get(
                str(predicted_class),
                CLASS_NAMES[predicted_class],
            ),
            "probabilities": probability_map,
        })

    return {
        "total": len(results),
        "results": results,
    }


def predict_segment_batch(customers: list):
    pipeline = model_service.kmeans
    metadata = model_service.kmeans_metadata

    if pipeline is None or metadata is None:
        raise HTTPException(
            status_code=503,
            detail="K-Means model is unavailable",
        )

    features = metadata.get("features")
    if not features:
        raise HTTPException(
            status_code=500,
            detail="K-Means feature metadata is unavailable",
        )

    batch = prepare_batch(customers, pipeline, features)
    clusters = pipeline.predict(batch)
    distances = pipeline.transform(batch)
    cluster_names = metadata["cluster_names"]

    results = []
    for index, (cluster, customer_distances) in enumerate(
        zip(clusters, distances)
    ):
        cluster = int(cluster)
        results.append({
            "index": index,
            "cluster": cluster,
            "segment_name": cluster_names[str(cluster)],
            "distance_to_centroid": float(
                customer_distances[cluster]
            ),
        })

    return {
        "total": len(results),
        "results": results,
    }
