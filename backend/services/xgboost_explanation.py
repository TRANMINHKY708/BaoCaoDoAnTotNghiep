"""Local exact TreeSHAP via XGBoost's native implementation; no fitting/storage."""

import numpy as np
import pandas as pd
from fastapi import HTTPException
from xgboost import DMatrix

from backend.services.prediction_service import prepare_customer
from backend.services.versioned_models import failure


def explain_prediction(customer, state, prediction):
    try:
        pipeline, metadata = state["pipeline"], state["metadata_object"]
        features = metadata.get("input_features", metadata.get("features"))
        frame = (
            prepare_customer(customer, pipeline, features)
            if state["default"]
            else pd.DataFrame([{n: customer[n] for n in features}])
        )
        transformed = pipeline[:-1].transform(frame)
        names = list(pipeline[:-1].get_feature_names_out())
        classifier = pipeline.named_steps["classifier"]
        booster = classifier.get_booster()
        classes = np.asarray(classifier.classes_)
        if not np.array_equal(classes, [0, 1, 2]) or len(names) != transformed.shape[1]:
            raise ValueError("Incompatible feature/class contract")
        matrix = DMatrix(transformed, feature_names=booster.feature_names)
        options = {}
        if getattr(classifier, "best_iteration", None) is not None:
            options["iteration_range"] = (0, classifier.best_iteration + 1)
        contributions = np.asarray(
            booster.predict(
                matrix,
                pred_contribs=True,
                approx_contribs=False,
                strict_shape=True,
                **options,
            ),
            dtype=float,
        )
        margins = np.asarray(
            booster.predict(matrix, output_margin=True, strict_shape=True, **options),
            dtype=float,
        )
        if contributions.shape != (
            1,
            len(classes),
            len(names) + 1,
        ) or margins.shape != (1, len(classes)):
            raise ValueError("Unexpected multiclass SHAP shape")
        if not np.isfinite(contributions).all() or not np.isfinite(margins).all():
            raise ValueError("Nonfinite explanation")
        if not np.allclose(contributions.sum(axis=2), margins, rtol=1e-5, atol=1e-5):
            raise ValueError("SHAP additivity failure")
        probabilities = np.exp(margins[0] - margins[0].max())
        probabilities /= probabilities.sum()
        expected = np.array(
            [prediction["probabilities"][name] for name in ["Low", "Medium", "High"]]
        )
        if not np.allclose(probabilities, expected, atol=1e-6, rtol=1e-6):
            raise ValueError("Inference/explanation parity failure")
        selected = int(prediction["predicted_class"])
        if int(classes[probabilities.argmax()]) != selected:
            raise ValueError("Predicted class mismatch")
        values = (
            transformed.toarray()[0]
            if hasattr(transformed, "toarray")
            else np.asarray(transformed)[0]
        )
        row = contributions[0, selected]
        return {
            "method": "xgboost_native_exact_treeshap",
            "explanation_scope": "local",
            "model_id": prediction["model_id"],
            "model_version": prediction["model_version"],
            "artifact_sha256": state["artifact_sha256"],
            "input_source": "request_payload",
            "input_values": customer,
            "feature_space": "preprocessed",
            "predicted_class": selected,
            "purchase_level": prediction["purchase_level"],
            "output_space": "raw_margin",
            "base_value": float(row[-1]),
            "model_output": float(margins[0, selected]),
            "additivity_error": float(row.sum() - margins[0, selected]),
            "features": [
                {
                    "feature_name": str(n),
                    "feature_value": float(v) if np.isfinite(v) else None,
                    "shap_value": float(w),
                }
                for n, v, w in zip(names, values, row[:-1])
            ],
            "disclaimer": "Đóng góp cho một dự đoán trong không gian raw margin, không phải phần trăm hay tác động nhân quả. Đặc trưng sau preprocessing; khác feature importance toàn cục.",
        }
    except HTTPException:
        raise
    except Exception:  # noqa: BLE001 -- incompatible artifacts must fail safely
        failure(
            503,
            "EXPLANATION_UNAVAILABLE",
            "Model explanation unavailable or incompatible; no fallback explanation was generated",
        )
