"""Research remediation: fixed validity rules, fold-local learned transforms.

This module does not modify historical datasets or the currently served model.
"""

from numbers import Real

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin, clone
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.utils.validation import check_is_fitted

from src.data.dataset_contract import CLASSIFICATION_FEATURES, FIELDS
from src.features.leakage_guard import LeakageError, validate_classification_features


_SPECS = {field.name: field for field in FIELDS}
_RATES = {
    "Cart_Abandonment_Rate", "Discount_Usage_Rate", "Returns_Rate", "Email_Open_Rate"
}


class ResearchValidityCleaner(BaseEstimator, TransformerMixin):
    """Convert legacy invalid Age/rates to NaN; learn no aggregate values."""

    def __init__(self, features=CLASSIFICATION_FEATURES, post_outcome_features=()):
        self.features = features
        self.post_outcome_features = post_outcome_features

    def _clean(self, X):
        features = validate_classification_features(
            self.features, post_outcome_features=self.post_outcome_features
        )
        if not isinstance(X, pd.DataFrame) or X.empty or not X.columns.is_unique:
            raise LeakageError("Expected a nonempty DataFrame with unique feature columns")
        if set(X.columns) != set(features):
            raise LeakageError("Input feature columns differ from the frozen allowlist")
        frame = X.loc[:, list(features)].copy()
        for name in features:
            spec = _SPECS[name]
            series = frame[name]
            if spec.kind == "text":
                if not series.dropna().map(lambda value: isinstance(value, str)).all():
                    raise ValueError(f"{name}: expected text or missing values")
                series = series.astype(object)
                blank = series.map(lambda value: isinstance(value, str) and not value.strip())
                frame[name] = series.where(series.notna() & ~blank, np.nan)
                if spec.categories and not frame[name].dropna().isin(spec.categories).all():
                    raise ValueError(f"{name}: invalid category")
                continue
            if not series.dropna().map(
                lambda value: isinstance(value, Real) and not isinstance(value, (bool, np.bool_))
            ).all():
                raise ValueError(f"{name}: expected numeric or missing values")
            values = pd.to_numeric(series).astype(float)
            if np.isinf(values.to_numpy()).any():
                raise ValueError(f"{name}: infinite values are invalid")
            if name == "Age":
                values = values.mask((values < 18) | (values > 100))
            elif name in _RATES:
                values = values.mask((values < 0) | (values > 100))
            elif (values < 0).any():
                raise ValueError(f"{name}: negative values are invalid")
            if spec.kind == "binary" and not values.dropna().isin([0, 1]).all():
                raise ValueError(f"{name}: expected 0/1")
            frame[name] = values
        return frame

    def fit(self, X, y=None):
        frame = self._clean(X)
        if frame.isna().all().any():
            raise ValueError("A training feature is entirely missing; no imputation statistic")
        self.feature_names_in_ = np.asarray(frame.columns, dtype=object)
        self.n_features_in_ = len(frame.columns)
        return self

    def transform(self, X):
        check_is_fitted(self, "feature_names_in_")
        return self._clean(X)

    def get_feature_names_out(self, input_features=None):
        check_is_fitted(self, "feature_names_in_")
        return self.feature_names_in_.copy()


def make_train_only_preprocessor(features=CLASSIFICATION_FEATURES, *, post_outcome_features=()):
    features = validate_classification_features(
        features, post_outcome_features=post_outcome_features
    )
    numeric = [name for name in features if _SPECS[name].kind != "text"]
    categorical = [name for name in features if _SPECS[name].kind == "text"]
    transformer = ColumnTransformer([
        ("numeric", Pipeline([
            ("imputer", SimpleImputer(strategy="median", keep_empty_features=True)),
            ("scaler", StandardScaler()),
        ]), numeric),
        ("categorical", Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent", keep_empty_features=True)),
            ("encoder", OneHotEncoder(handle_unknown="ignore")),
        ]), categorical),
    ])
    return Pipeline([
        ("validity", ResearchValidityCleaner(features, post_outcome_features)),
        ("preprocessor", transformer),
    ])


def make_train_only_classifier(estimator, features=CLASSIFICATION_FEATURES, *, post_outcome_features=()):
    preprocessor = make_train_only_preprocessor(
        features, post_outcome_features=post_outcome_features
    )
    return Pipeline([*preprocessor.steps, ("classifier", clone(estimator))])
