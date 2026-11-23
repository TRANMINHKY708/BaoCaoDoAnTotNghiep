"""Application-only inference invariants. No training, rounding or label changes."""

import json
import math
from numbers import Integral, Real


CLASS_ORDER = ("Low", "Medium", "High")
PROBABILITY_TOLERANCE = 1e-6


class InvalidInferenceResult(RuntimeError):
    """Internal model-output failure; never expose payload/SQL in HTTP errors."""


def _fail():
    raise InvalidInferenceResult("Inference result violates persistence invariants")


def _integer(value):
    return isinstance(value, Integral) and not isinstance(value, bool)


def _finite(value):
    return isinstance(value, Real) and not isinstance(value, bool) and math.isfinite(value)


def validate_results(task, run_type, inputs, results):
    if task not in {"classification", "segmentation"} or run_type not in {"single", "batch", "csv", "scenario"}:
        _fail()
    if len(inputs) != len(results):
        raise ValueError("Inputs and results must have identical lengths")
    for features, result in zip(inputs, results):
        if not isinstance(features, dict) or not isinstance(result, dict):
            _fail()
        try:
            # Reject non-finite inputs rather than silently persisting NaN as null.
            json.dumps(features, allow_nan=False)
            if task == "classification":
                index = result["predicted_class"]
                if not _integer(index) or not 0 <= index <= 2 or result["purchase_level"] != CLASS_ORDER[index]:
                    _fail()
                probabilities = result["probabilities"]
                if not isinstance(probabilities, dict) or set(probabilities) != set(CLASS_ORDER):
                    _fail()
                values = list(probabilities.values())
                if any(not _finite(p) or not 0 <= p <= 1 for p in values):
                    _fail()
                if abs(math.fsum(values) - 1.0) > PROBABILITY_TOLERANCE:
                    _fail()
            else:
                if not _integer(result["cluster"]) or result["cluster"] < 0:
                    _fail()
                if not isinstance(result["segment_name"], str) or not 1 <= len(result["segment_name"]) <= 150:
                    _fail()
                distance = result["distance_to_centroid"]
                if not _finite(distance) or distance < 0:
                    _fail()
        except (KeyError, TypeError, ValueError, OverflowError):
            _fail()
