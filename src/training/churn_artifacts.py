"""Churn model artifact: trusted local loading and a single-snapshot prediction adapter (K3)."""

import json
from numbers import Real
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from src.training.artifacts import runtime_versions, sha256
from src.training.churn_policy import (
    MAIN_FEATURES, MODEL_VERSION, PARAMS, POLICY_VERSION, TARGET, validate_features,
)

TEXT = {"Gender", "Country", "City", "Signup_Quarter"}
RISK_LEVELS = ("low", "medium", "high")


def risk_level(probability, thresholds):
    if probability >= thresholds["high_from"]:
        return "high"
    if probability >= thresholds["low_below"]:
        return "medium"
    return "low"


def load_bundle(directory):
    """Only load trusted local joblib; a checksum is not a signature or a security sandbox."""
    directory = Path(directory)
    metadata = json.loads((directory / "model_metadata.json").read_text(encoding="utf-8"))
    validate_features(metadata["input_features"])
    if (metadata["model_version"] != MODEL_VERSION or metadata["feature_policy"] != POLICY_VERSION
            or metadata["target"] != TARGET or tuple(metadata["input_features"]) != MAIN_FEATURES
            or metadata["hyperparameters"] != PARAMS or metadata["class_mapping"] != {"0": "active", "1": "churned"}):
        raise ValueError("Incompatible churn model metadata")
    thresholds = metadata["risk_thresholds"]
    if not 0 < thresholds["low_below"] < thresholds["high_from"] < 1 or not 0 < metadata["decision_threshold"] < 1:
        raise ValueError("Invalid churn thresholds in metadata")
    if metadata["runtime_versions"] != runtime_versions():
        raise ValueError("Dependency runtime differs from the pinned artifact environment")
    path = directory / "pipeline.joblib"
    if sha256(path) != metadata["artifact_sha256"]:
        raise ValueError("Artifact checksum mismatch")
    pipeline = joblib.load(path)
    validate_features(pipeline.named_steps["validity"].feature_names_in_)
    if list(pipeline.named_steps["classifier"].classes_) != [0, 1]:
        raise ValueError("Artifact class order differs from metadata")
    actual = pipeline.named_steps["classifier"].get_params()
    if any(actual[key] != value for key, value in PARAMS.items()):
        raise ValueError("Artifact hyperparameters differ from the locked policy")
    return pipeline, metadata


def validate_customer(customer, features=MAIN_FEATURES):
    if not isinstance(customer, dict):
        raise ValueError("Expected a customer object")
    missing, extra = set(features) - set(customer), set(customer) - set(features)
    if missing or extra:
        raise ValueError(f"Invalid feature schema: missing={sorted(missing)}, unexpected={sorted(extra)}")
    for name, value in customer.items():
        if value is None:
            continue
        if name in TEXT:
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{name}: expected nonblank text or null")
        elif isinstance(value, (bool, np.bool_)) or not isinstance(value, Real) or not np.isfinite(value):
            raise ValueError(f"{name}: expected finite number or null")
    return pd.DataFrame([{name: customer[name] for name in features}])


def predict_snapshot(customer, pipeline, metadata):
    """Probability of churn for one snapshot; nulls are imputed by the trained pipeline."""
    frame = validate_customer(customer, tuple(metadata["input_features"]))
    probability = float(pipeline.predict_proba(frame)[0, 1])
    if not np.isfinite(probability) or not 0 <= probability <= 1:
        raise ValueError("Invalid model probability")
    return {"churn_probability": probability, "risk_level": risk_level(probability, metadata["risk_thresholds"]),
            "predicted_churn": probability >= metadata["decision_threshold"]}
