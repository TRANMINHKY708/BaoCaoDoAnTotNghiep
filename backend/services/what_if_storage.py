"""Atomic legacy-only scenario storage. Advisory locks protect cooperative writers,
not raw SQL, restore, privileged deletes, or a database-enforced unique key.
"""
from collections import defaultdict
from datetime import timezone
from uuid import UUID

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError

from backend.models.ml import MLModel
from backend.models.scenario import PredictionScenario, ScenarioResult
from backend.schemas import what_if as s
from backend.services.persistence_service import get_or_register_model
from backend.services.versioned_models import failure
from backend.services import what_if_engine as engine

IDEMPOTENCY_SCOPE = "local-demo-single-owner-v1"


def advisory_key(key):
    return int.from_bytes(bytes.fromhex(engine.digest(dict(namespace="what-if-save-v1", scope=IDEMPOTENCY_SCOPE, key=str(key))))[:8], "big", signed=True)


def input_hash(raw, identity):
    return engine.digest(dict(contract_version=s.CONTRACT_VERSION, model=identity, input=raw))


def result_envelope(raw, outcome):
    names = engine.features_for(outcome["task"], outcome["model"]["model_version"])
    projected = {n: raw[n] for n in names}
    return s.StoredResultEnvelope(schema_version=s.CONTRACT_VERSION, input_features=projected,
        input_sha256=input_hash(projected, outcome["model"]), prediction=outcome,
        interpretation="snapshot_non_causal").model_dump(mode="json")


def integrity_failure():
    failure(409, "STORED_SCENARIO_INTEGRITY_ERROR", "Stored scenario cannot be verified; no records were changed")


def detail_from_rows(scenario, rows, *, replay=False):
    """Validate stored data and rebuild comparison WITHOUT inference/live files."""
    try:
        env = s.StoredChangesEnvelope.model_validate(scenario.changed_features).model_dump(mode="json")
        before, after, refs = {}, {}, []
        baseline_raw, scenario_raw = {}, {}
        stored_delta = None
        for row, registry in rows:
            a = s.StoredResultEnvelope.model_validate(row.before_result).model_dump(mode="json")
            b = s.StoredResultEnvelope.model_validate(row.after_result).model_dump(mode="json")
            task = a["prediction"]["task"]
            identity = a["prediction"]["model"]
            if task in before or b["prediction"]["task"] != task or b["prediction"]["model"] != identity or identity != env["models"][task]:
                integrity_failure()
            if row.model_id != registry.id or row.baseline_prediction_result_id is not None:
                integrity_failure()
            if (registry.name, registry.task, registry.version, registry.artifact_checksum) != (
                identity["model_id"], task, identity["model_version"], identity["artifact_sha256"]):
                integrity_failure()
            for envelope, target in ((a, baseline_raw), (b, scenario_raw)):
                if envelope["input_sha256"] != input_hash(envelope["input_features"], identity):
                    integrity_failure()
                for name, value in envelope["input_features"].items():
                    if name in target and target[name] != value:
                        integrity_failure()
                    target[name] = value
            before[task], after[task] = a["prediction"], b["prediction"]
            if task == "classification":
                stored_delta = s.StoredClassificationDeltas.model_validate(row.probability_deltas).model_dump(mode="json")
                if stored_delta["class_changed"] != (before[task]["purchase_level"] != after[task]["purchase_level"]):
                    integrity_failure()
            else:
                delta = s.StoredSegmentationDeltas.model_validate(row.probability_deltas).model_dump(mode="json")
                if (delta["baseline_segment_id"], delta["scenario_segment_id"], delta["segment_changed"]) != (
                    before[task]["segment_id"], after[task]["segment_id"], before[task]["segment_id"] != after[task]["segment_id"]):
                    integrity_failure()
                if delta["comparison_fingerprint"] != env["comparison_fingerprint"] or delta["warnings"] != env["audit"]["comparison_warnings"]:
                    integrity_failure()
            refs.append(dict(scenario_result_id=row.id, task=task, model_registry_id=registry.id, model_identity=identity))
        expected_tasks = {task for task, identity in env["models"].items() if identity is not None}
        if set(before) != expected_tasks or stored_delta is None:
            integrity_failure()
        source = env["source"]
        base_hash = engine.baseline_hash({k: v for k, v in env["models"].items() if v is not None}, baseline_raw, source)
        if base_hash != env["baseline_fingerprint"]:
            integrity_failure()
        if {**baseline_raw, **env["requested_changes"]} != scenario_raw:
            integrity_failure()
        if stored_delta["comparison_fingerprint"] != env["comparison_fingerprint"] or stored_delta["warnings"] != env["audit"]["comparison_warnings"]:
            integrity_failure()
        comparison = dict(contract_version=s.CONTRACT_VERSION,
            baseline=dict(contract_version=s.CONTRACT_VERSION, baseline_input=baseline_raw, baseline_fingerprint=base_hash,
                classification=before["classification"], segmentation=before.get("segmentation"),
                resolved_customer_id=source["original_customer_id"], resolved_snapshot_id=source["original_snapshot_id"],
                generated_at=env["audit"]["baseline_generated_at"], warnings=env["audit"]["baseline_warnings"],
                scope=engine.SCOPE, disclaimer=s.NON_CAUSAL, persisted=False),
            scenario_input=scenario_raw, scenario_classification=after["classification"], scenario_segmentation=after.get("segmentation"),
            changed_fields=env["changes"], classification_label_changed=stored_delta["class_changed"],
            probability_deltas={k: stored_delta[k] for k in ("absolute", "percentage_points", "relative")},
            comparison_fingerprint=env["comparison_fingerprint"], warnings=env["audit"]["comparison_warnings"],
            disclaimer=s.NON_CAUSAL, persisted=False)
        checked = s.ComparisonResponse.model_validate(comparison).model_dump(mode="json")
        if engine.comparison_hash(checked) != env["comparison_fingerprint"]:
            integrity_failure()
        original = (source["original_customer_id"], source["original_snapshot_id"])
        current = tuple(str(v) if v is not None else None for v in (scenario.customer_id, scenario.baseline_snapshot_id))
        link_status = "features_only" if original == (None, None) else "attached" if current == original else "detached"
        return s.SavedScenarioDetail(contract_version=s.CONTRACT_VERSION, scenario_id=scenario.id,
            created_at=scenario.created_at.astimezone(timezone.utc), persisted=True, idempotency_replayed=replay,
            original_customer_id=original[0], original_snapshot_id=original[1], current_customer_id=current[0], current_snapshot_id=current[1],
            source_link_status=link_status, name=scenario.name, description=scenario.description,
            comparison=checked, results=refs, disclaimer=s.NON_CAUSAL, integrity_status="verified").model_dump(mode="json")
    except (ValidationError, ValueError, TypeError, KeyError, AttributeError):
        integrity_failure()


