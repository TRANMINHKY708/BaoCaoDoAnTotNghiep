"""Database model registry imported by Alembic."""

from backend.models.analysis import BulkAnalysisItem, BulkAnalysisJob
from backend.models.bulk import BulkImportJob, BulkImportRow, CustomerSourceIdentity
from backend.models.customer import Customer, CustomerBehaviorSnapshot
from backend.models.ml import MLModel
from backend.models.prediction import (
    PredictionResult,
    PredictionRun,
    SegmentationResult,
)
from backend.models.scenario import PredictionScenario, ScenarioResult

__all__ = [
    "BulkAnalysisItem",
    "BulkAnalysisJob",
    "BulkImportJob",
    "BulkImportRow",
    "Customer",
    "CustomerBehaviorSnapshot",
    "CustomerSourceIdentity",
    "MLModel",
    "PredictionResult",
    "PredictionRun",
    "PredictionScenario",
    "ScenarioResult",
    "SegmentationResult",
]

# Register only application-level guards; this does not create DB triggers/DDL.
from backend.db.history_policy import install_history_policy

install_history_policy()
from backend.bulk.history import install as install_bulk_history_policy

install_bulk_history_policy()
