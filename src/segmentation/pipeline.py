"""Strict numeric snapshot pipeline and permutation-independent cluster naming."""

from numbers import Real

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.cluster import KMeans
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.utils.validation import check_is_fitted

from src.features.quantile_clipper import QuantileClipper


FEATURES = (
    "Login_Frequency", "Session_Duration_Avg", "Pages_Per_Session",
    "Cart_Abandonment_Rate", "Wishlist_Items", "Total_Purchases",
    "Average_Order_Value", "Days_Since_Last_Purchase", "Discount_Usage_Rate",
    "Mobile_App_Usage",
)
CLIPPED = ("Total_Purchases", "Average_Order_Value")
VERSION = "2.0.0-snapshot-k3"
PROTOCOL = "snapshot-k3-train-only-v1"
PARAMS = dict(n_clusters=3, init="k-means++", n_init=10, random_state=42,
              max_iter=300, tol=1e-4, algorithm="lloyd")
NAMES = ("Tương tác thấp", "Tương tác trung bình", "Tương tác cao")
SEGMENT_IDS = ("engagement_low", "engagement_medium", "engagement_high")
ENGAGEMENT = ("Login_Frequency", "Session_Duration_Avg", "Pages_Per_Session",
              "Wishlist_Items", "Mobile_App_Usage")
ATOL = 1e-7
METRIC_ATOL = 1e-9


class ClusterValidityCleaner(BaseEstimator, TransformerMixin):
    """No learned statistics, schema is fixed independently of target labels."""

    def fit(self, X, y=None):
        clean = self._clean(X)
        if clean.isna().all().any():
            raise ValueError("A training feature is entirely missing")
        self.feature_names_in_ = np.array(FEATURES, dtype=object)
        self.n_features_in_ = len(FEATURES)
        return self

    def _clean(self, X):
        if not isinstance(X, pd.DataFrame) or X.empty or not X.columns.is_unique:
            raise ValueError("Expected a nonempty DataFrame with unique columns")
        if set(X.columns) != set(FEATURES):
            raise ValueError("Expected exactly the ten frozen segmentation features; missing/extra columns forbidden")
        frame = X.loc[:, list(FEATURES)].copy()
        for name in FEATURES:
            series = frame[name]
            if not series.dropna().map(
                lambda v: isinstance(v, Real) and not isinstance(v, (bool, np.bool_))
            ).all():
                raise ValueError(f"{name}: expected numeric or null, not bool/string")
            values = pd.to_numeric(series).astype(float)
            if np.isinf(values).any():
                raise ValueError(f"{name}: infinite values forbidden")
            if name in {"Cart_Abandonment_Rate", "Discount_Usage_Rate"}:
                values = values.mask((values < 0) | (values > 100))
            elif (values < 0).any():
                raise ValueError(f"{name}: negative values forbidden")
            frame[name] = values
        return frame

    def transform(self, X):
        check_is_fitted(self, "feature_names_in_")
        return self._clean(X)

    def get_feature_names_out(self, input_features=None):
        check_is_fitted(self, "feature_names_in_")
        return self.feature_names_in_.copy()


def make_pipeline(*, k=3, seed=42):
    return Pipeline([
        ("validity", ClusterValidityCleaner()),
        ("imputer", SimpleImputer(strategy="median", keep_empty_features=True).set_output(transform="pandas")),
        ("clipper", QuantileClipper(columns=CLIPPED, lower_quantile=.01, upper_quantile=.99)),
        ("scaler", StandardScaler()),
        ("kmeans", KMeans(**{**PARAMS, "n_clusters": k, "random_state": seed})),
    ])


def engagement_scores(centers):
    centers = np.asarray(centers)
    return (centers[:, [FEATURES.index(n) for n in ENGAGEMENT]].sum(axis=1)
            - centers[:, FEATURES.index("Cart_Abandonment_Rate")]) / 6


def canonicalize(pipeline):
    """Reorder centers/labels in this new artifact only; preserve distances/inertia."""
    model = pipeline.named_steps["kmeans"]
    if model.n_clusters != 3:
        raise ValueError("Canonical three-segment mapping requires K=3")
    scores = engagement_scores(model.cluster_centers_)
    # Centroid tuple is a deterministic tie-break, not an arbitrary random ID.
    order = np.array(sorted(range(3), key=lambda i: (scores[i], tuple(model.cluster_centers_[i]))))
    inverse = np.argsort(order)
    model.cluster_centers_ = model.cluster_centers_[order].copy()
    model.labels_ = inverse[model.labels_]
    return {"raw_to_canonical": {str(i): int(inverse[i]) for i in range(3)},
            "engagement_scores": scores[order].tolist(),
            "minimum_adjacent_score_gap": float(np.diff(scores[order]).min()),
            "rule": "ascending mean of five positive engagement centroid-z minus cart-abandonment centroid-z"}


def audit_fitted_state(pipeline, X_fit):
    clean = pipeline.named_steps["validity"].transform(X_fit)
    medians = clean.median()
    np.testing.assert_allclose(pipeline.named_steps["imputer"].statistics_, medians, atol=1e-12, rtol=0)
    imputed = clean.fillna(medians)
    clipper = pipeline.named_steps["clipper"]
    for name in CLIPPED:
        for key, q in (("lower", .01), ("upper", .99)):
            np.testing.assert_allclose(clipper.bounds_[name][key], imputed[name].quantile(q), atol=1e-12, rtol=0)
    processed = clipper.transform(imputed)
    scaler = pipeline.named_steps["scaler"]
    assert np.all(np.asarray(scaler.n_samples_seen_) == len(X_fit)), "Scaler fitted on unexpected rows"
    np.testing.assert_allclose(scaler.mean_, processed.mean(), atol=1e-10, rtol=0)
    return {"status": "PASSED", "fit_rows": len(X_fit), "medians": medians.to_dict(),
            "clip_bounds": clipper.bounds_, "scaler_samples_seen": int(scaler.n_samples_seen_)}