def rows_for(db, scenario_ids):
    grouped = defaultdict(list)
    if scenario_ids:
        for row, model in db.execute(select(ScenarioResult, MLModel).join(MLModel, ScenarioResult.model_id == MLModel.id)
                .where(ScenarioResult.scenario_id.in_(scenario_ids)).order_by(ScenarioResult.scenario_id, MLModel.task)):
            grouped[row.scenario_id].append((row, model))
    return grouped


def detail(db, scenario_id):
    scenario = db.get(PredictionScenario, scenario_id)
    if scenario is None:
        failure(404, "SCENARIO_NOT_FOUND", "Scenario not found")
    return detail_from_rows(scenario, rows_for(db, [scenario.id])[scenario.id])


def history(db, query):
    conditions = []
    if query.customer_id is not None:
        conditions.append(PredictionScenario.customer_id == query.customer_id)
    if query.classification_model_version:
        conditions.append(PredictionScenario.changed_features["models"]["classification"]["model_version"].as_string() == query.classification_model_version)
    total = db.scalar(select(func.count()).select_from(PredictionScenario).where(*conditions))
    scenarios = list(db.scalars(select(PredictionScenario).where(*conditions)
        .order_by(PredictionScenario.created_at.desc(), PredictionScenario.id.desc()).offset(query.offset).limit(query.limit)))
    grouped = rows_for(db, [row.id for row in scenarios])
    items = []
    for row in scenarios:
        summary = dict(scenario_id=row.id, name=row.name, created_at=row.created_at.astimezone(timezone.utc), customer_id=row.customer_id,
            models=None, baseline_label=None, scenario_label=None, classification_label_changed=None,
            scope=engine.SCOPE, integrity_status="unverified")
        try:
            saved = detail_from_rows(row, grouped[row.id])
            compare = saved["comparison"]
            summary.update(models=dict(classification=compare["baseline"]["classification"]["model"]["model_version"],
                segmentation=compare["baseline"]["segmentation"]["model"]["model_version"] if compare["baseline"]["segmentation"] else None),
                baseline_label=compare["baseline"]["classification"]["purchase_level"],
                scenario_label=compare["scenario_classification"]["purchase_level"],
                classification_label_changed=compare["classification_label_changed"], integrity_status="verified")
        except HTTPException as exc:
            if exc.status_code != 409:
                raise
        items.append(summary)
    return s.HistoryPage(items=items, total=total, offset=query.offset, limit=query.limit, disclaimer=s.NON_CAUSAL).model_dump(mode="json")


