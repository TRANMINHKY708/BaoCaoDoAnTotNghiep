"""Reusable quantile-based clipping transformer."""

import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin


class QuantileClipper(BaseEstimator, TransformerMixin):
    """Clip selected DataFrame columns to quantiles learned during fitting."""

    def __init__(
        self,
        columns,
        lower_quantile=0.01,
        upper_quantile=0.99,
    ):
        self.columns = columns
        self.lower_quantile = lower_quantile
        self.upper_quantile = upper_quantile

    def fit(self, X, y=None):
        X = pd.DataFrame(X).copy()
        self.feature_names_in_ = list(X.columns)
        self.bounds_ = {}

        for col in self.columns:
            self.bounds_[col] = {
                "lower": float(X[col].quantile(self.lower_quantile)),
                "upper": float(X[col].quantile(self.upper_quantile)),
            }

        return self

    def transform(self, X):
        X = pd.DataFrame(X).copy()
        X = X[self.feature_names_in_]

        for col, bounds in self.bounds_.items():
            X[col] = X[col].clip(
                lower=bounds["lower"],
                upper=bounds["upper"],
            )

        return X
