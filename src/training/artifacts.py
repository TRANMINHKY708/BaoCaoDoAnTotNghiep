"""Trusted local artifact validation and an opt-in prediction response adapter."""

import hashlib
from importlib.metadata import version
import json
from pathlib import Path
from numbers import Real

import joblib
import numpy as np
import pandas as pd

from src.features.purchase_level_rules import CLASS_ORDER
from src.training.xgboost_policy import (
    MAIN_FEATURES, MODEL_VERSION, PARAMS, POLICY_VERSION, feature_schema, validate_main_features,
)


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def runtime_versions():
    names = ("numpy", "pandas", "scipy", "scikit-learn", "xgboost", "joblib",
             "threadpoolctl", "python-dateutil", "six", "tzdata", "cloudpickle", "narwhals")
    return {name: version(name) for name in names}


def load_bundle(directory):
    """Only load trusted local joblib; a checksum is not a signature/security sandbox."""
    directory = Path(directory)
    metadata = json.loads((directory / "model_metadata.json").read_text(encoding="utf-8"))
    validate_main_features(metadata["input_features"])
    if (metadata["model_version"] != MODEL_VERSION or metadata["feature_policy"] != POLICY_VERSION
            or metadata["class_order"] != list(CLASS_ORDER)
            or metadata["class_mapping"] != {str(i): name for i, name in enumerate(CLASS_ORDER)}
            or metadata["target_thresholds"] != {"low_inclusive": 10, "medium_inclusive": 15}
            or metadata["hyperparameters"] != PARAMS or metadata["feature_schema"] != feature_schema()
            or metadata["decision_rule"] != "argmax probability in class_order"):
        raise ValueError("Incompatible T4 model/target metadata")
    if metadata["runtime_versions"] != runtime_versions():
        raise ValueError("Dependency runtime differs from the pinned artifact environment")
    path = directory / "pipeline.joblib"
    if sha256(path) != metadata["artifact_sha256"]:
        raise ValueError("Artifact checksum mismatch")
    pipeline = joblib.load(path)
    validate_main_features(pipeline.named_steps["validity"].feature_names_in_)
    if list(pipeline.named_steps["classifier"].classes_) != [0, 1, 2]:
        raise ValueError("Artifact class order differs from metadata")
    actual = pipeline.named_steps["classifier"].get_params()
    if any(actual[key] != value for key, value in PARAMS.items()):
        raise ValueError("Artifact hyperparameters differ from the locked metadata/protocol")
    return pipeline, metadata


def predict_snapshot(customer, pipeline, metadata):
    """Offline adapter: same three prediction fields as the existing FastAPI service.

    Does not activate the new model or discard legacy request fields silently.
    Nulls are allowed for trained imputation; columns may not be absent.
    """
    validate_main_features(metadata["input_features"])
    if not isinstance(customer, dict):
        raise ValueError("Expected a customer object")
    missing, extra = set(MAIN_FEATURES) - set(customer), set(customer) - set(MAIN_FEATURES)
    if missing or extra:
        raise ValueError(f"Invalid feature schema: missing={sorted(missing)}, unexpected={sorted(extra)}")
    text = {"Gender", "Country", "City", "Signup_Quarter"}
    for name, value in customer.items():
        if value is None:
            continue
        if name in text:
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{name}: expected nonblank text or null")
        elif (isinstance(value, (bool, np.bool_)) or not isinstance(value, Real)
              or not np.isfinite(value)):
            raise ValueError(f"{name}: expected finite number or null")
    frame = pd.DataFrame([{name: customer[name] for name in MAIN_FEATURES}])
    probs = np.asarray(pipeline.predict_proba(frame)[0], dtype=float)
    if not np.isfinite(probs).all() or (probs < 0).any() or not np.isclose(probs.sum(), 1, atol=1e-6):
        raise ValueError("Invalid model probabilities")
    pred = int(probs.argmax())
    return {"predicted_class": pred, "purchase_level": CLASS_ORDER[pred],
            "probabilities": {name: float(probs[i]) for i, name in enumerate(CLASS_ORDER)}}
