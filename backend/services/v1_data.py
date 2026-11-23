"""Read-only v1 pagination/aggregation. CRUD reuses existing transactional services."""

from sqlalchemy import func, select

from backend.models.customer import Customer, CustomerBehaviorSnapshot
from backend.models.ml import MLModel
from backend.models.prediction import PredictionResult, SegmentationResult, PredictionRun
from backend.models.scenario import PredictionScenario, ScenarioResult
from backend.services.customer_service import get_customer_or_404
from backend.services.versioned_models import versioned_models


def customers(db, *, offset, limit, include_inactive, q, sort, direction):
    filters = [] if include_inactive else [Customer.is_active.is_(True)]
    if q:
        filters.append(Customer.external_id.contains(q, autoescape=True))
    column = {"created_at": Customer.created_at, "external_id": Customer.external_id}[sort]
    order = column.desc() if direction == "desc" else column.asc()
    total = db.scalar(select(func.count(Customer.id)).where(*filters)) or 0
    items = list(db.scalars(select(Customer).where(*filters).order_by(order, Customer.id).offset(offset).limit(limit)))
    return {"items": items, "total": total, "offset": offset, "limit": limit}


def behaviors(db, customer_id, offset, limit):
    get_customer_or_404(db, customer_id)
    condition = CustomerBehaviorSnapshot.customer_id == customer_id
    total = db.scalar(select(func.count(CustomerBehaviorSnapshot.id)).where(condition)) or 0
    rows = list(db.scalars(select(CustomerBehaviorSnapshot).where(condition).order_by(
        CustomerBehaviorSnapshot.captured_at.desc(), CustomerBehaviorSnapshot.id).offset(offset).limit(limit)))
    return {"items": rows, "total": total, "offset": offset, "limit": limit}


def history(db, customer_id, task, offset, limit, model_version):
    from backend.schemas.v1 import PredictionHistoryV1, SegmentHistoryV1

    get_customer_or_404(db, customer_id)
    cls = PredictionResult if task == "classification" else SegmentationResult
    filters = [cls.customer_id == customer_id, MLModel.task == task]
    if model_version:
        filters.append(MLModel.version == model_version)
    total = db.scalar(select(func.count(cls.id)).join(MLModel, MLModel.id == cls.model_id).where(*filters)) or 0
    rows = db.execute(select(cls, MLModel).join(MLModel, MLModel.id == cls.model_id).where(*filters).order_by(
        cls.created_at.desc(), cls.id).offset(offset).limit(limit)).all()
    items = []
    for row, model in rows:
        schema = PredictionHistoryV1 if task == "classification" else SegmentHistoryV1
        values = {name: getattr(row, name) for name in schema.model_fields if hasattr(row, name)}
        values.update(model_id=model.name, model_registry_id=row.model_id,
                      model_name=model.name, model_version=model.version)
        if task == "segmentation":
            values["segment_id"] = (f"legacy:1.0.0:cluster:{row.cluster}" if model.version == "1.0.0" else
                                    model.metadata_json.get("segment_ids", {}).get(str(row.cluster), f"version:{model.version}:cluster:{row.cluster}"))
        items.append(schema.model_validate(values))
    return {"items": items, "total": total, "offset": offset, "limit": limit}


def overview(db):
    from datetime import datetime, timezone

    models = {"customers": Customer, "behavior_snapshots": CustomerBehaviorSnapshot,
              "models": MLModel, "prediction_runs": PredictionRun, "purchase_predictions": PredictionResult,
              "segmentation_results": SegmentationResult, "scenarios": PredictionScenario, "scenario_results": ScenarioResult}
    counts = {name: db.scalar(select(func.count(cls.id))) or 0 for name, cls in models.items()}
    counts["active_customers"] = db.scalar(select(func.count(Customer.id)).where(Customer.is_active.is_(True))) or 0
    return {"generated_at": datetime.now(timezone.utc), "counts": counts}


def segments(db, version):
    state = versioned_models.get("segmentation", version)
    metadata = state["metadata_object"]
    definitions = {}
    for cluster, label in metadata["cluster_names"].items():
        sid = f"legacy:1.0.0:cluster:{cluster}" if state["default"] else metadata["segment_ids"][cluster]
        definitions[sid] = {"cluster": cluster, "display_label": label}
    counts = {sid: 0 for sid in definitions}
    results = db.execute(select(SegmentationResult.cluster, func.count(SegmentationResult.id)).join(
        MLModel, MLModel.id == SegmentationResult.model_id).where(
        MLModel.name == "customer-segmentation-kmeans", MLModel.version == version,
        MLModel.task == "segmentation").group_by(SegmentationResult.cluster)).all()
    for cluster, count in results:
        sid = f"legacy:1.0.0:cluster:{cluster}" if state["default"] else metadata["segment_ids"].get(str(cluster), f"unknown:{cluster}")
        counts[sid] = int(count)
    return {"model_version": version, "definitions": definitions, "stored_result_counts": counts}
