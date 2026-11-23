"""Pinned, task-scoped model catalog; no promotion, fitting or DB writes."""

from datetime import datetime, timezone
import json
from pathlib import Path

from fastapi import HTTPException

from backend.schemas import v1 as schemas
from backend.services.model_service import PROJECT_ROOT, model_service
from backend.services.prediction_service import prepare_customer
from src.training.artifacts import sha256, load_bundle as load_t4, predict_snapshot as predict_t4
from src.segmentation.artifacts import load_bundle as load_t5, predict_snapshot as predict_t5


CATALOG_PATH = PROJECT_ROOT / "backend/model_catalog.json"
MODEL_NAMES = {"classification": "purchase-level-xgboost", "segmentation": "customer-segmentation-kmeans"}
INPUT_MODELS = {
    ("classification", "1.0.0"): schemas.LegacyPurchaseCustomer,
    ("classification", "2.0.0-snapshot-conservative12"): schemas.T4PurchaseCustomer,
    ("segmentation", "1.0.0"): schemas.LegacySegmentCustomer,
    ("segmentation", "2.0.0-snapshot-k3"): schemas.T5SegmentCustomer,
}


def failure(status, code, message):
    raise HTTPException(status_code=status, detail={"code": code, "message": message})


def pins():
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))["entries"]


def verify_pin(entry):
    for key in ("artifact", "metadata"):
        path = (PROJECT_ROOT / entry[key]).resolve()
        if not path.is_relative_to(PROJECT_ROOT.resolve()):
            raise ValueError("Catalog artifact outside project")
        if sha256(path) != entry[f"{key}_sha256"]:
            raise ValueError("Pinned model artifact/metadata checksum mismatch")


def verify_legacy_pins():
    for entry in pins():
        if entry["default"]:
            verify_pin(entry)


class VersionedModels:
    def __init__(self):
        self.entries = {}

    def load(self):
        """Once per successful lifespan; optional research failures are isolated."""
        self.entries = {}
        for pin in pins():
            key = (pin["task"], pin["version"])
            state = {**pin, "pipeline": None, "metadata_object": None, "error": None}
            try:
                verify_pin(pin)
                if pin["default"]:
                    model = model_service.xgboost if pin["task"] == "classification" else model_service.kmeans
                    metadata = model_service.xgboost_metadata if pin["task"] == "classification" else model_service.kmeans_metadata
                    if model is None or metadata is None:
                        raise ValueError("Default model unavailable")
                else:
                    loader = load_t4 if pin["task"] == "classification" else load_t5
                    model, metadata = loader((PROJECT_ROOT / pin["metadata"]).parent)
                state.update(pipeline=model, metadata_object=metadata)
            except Exception:
                # No filesystem paths, secrets, payloads or traceback in catalog.
                state["error"] = "ARTIFACT_UNAVAILABLE_OR_INCOMPATIBLE"
                if pin["default"]:
                    raise RuntimeError("Pinned default model failed validation") from None
            self.entries[key] = state

    def get(self, task, version="1.0.0", *, require_available=True):
        state = self.entries.get((task, version))
        if state is None:
            failure(404, "MODEL_VERSION_NOT_FOUND", "Unknown model version for this task")
        if require_available and state["pipeline"] is None:
            failure(503, "MODEL_UNAVAILABLE", "Requested model version is unavailable; no fallback was used")
        return state

    def catalog(self):
        result = []
        for (task, version), state in self.entries.items():
            schema = INPUT_MODELS[(task, version)].model_json_schema()
            features = list(schema["properties"])
            meta = state["metadata_object"] or {}
            labels = (meta.get("class_mapping", {"0": "Low", "1": "Medium", "2": "High"})
                      if task == "classification" else meta.get("cluster_names", {}))
            result.append({
                "task": task, "model_id": MODEL_NAMES[task], "model_version": version,
                "is_default": state["default"], "serving_mode": "legacy_default" if state["default"] else "explicit_research",
                "available": state["pipeline"] is not None, "unavailable_code": state["error"],
                "persistence_supported": state["default"], "artifact_sha256": state["artifact_sha256"],
                "feature_count": len(features), "features": features, "input_schema": schema,
                "label_namespace": "purchase_level" if task == "classification" else "legacy_clusters_v1" if state["default"] else "engagement_snapshot_v2",
                "labels": labels, "limitations": meta.get("limitations", ["Historical snapshot model; no independent new test or verified temporal availability"]),
            })
        return {"contract_version": "1.0.0", "models": result}


