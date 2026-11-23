"""Frozen before CV: a conservative snapshot policy, not temporal certification."""

from src.data.dataset_contract import FEATURE_COLUMNS, FIELDS
from src.features.leakage_guard import LeakageError
from src.preprocessing.train_only import make_train_only_classifier


MODEL_VERSION = "2.0.0-snapshot-conservative12"
POLICY_VERSION = "snapshot-conservative-12-v1"
MAIN_FEATURES = (
    "Age", "Gender", "Country", "City", "Membership_Years",
    "Login_Frequency", "Session_Duration_Avg", "Pages_Per_Session",
    "Wishlist_Items", "Email_Open_Rate", "Mobile_App_Usage", "Signup_Quarter",
)
EXCLUDED_FEATURES = tuple(name for name in FEATURE_COLUMNS if name not in MAIN_FEATURES)
PARAMS = {
    "n_estimators": 200, "max_depth": 3, "learning_rate": 0.2,
    "subsample": 0.9, "colsample_bytree": 1.0, "min_child_weight": 5,
    "gamma": 0.1, "objective": "multi:softprob", "num_class": 3,
    "eval_metric": "mlogloss", "random_state": 42, "n_jobs": 2,
    "tree_method": "hist", "device": "cpu",
}
PROBABILITY_ATOL = 1e-7
METRIC_ATOL = 1e-9


def validate_main_features(features):
    if tuple(features) != MAIN_FEATURES:
        raise LeakageError("T4 requires the frozen 12-feature schema/order; proxies are quarantined")


def feature_schema():
    specs = {field.name: field for field in FIELDS}
    return [{"name": name, "type": specs[name].kind, "nullable": True,
             "minimum": specs[name].minimum, "maximum": specs[name].maximum,
             "categories": list(specs[name].categories)} for name in MAIN_FEATURES]


def make_pipeline():
    from xgboost import XGBClassifier

    validate_main_features(MAIN_FEATURES)
    return make_train_only_classifier(
        XGBClassifier(**PARAMS), MAIN_FEATURES, post_outcome_features=EXCLUDED_FEATURES,
    )
