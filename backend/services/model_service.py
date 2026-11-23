"""Load and expose the trained machine-learning models."""

import json
from pathlib import Path

import joblib

# Required so joblib can resolve the custom transformer when loading K-Means.
from src.features.quantile_clipper import QuantileClipper  # noqa: F401


PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = PROJECT_ROOT / "models"


class ModelService:
    """Keep trained models and their metadata in application memory."""

    def __init__(self):
        self.xgboost = None
        self.kmeans = None
        self.xgboost_metadata = None
        self.kmeans_metadata = None

    def load_models(self):
        xgb_path = (
            MODEL_DIR / "purchase_level_xgboost_pipeline.joblib"
        )
        kmeans_path = (
            MODEL_DIR
            / "customer_segmentation_kmeans_pipeline.joblib"
        )
        xgb_metadata_path = (
            MODEL_DIR / "purchase_level_xgboost_metadata.json"
        )
        kmeans_metadata_path = (
            MODEL_DIR
            / "customer_segmentation_kmeans_metadata.json"
        )

        self.xgboost = joblib.load(xgb_path)
        self.kmeans = joblib.load(kmeans_path)

        with xgb_metadata_path.open(encoding="utf-8") as file:
            self.xgboost_metadata = json.load(file)

        with kmeans_metadata_path.open(encoding="utf-8") as file:
            self.kmeans_metadata = json.load(file)

        print("XGBoost model loaded successfully.")
        print("K-Means model loaded successfully.")

    def get_status(self):
        return {
            "xgboost_loaded": self.xgboost is not None,
            "kmeans_loaded": self.kmeans is not None,
        }


model_service = ModelService()