versioned_models = VersionedModels()


def ensure_persistence_allowed(task, version, requested):
    state = versioned_models.get(task, version)
    if requested and not state["default"]:
        failure(409, "MODEL_PERSISTENCE_UNSUPPORTED", "Research versions are inference-only; no results or model registry entries were saved")
    return state


def infer(task, version, customer):
    state = versioned_models.get(task, version)
    return infer_pinned(task, version, customer, state)


def infer_pinned(task, version, customer, state):
    """Same inference implementation with an explicitly pinned request state."""
    pipeline, metadata = state["pipeline"], state["metadata_object"]
    try:
        if not state["default"] and all(value is None for value in customer.values()):
            failure(422, "INVALID_MODEL_INPUT", "At least one observed feature is required")
        if "Churned" in customer and customer["Churned"] not in (0, 1):
            failure(422, "INVALID_MODEL_INPUT", "Churned must be numeric 0 or 1 for the legacy classifier")
        if state["default"]:
            features = metadata.get("input_features", metadata.get("features"))
            frame = prepare_customer(customer, pipeline, features)
            if task == "classification":
                label = int(pipeline.predict(frame)[0])
                probabilities = pipeline.predict_proba(frame)[0]
                classes = pipeline.named_steps["classifier"].classes_
                result = {"predicted_class": label, "purchase_level": {0: "Low", 1: "Medium", 2: "High"}[label],
                          "probabilities": {metadata["class_mapping"][str(int(i))]: float(p) for i, p in zip(classes, probabilities)}}
            else:
                cluster = int(pipeline.predict(frame)[0])
                result = {"cluster": cluster, "segment_name": metadata["cluster_names"][str(cluster)],
                          "distance_to_centroid": float(pipeline.transform(frame)[0, cluster]),
                          "segment_id": f"legacy:1.0.0:cluster:{cluster}"}
        else:
            result = (predict_t4 if task == "classification" else predict_t5)(customer, pipeline, metadata)
    except (ValueError, TypeError):
        failure(422, "INVALID_MODEL_INPUT", "Input violates the selected model schema or validity policy")
    common = {"task": task, "model_id": MODEL_NAMES[task], "model_version": version,
              "generated_at": datetime.now(timezone.utc)}
    if task == "classification":
        return schemas.PurchaseResponse(**common, **result,
                                        target_thresholds={"low_inclusive": 10, "medium_inclusive": 15}).model_dump(mode="json")
    result = {k: v for k, v in result.items() if k not in {"model_version", "disclaimer"}}
    return schemas.SegmentResponse(**common, **result).model_dump(mode="json")


def validate_registry_identity(db, task):
    """Only v1 persistence: never silently reuse a mismatched legacy registry row."""
    from sqlalchemy import select
    from backend.models.ml import MLModel

    state = versioned_models.get(task)
    existing = db.scalar(select(MLModel).where(MLModel.name == MODEL_NAMES[task], MLModel.version == "1.0.0").execution_options(populate_existing=True))
    if existing is not None and existing.artifact_checksum != state["artifact_sha256"]:
        failure(409, "MODEL_REGISTRY_MISMATCH", "Stored model identity does not match the loaded artifact; no registry row was overwritten")
    if existing is not None and existing.metadata_json != state["metadata_object"]:
        failure(409, "MODEL_REGISTRY_MISMATCH", "Stored model metadata differs from the pinned model; no registry row was overwritten")