def save(db, payload, key):
    if any(version != "1.0.0" for _, version in engine.selected(payload.models)):
        failure(409, "MODEL_PERSISTENCE_UNSUPPORTED", "Research versions are preview/compare only; nothing was saved")
    if db is None:
        failure(503, "DATABASE_UNAVAILABLE", "Scenario storage requires a configured database")
    intent = engine.digest(payload.model_dump(mode="json"))
    lock_id = advisory_key(key)
    try:
        if db.scalar(text("SHOW transaction_isolation")) != "read committed":
            failure(503, "DATABASE_UNAVAILABLE", "What-if save requires READ COMMITTED")
        db.execute(text("SET LOCAL lock_timeout='1s'"))
        db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_id})
        existing = list(db.scalars(select(PredictionScenario).where(
            PredictionScenario.changed_features["schema_version"].as_string() == s.CONTRACT_VERSION,
            PredictionScenario.changed_features["idempotency"]["scope"].as_string() == IDEMPOTENCY_SCOPE,
            PredictionScenario.changed_features["idempotency"]["key"].as_string() == str(key))))
        if len(existing) > 1:
            integrity_failure()
        if existing:
            row = existing[0]
            if row.changed_features["idempotency"]["canonical_intent_sha256"] != intent:
                failure(409, "IDEMPOTENCY_KEY_REUSED", "Key already used with another request")
            if row.name != payload.name or row.description != payload.description:
                integrity_failure()
            result = detail_from_rows(row, rows_for(db, [row.id])[row.id], replay=True)
            from backend.services.account_business import replay
            replay(db, row.id)
            db.commit()
            return result, False
        pinned = engine.PinnedInference(payload.models)
        comparison = engine.evaluate(payload, db, lock=True, pinned=pinned)
        if comparison["comparison_fingerprint"] != payload.expected_comparison_fingerprint:
            failure(409, "COMPARISON_CHANGED", "Comparison changed; compare again before saving")
        base = comparison["baseline"]
        model_ids = {task: outcome["model"] for task, outcome in (("classification", base["classification"]), ("segmentation", base["segmentation"])) if outcome}
        env = s.StoredChangesEnvelope(schema_version=s.CONTRACT_VERSION, canonicalization="what-if-canonical-json-v1",
            source=dict(kind=payload.baseline.kind, original_customer_id=base["resolved_customer_id"], original_snapshot_id=base["resolved_snapshot_id"]),
            baseline_fingerprint=base["baseline_fingerprint"], comparison_fingerprint=comparison["comparison_fingerprint"],
            models={**model_ids, "segmentation": model_ids.get("segmentation")}, changes=comparison["changed_fields"], requested_changes=payload.changes,
            idempotency=dict(scope=IDEMPOTENCY_SCOPE, key=key, canonical_intent_sha256=intent),
            acknowledgement=dict(sensitive_snapshot_storage=True),
            audit=dict(baseline_generated_at=base["generated_at"], baseline_warnings=base["warnings"], comparison_warnings=comparison["warnings"], scope=engine.SCOPE),
            interpretation="snapshot_non_causal").model_dump(mode="json")
        registry = {task: get_or_register_model(db, task) for task in sorted(model_ids)}
        if any(model.artifact_checksum != model_ids[task]["artifact_sha256"] for task, model in registry.items()):
            failure(409, "MODEL_REGISTRY_MISMATCH", "Registry identity does not match the comparison")
        scenario = PredictionScenario(customer_id=UUID(base["resolved_customer_id"]) if base["resolved_customer_id"] else None,
            baseline_snapshot_id=UUID(base["resolved_snapshot_id"]) if base["resolved_snapshot_id"] else None,
            name=payload.name, description=payload.description, changed_features=env)
        db.add(scenario); db.flush()
        for task, model in registry.items():
            outcome_before = base[task]
            outcome_after = comparison["scenario_" + task]
            if task == "classification":
                delta = s.StoredClassificationDeltas(**comparison["probability_deltas"], schema_version=s.CONTRACT_VERSION,
                    task=task, supported=True, warnings=comparison["warnings"], class_changed=comparison["classification_label_changed"],
                    comparison_fingerprint=comparison["comparison_fingerprint"]).model_dump(mode="json")
            else:
                delta = s.StoredSegmentationDeltas(schema_version=s.CONTRACT_VERSION, task=task, supported=False,
                    reason="kmeans_distance_is_not_probability", baseline_segment_id=outcome_before["segment_id"],
                    scenario_segment_id=outcome_after["segment_id"], segment_changed=outcome_before["segment_id"] != outcome_after["segment_id"],
                    warnings=comparison["warnings"], comparison_fingerprint=comparison["comparison_fingerprint"]).model_dump(mode="json")
            db.add(ScenarioResult(scenario_id=scenario.id, model_id=model.id, baseline_prediction_result_id=None,
                before_result=result_envelope(base["baseline_input"], outcome_before),
                after_result=result_envelope(comparison["scenario_input"], outcome_after), probability_deltas=delta))
            db.flush()  # a failure on the second result still rolls everything back
        result = detail_from_rows(scenario, rows_for(db, [scenario.id])[scenario.id])
        pinned.verify()
        db.commit()
        return result, True
    except DBAPIError as exc:
        db.rollback()
        if getattr(exc.orig, "sqlstate", None) == "55P03":
            raise HTTPException(503, detail=dict(code="IDEMPOTENCY_BUSY", message="Transaction is busy; retry the same key and payload"), headers={"Retry-After": "1"}) from None
        raise
    except Exception:
        db.rollback()
        raise
