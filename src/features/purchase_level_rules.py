"""Side-effect-free target definition shared by research dataset builders."""

from math import isfinite
from numbers import Real


LOW_THRESHOLD = 10
HIGH_THRESHOLD = 15
CLASS_ORDER = ("Low", "Medium", "High")


def create_purchase_level(value: Real) -> str:
    """Label a finite nonnegative purchase value without rounding."""
    if isinstance(value, bool) or not isinstance(value, Real):
        raise ValueError("Total_Purchases must be a finite nonnegative number")
    if not isfinite(float(value)) or value < 0:
        raise ValueError("Total_Purchases must be a finite nonnegative number")
    if value <= LOW_THRESHOLD:
        return "Low"
    if value <= HIGH_THRESHOLD:
        return "Medium"
    return "High"
