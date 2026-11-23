"""Churn-risk model policy (K1): feature sets fixed on the training partition before any holdout use.

Target: ``Churned`` (the dataset's original label). The source does not state the churn window, so
this is a snapshot classifier, not a time-to-churn forecast. See docs/churn_feature_policy.md.
"""

from src.data.dataset_contract import CLASSIFICATION_FEATURES
from src.features.leakage_guard import LeakageError
from src.preprocessing.train_only import make_train_only_classifier
from src.training.xgboost_policy import MAIN_FEATURES as PURCHASE_MAIN_FEATURES

TARGET = "Churned"
MODEL_VERSION = "1.0.0-snapshot-churn"
POLICY_VERSION = "snapshot-churn-behaviour21-v1"

# Never inputs: the label, and the purchase-count proxy pair identified in R2 (E5).
# Total_Purchases is additionally refused by the leakage guard itself.
ALWAYS_EXCLUDED = ("Churned", "Lifetime_Value", "Total_Purchases")
# Recency rises mechanically once a customer stops buying, and the source gives no cut-off date,
# so it may describe the state after churn. Kept only in the reference set.
TIMING_RISK = ("Days_Since_Last_Purchase",)


def _ordered(names):
    wanted = set(names)
    return tuple(name for name in CLASSIFICATION_FEATURES if name in wanted)


FEATURE_SETS = {
    "engagement12": _ordered(PURCHASE_MAIN_FEATURES),
    "behaviour21": _ordered(set(CLASSIFICATION_FEATURES) - set(ALWAYS_EXCLUDED) - set(TIMING_RISK)),
    "reference22": _ordered(set(CLASSIFICATION_FEATURES) - set(ALWAYS_EXCLUDED)),
}
MAIN_FEATURE_SET = "behaviour21"
REFERENCE_FEATURE_SET = "reference22"
MAIN_FEATURES = FEATURE_SETS[MAIN_FEATURE_SET]
REFERENCE_FEATURES = FEATURE_SETS[REFERENCE_FEATURE_SET]

# max_depth and learning_rate were selected in K2 (rule R1, reports/k/k2_model_comparison.json).
PARAMS = {
    "n_estimators": 200, "max_depth": 4, "learning_rate": 0.1, "subsample": 0.9,
    "colsample_bytree": 1.0, "min_child_weight": 5, "gamma": 0.1,
    "objective": "binary:logistic", "eval_metric": "logloss",
    "random_state": 42, "n_jobs": 2, "tree_method": "hist", "device": "cpu",
}


def validate_features(features):
    names = tuple(features)
    forbidden = sorted(set(names) & set(ALWAYS_EXCLUDED))
    if forbidden:
        raise LeakageError(f"Churn model inputs must not include {forbidden}")
    if names not in FEATURE_SETS.values():
        raise LeakageError("Churn model requires one of the frozen feature sets, in schema order")
    return names


def make_pipeline(features=MAIN_FEATURES, params=None):
    from xgboost import XGBClassifier

    names = validate_features(features)
    return make_train_only_classifier(XGBClassifier(**(params or PARAMS)), names, post_outcome_features=ALWAYS_EXCLUDED[:2])
