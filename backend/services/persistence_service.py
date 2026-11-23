"""Persist AI model registry, runs, and inference histories."""

import hashlib
import json
from pathlib import Path
from uuid import UUID

import numpy as np
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from backend.models.customer import Customer, CustomerBehaviorSnapshot
from backend.models.ml import MLModel
from backend.models.prediction import (
    PredictionResult,
    PredictionRun,
    SegmentationResult,
)
from backend.services.model_service import MODEL_DIR, model_service
from backend.services.persistence_validation import validate_results

MODEL_CONFIG = {
    "classification": {
        "name": "purchase-level-xgboost",
        "algorithm": "XGBoost",
        "version": "1.0.0",
        "artifact": "purchase_level_xgboost_pipeline.joblib",
        "metadata": "purchase_level_xgboost_metadata.json",
    },
    "segmentation": {
        "name": "customer-segmentation-kmeans",
        "algorithm": "K-Means",
        "version": "1.0.0",
        "artifact": "customer_segmentation_kmeans_pipeline.joblib",
        "metadata": "customer_segmentation_kmeans_metadata.json",
    },
}


def _checksum(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _json_safe(value):
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, float) and not np.isfinite(value):
        return None
    return value


def get_or_register_model(db: Session, task: str) -> MLModel:
    config = MODEL_CONFIG[task]
    artifact_path = MODEL_DIR / config["artifact"]
    metadata_path = MODEL_DIR / config["metadata"]
    metadata = (
        model_service.xgboost_metadata
        if task == "classification"
        else model_service.kmeans_metadata
    )
    if metadata is None:
        with metadata_path.open(encoding="utf-8") as file:
            metadata = json.load(file)

    identity = {"name": config["name"], "task": task, "algorithm": config["algorithm"],
                    "version": config["version"], "artifact_path": str(artifact_path.relative_to(MODEL_DIR.parent)),
                    "metadata_path": str(metadata_path.relative_to(MODEL_DIR.parent)),
                    "artifact_checksum": _checksum(artifact_path), "metadata_json": _json_safe(metadata)}
    query = select(MLModel).where(MLModel.name == config["name"], MLModel.version == config["version"])
    model = db.scalar(query.with_for_update(read=True).execution_options(populate_existing=True))
    if model is None:
        # Keep the existing UNIQUE(name,version); never update the winning row.
        # At READ COMMITTED a separate SELECT sees the concurrent committed winner.
        db.execute(insert(MLModel).values(**identity, is_active=True).on_conflict_do_nothing(
            constraint="model_name_version"))
        model = db.scalar(query.with_for_update(read=True).execution_options(populate_existing=True))
    if model is None or any(getattr(model, key) != value for key, value in identity.items()):
        raise HTTPException(status_code=409, detail={"code": "MODEL_REGISTRY_MISMATCH",
                            "message": "Stored model identity does not match the inference artifact; no registry row was overwritten"})
    return model


def _resolve_batch_links(db, customer_ids, snapshot_ids):
    """Two set lookups, retain original first-error order and ownership semantics."""
    requested_customers = {value for value in customer_ids if value is not None}
    requested_snapshots = {value for value in snapshot_ids if value is not None}
    # Keep share locks until commit: deletion/reparenting cannot race the check.
    customers = set(db.scalars(select(Customer.id).where(Customer.id.in_(requested_customers)).with_for_update(read=True))) if requested_customers else set()
    snapshots = dict(db.execute(select(CustomerBehaviorSnapshot.id, CustomerBehaviorSnapshot.customer_id).where(
        CustomerBehaviorSnapshot.id.in_(requested_snapshots)).with_for_update(read=True)).all()) if requested_snapshots else {}
    links = []
    for customer_id, snapshot_id in zip(customer_ids, snapshot_ids):
        if customer_id is not None and customer_id not in customers:
            raise HTTPException(status_code=404, detail="Customer not found")
        if snapshot_id is not None:
            if snapshot_id not in snapshots:
                raise HTTPException(status_code=404, detail="Behavior snapshot not found")
            if customer_id is not None and snapshots[snapshot_id] != customer_id:
                raise HTTPException(status_code=422, detail="Behavior snapshot does not belong to customer")
            customer_id = snapshots[snapshot_id]
        links.append((customer_id, snapshot_id))
    return links


def persist_inference_results(
    db: Session,
    *,
    task: str,
    run_type: str,
    inputs: list[dict],
    results: list[dict],
    customer_ids: list[UUID | None] | None = None,
    snapshot_ids: list[UUID | None] | None = None,
    source: str = "api",
    commit: bool = True,
) -> UUID:
    if len(inputs) != len(results):
        raise ValueError("Inputs and results must have identical lengths")

    count = len(results)
    customer_ids = customer_ids or [None] * count
    snapshot_ids = snapshot_ids or [None] * count
    if len(customer_ids) != count or len(snapshot_ids) != count:
        raise HTTPException(
            status_code=422,
            detail="Customer and snapshot links must match result count",
        )

    try:
        validate_results(task, run_type, inputs, results)
        links = _resolve_batch_links(db, customer_ids, snapshot_ids)
        model = get_or_register_model(db, task)
        if task == "segmentation":
            names = model.metadata_json.get("cluster_names", {})
            if any(names.get(str(result["cluster"])) != result["segment_name"] for result in results):
                from backend.services.persistence_validation import (
                    InvalidInferenceResult,
                )
                raise InvalidInferenceResult("Segment output does not match registered model labels")
        run = PredictionRun(
            model_id=model.id,
            task=task,
            run_type=run_type,
            source=source,
            status="completed",
            requested_count=count,
            success_count=count,
            failure_count=0,
            persist_results=True,
        )
        db.add(run)
        db.flush()

        for index, result in enumerate(results):
            customer_id, snapshot_id = links[index]
            common = {
                "run_id": run.id,
                "model_id": model.id,
                "customer_id": customer_id,
                "behavior_snapshot_id": snapshot_id,
                "input_features": _json_safe(inputs[index]),
            }
            if task == "classification":
                probabilities = result["probabilities"]
                db.add(
                    PredictionResult(
                        **common,
                        predicted_class=int(result["predicted_class"]),
                        purchase_level=result["purchase_level"],
                        probability_low=float(probabilities["Low"]),
                        probability_medium=float(probabilities["Medium"]),
                        probability_high=float(probabilities["High"]),
                    )
                )
            else:
                db.add(
                    SegmentationResult(
                        **common,
                        cluster=int(result["cluster"]),
                        segment_name=result["segment_name"],
                        distance_to_centroid=float(
                            result["distance_to_centroid"]
                        ),
                    )
                )

        run_id = run.id
        if commit:
            db.commit()
        else:
            db.flush()  # Caller commits results and its durable checkpoint atomically.
        return run_id
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
