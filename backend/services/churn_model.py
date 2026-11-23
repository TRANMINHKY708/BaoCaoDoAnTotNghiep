"""K5 churn model service: pinned artifact, loaded once, inference only (no fitting, no DB writes).

A failure here never stops the application: only the churn endpoints answer 503.
"""

import json
import math
from datetime import UTC, datetime

import numpy as np

from backend.services.model_service import PROJECT_ROOT
from backend.services.versioned_models import failure
from src.training.artifacts import sha256
from src.training.churn_artifacts import (
    load_bundle,
    predict_snapshot,
    validate_customer,
)

PIN_PATH = PROJECT_ROOT / "backend/churn_model_pin.json"
UNAVAILABLE = "CHURN_MODEL_UNAVAILABLE"
LIMITATIONS = [
    "Snapshot churn status from a public dataset without a churn window; not a time-to-churn forecast.",
    "Lifetime_Value, Total_Purchases and Days_Since_Last_Purchase are excluded; the recording time of service calls and returns is not verified.",
    "Holdout scored once (K3); the data shows signs of being synthetic, so results illustrate the method.",
    "SHAP factors are associations learned by the model, not causal effects.",
]
EXPLANATION_DISCLAIMER = (
    "Đóng góp của từng thuộc tính vào log-odds rời bỏ của khách này (cột one-hot cộng về thuộc tính gốc). "
    "Giá trị dương làm nguy cơ tăng, âm làm nguy cơ giảm; là liên hệ thống kê, không phải quan hệ nhân quả."
)


def _checked_path(relative, expected):
    path = (PROJECT_ROOT / relative).resolve()
    if not path.is_relative_to(PROJECT_ROOT.resolve()):
        raise ValueError("Pinned churn file outside project")
    if sha256(path) != expected:
        raise ValueError("Pinned churn file checksum mismatch")
    return path


class ChurnModel:
    def __init__(self, pin_path=PIN_PATH):
        self.pin_path = pin_path
        self.reset()

    def reset(self):
        self.pin = self.metadata = self.evaluation = self.pipeline = None
        self.error = UNAVAILABLE

    def load(self):
        """Once per lifespan. Errors are recorded without paths or tracebacks."""
        self.reset()
        try:
            pin = json.loads(self.pin_path.read_text(encoding="utf-8"))
            metadata_path = _checked_path(pin["metadata"], pin["metadata_sha256"])
            evaluation_path = _checked_path(pin["evaluation"], pin["evaluation_sha256"])
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            evaluation = json.loads(evaluation_path.read_text(encoding="utf-8"))
            if (metadata["artifact_sha256"] != pin["artifact_sha256"]
                    or evaluation["artifact_sha256"] != pin["artifact_sha256"]
                    or metadata["model_version"] != pin["model_version"]):
                raise ValueError("Pin, metadata and evaluation disagree")
            # Committed, consistent descriptors: /churn/model can report them even without the binary.
            self.pin, self.metadata, self.evaluation = pin, metadata, evaluation
            _checked_path(pin["artifact"], pin["artifact_sha256"])
            pipeline, loaded = load_bundle(metadata_path.parent)
            if loaded != self.metadata:
                raise ValueError("Loaded metadata differs from the pinned metadata")
            self.pipeline = pipeline
            self.error = None
        except Exception:  # noqa: BLE001 -- isolate churn failures from the rest of the API
            self.pipeline = None
            self.error = UNAVAILABLE
        return self

    @property
    def available(self):
        return self.pipeline is not None

    def require(self):
        if not self.available:
            failure(503, UNAVAILABLE, "Churn model is unavailable; no fallback prediction was made")

    def info(self):
        if self.metadata is None or self.evaluation is None:
            self.require()
        primary = self.evaluation["primary"]["metrics_at_decision_threshold"]
        return {
            "model_version": self.metadata["model_version"],
            "feature_policy": self.metadata["feature_policy"],
            "available": self.available,
            "unavailable_code": self.error,
            "artifact_sha256": self.pin["artifact_sha256"],
            "feature_count": len(self.metadata["input_features"]),
            "features": self.metadata["input_features"],
            "excluded_features": self.metadata["excluded_features"],
            "decision_threshold": self.metadata["decision_threshold"],
            "risk_thresholds": self.metadata["risk_thresholds"],
            "holdout": {
                "rows": self.evaluation["holdout_rows"],
                "churn_rate": self.evaluation["holdout_churn_rate"],
                "roc_auc": primary["roc_auc"],
                "pr_auc": primary["pr_auc"],
                "f1": primary["f1"],
                "precision": primary["precision"],
                "recall": primary["recall"],
                "brier": primary["brier"],
                "ece": primary["ece_10_bins"],
                "scored_at": self.evaluation["scored_at_utc"],
            },
            "limitations": LIMITATIONS,
        }

    def predict(self, customer, *, explain=False):
        self.require()
        if all(value is None for value in customer.values()):
            failure(422, "INVALID_MODEL_INPUT", "At least one observed feature is required")
        try:
            result = predict_snapshot(customer, self.pipeline, self.metadata)
        except (ValueError, TypeError):
            failure(422, "INVALID_MODEL_INPUT", "Input violates the churn model schema or validity policy")
        response = {
            "model_version": self.metadata["model_version"],
            "generated_at": datetime.now(UTC),
            **result,
            "decision_threshold": self.metadata["decision_threshold"],
            "risk_thresholds": self.metadata["risk_thresholds"],
        }
        if explain:
            response["explanation"] = self.explain(customer, result["churn_probability"])
        return response

    def explain(self, customer, probability):
        """Exact TreeSHAP in log-odds, one-hot columns summed back to the source feature."""
        try:
            from xgboost import DMatrix

            features = list(self.metadata["input_features"])
            frame = validate_customer(customer, tuple(features))
            preprocess = self.pipeline[:-1]
            transformed = preprocess.transform(frame)
            names = list(preprocess.get_feature_names_out())
            booster = self.pipeline.named_steps["classifier"].get_booster()
            matrix = DMatrix(transformed, feature_names=booster.feature_names)
            contributions = np.asarray(booster.predict(matrix, pred_contribs=True, strict_shape=True), dtype=float)
            margin = float(np.asarray(booster.predict(matrix, output_margin=True, strict_shape=True), dtype=float).ravel()[0])
            if contributions.shape != (1, 1, len(names) + 1) or not np.isfinite(contributions).all():
                raise ValueError("Unexpected SHAP shape")
            row = contributions[0, 0]
            if not math.isclose(row.sum(), margin, abs_tol=1e-4):
                raise ValueError("SHAP additivity failure")
            if not math.isclose(1 / (1 + math.exp(-margin)), probability, abs_tol=1e-5):
                raise ValueError("Inference/explanation parity failure")
            grouped = dict.fromkeys(features, 0.0)
            for name, value in zip(names, row[:-1]):
                bare = name.split("__", 1)[1]
                owner = next(f for f in features if bare == f or bare.startswith(f + "_"))
                grouped[owner] += float(value)
            factors = sorted(
                ({"feature": f, "value": customer[f], "shap_value": v,
                  "direction": "increases_risk" if v > 0 else "decreases_risk"} for f, v in grouped.items()),
                key=lambda item: -abs(item["shap_value"]),
            )
            return {
                "base_value": float(row[-1]),
                "model_output": margin,
                "additivity_error": float(row.sum() - margin),
                "factors": factors,
                "disclaimer": EXPLANATION_DISCLAIMER,
            }
        except Exception:  # noqa: BLE001 -- incompatible artifacts must fail safely
            failure(503, "EXPLANATION_UNAVAILABLE",
                    "Churn explanation unavailable or incompatible; no fallback explanation was generated")


churn_model = ChurnModel()
