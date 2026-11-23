"""Read-only snapshot input sensitivity. Never fits, registers or writes models."""
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
import math

import numpy as np
import pandas as pd
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select

from backend.models.customer import Customer, CustomerBehaviorSnapshot
from backend.schemas import what_if as s
from backend.services.versioned_models import (
    MODEL_NAMES, failure, infer_pinned, pins, verify_pin, versioned_models,
)
from src.data.dataset_contract import FIELDS

SCOPE = "snapshot_input_sensitivity_not_causal_or_future"
BASE_WARNINGS = {"SNAPSHOT_ONLY", "NON_CAUSAL", "AVAILABILITY_UNKNOWN", "PLAUSIBILITY_NOT_VERIFIED"}


def canonical(value):
    """what-if-canonical-json-v1: numeric equivalence, no Unicode normalization."""
    if isinstance(value, dict):
        return {k: canonical(v) for k, v in value.items()}
    if isinstance(value, (tuple, list)):
        return [canonical(v) for v in value]
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        number = float(value)
        if not math.isfinite(number):
            raise ValueError("Nonfinite canonical number")
        return 0.0 if number == 0 else number
    return value


def digest(value):
    return hashlib.sha256(json.dumps(canonical(value), sort_keys=True, ensure_ascii=False,
        separators=(",", ":"), allow_nan=False).encode("utf-8")).hexdigest()


def selected(models):
    return [(task, version) for task, version in models.model_dump().items() if version is not None]


def features_for(task, version):
    return s.SEGMENT_FEATURES if task == "segmentation" else s.LEGACY_FEATURES if version == "1.0.0" else s.T4_FEATURES


def identities(models):
    catalog = {(p["task"], p["version"]): p for p in pins()}
    return {task: dict(model_id=MODEL_NAMES[task], model_version=version,
            artifact_sha256=catalog[(task, version)]["artifact_sha256"],
            metadata_sha256=catalog[(task, version)]["metadata_sha256"], validation_policy=s.CONTRACT_VERSION)
            for task, version in selected(models)}


def baseline_hash(model_ids, raw, source):
    return digest(dict(contract_version=s.CONTRACT_VERSION, canonicalization="what-if-canonical-json-v1",
                       models=model_ids, input=raw, source=source))


def comparison_hash(result):
    base = result["baseline"]
    return digest(dict(contract_version=s.CONTRACT_VERSION, baseline_fingerprint=base["baseline_fingerprint"],
        baseline_classification=base["classification"], baseline_segmentation=base["segmentation"],
        baseline_warnings=sorted(base["warnings"]), scenario_input=result["scenario_input"],
        scenario_classification=result["scenario_classification"], scenario_segmentation=result["scenario_segmentation"],
        changed_fields=result["changed_fields"], probability_deltas=result["probability_deltas"],
        warnings=sorted(result["warnings"])))


def resolve(payload, db, *, lock=False):
    if isinstance(payload.baseline, s.FeaturesBaseline):
        return deepcopy(payload.baseline.features), dict(kind="features", original_customer_id=None, original_snapshot_id=None)
    if db is None:
        failure(503, "DATABASE_UNAVAILABLE", "Customer snapshots require a database")
    source = payload.baseline
    now = datetime.now(timezone.utc)
    if lock:
        customer = db.scalar(select(Customer).where(Customer.id == source.customer_id)
            .with_for_update(read=True).execution_options(populate_existing=True))
        statement = select(CustomerBehaviorSnapshot)
    else:
        # One SQL statement gives a consistent customer/snapshot read at READ COMMITTED.
        match = (CustomerBehaviorSnapshot.id == source.snapshot_id if source.snapshot_id else
                 (CustomerBehaviorSnapshot.customer_id == Customer.id) & (CustomerBehaviorSnapshot.captured_at <= now))
        pair = db.execute(select(Customer, CustomerBehaviorSnapshot).outerjoin(CustomerBehaviorSnapshot, match)
            .where(Customer.id == source.customer_id).order_by(CustomerBehaviorSnapshot.captured_at.desc(),
                CustomerBehaviorSnapshot.id.desc()).limit(1).execution_options(populate_existing=True)).first()
        customer, snapshot = pair if pair else (None, None)
    if customer is None:
        failure(404, "CUSTOMER_NOT_FOUND", "Customer not found")
    if not customer.is_active:
        failure(409, "CUSTOMER_INACTIVE", "Select an active customer")
    if lock:
        statement = statement.where(CustomerBehaviorSnapshot.id == source.snapshot_id) if source.snapshot_id else statement.where(
            CustomerBehaviorSnapshot.customer_id == customer.id, CustomerBehaviorSnapshot.captured_at <= now)
        snapshot = db.scalar(statement.order_by(CustomerBehaviorSnapshot.captured_at.desc(), CustomerBehaviorSnapshot.id.desc())
            .limit(1).with_for_update(read=True).execution_options(populate_existing=True))
    if snapshot is None:
        failure(404, "BASELINE_SNAPSHOT_NOT_FOUND", "No eligible baseline snapshot")
    if snapshot.customer_id != customer.id:
        failure(422, "SNAPSHOT_CUSTOMER_MISMATCH", "Snapshot does not belong to this customer")
    if snapshot.captured_at.tzinfo is None or snapshot.captured_at > now:
        failure(422, "INVALID_MODEL_INPUT", "Snapshot timestamp is not eligible")
    names = set().union(*(set(features_for(task, version)) for task, version in selected(payload.models)))
    columns = {f.name: f.column for f in FIELDS}
    raw = {n: getattr(snapshot, columns[n]) for n in names}
    if "Churned" in raw:
        raw["Churned"] = float(raw["Churned"]) if raw["Churned"] is not None else None
    try:
        checked = s.PreviewRequest(contract_version=s.CONTRACT_VERSION, models=payload.models,
                                   baseline={"kind": "features", "features": raw})
    except ValidationError:
        failure(422, "INVALID_MODEL_INPUT", "Snapshot violates What-if feature validation")
    return checked.baseline.features, dict(kind="customer", original_customer_id=str(customer.id), original_snapshot_id=str(snapshot.id))


class PinnedInference:
    def __init__(self, models):
        self.models = models
        self.identities = identities(models)
        self.states = {}
        for task, version in selected(models):
            state = versioned_models.get(task, version)
            try:
                verify_pin(state)  # trusted file checksums, never reload/unpickle in request
            except (ValueError, OSError):
                failure(409, "MODEL_IDENTITY_CHANGED", "Selected model no longer matches its pin")
            self.states[task] = dict(state)
        self.signatures = {task: self.signature(state) for task, state in self.states.items()}

    @staticmethod
    def signature(state):
        return (id(state["pipeline"]), state["artifact_sha256"], state["metadata_sha256"], digest(state["metadata_object"]))

    def verify(self):
        try:
            for task, version in selected(self.models):
                state = versioned_models.get(task, version)
                if self.signature(state) != self.signatures[task]:
                    failure(409, "MODEL_IDENTITY_CHANGED", "Model changed during comparison; retry preview")
                verify_pin(state)
        except (ValueError, OSError):
            failure(409, "MODEL_IDENTITY_CHANGED", "Model pin no longer matches its artifact")

    def predict(self, raw):
        result = {}
        for task, version in selected(self.models):
            self.verify()
            state = self.states[task]
            frame = pd.DataFrame([{n: raw[n] for n in features_for(task, version)}])
            try:
                with np.errstate(over="ignore", invalid="ignore"):
                    transformed = state["pipeline"][:-1].transform(frame)
                    values = transformed.data if hasattr(transformed, "toarray") else np.asarray(transformed)
                    if not np.isfinite(values).all() or (task == "classification" and not np.isfinite(values.astype(np.float32)).all()):
                        failure(422, "NUMERIC_REPRESENTATION_UNSUPPORTED", "Input exceeds model numeric representation")
                output = infer_pinned(task, version, frame.iloc[0].to_dict(), state)
                outcome = {"task": task, "model": self.identities[task]}
                if task == "classification":
                    outcome.update({key: output[key] for key in ("predicted_class", "purchase_level", "probabilities", "decision_rule", "target_thresholds")})
                    result[task] = s.ClassificationOutcome.model_validate(outcome).model_dump(mode="json")
                else:
                    outcome.update({key: output[key] for key in ("cluster", "segment_id", "segment_name", "distance_to_centroid", "distance_kind")})
                    result[task] = s.SegmentationOutcome.model_validate(outcome).model_dump(mode="json")
            except (ValidationError, KeyError, TypeError):
                failure(500, "INTERNAL_ERROR", "Model output failed invariant checks")
            except (ValueError, OverflowError):
                failure(422, "NUMERIC_REPRESENTATION_UNSUPPORTED", "Input cannot be represented by the selected model")
        self.verify()
        return result

    def warnings(self, raw):
        warnings = set(BASE_WARNINGS)
        if self.models.classification == "1.0.0":
            warnings.add("LEGACY_PROXY_FEATURES_UNVERIFIED")
        if any(v is None for v in raw.values()):
            warnings.add("BASELINE_IMPUTED")
        # No inferred domain bounds/statistics from holdout or all-data fits.
        warnings.add("SUPPORT_RANGE_UNKNOWN")
        for task, version in selected(self.models):
            pre = self.states[task]["pipeline"].named_steps.get("preprocessor")
            if pre is not None:
                for _, encoder, columns in pre.transformers_:
                    categories = getattr(encoder, "categories_", None)
                    if categories is None and hasattr(encoder, "named_steps"):
                        categories = getattr(encoder.named_steps.get("encoder"), "categories_", None)
                    if categories is not None and any(raw[n] is not None and raw[n] not in known for n, known in zip(columns, categories)):
                        warnings.add("UNKNOWN_CATEGORY")
            ranges = self.states[task]["metadata_object"].get("training_ranges", {})
            for name, bounds in ranges.items():
                if name in raw and raw[name] is not None and isinstance(bounds, dict):
                    lo, hi = bounds.get("min"), bounds.get("max")
                    if lo is not None and hi is not None and not lo <= raw[name] <= hi:
                        warnings.add("OUTSIDE_TRAINING_SUPPORT")
        return sorted(warnings)


def evaluate(payload, db=None, *, lock=False, compare=True, pinned=None):
    raw, source = resolve(payload, db, lock=lock)
    inference = pinned or PinnedInference(payload.models)
    baseline_result = inference.predict(raw)
    base = dict(contract_version=s.CONTRACT_VERSION, baseline_input=deepcopy(raw),
        baseline_fingerprint=baseline_hash(inference.identities, raw, source), classification=baseline_result["classification"],
        segmentation=baseline_result.get("segmentation"), resolved_customer_id=source["original_customer_id"],
        resolved_snapshot_id=source["original_snapshot_id"], generated_at=datetime.now(timezone.utc).isoformat(),
        warnings=inference.warnings(raw), scope=SCOPE, disclaimer=s.NON_CAUSAL, persisted=False)
    if not compare:
        return s.PreviewResponse.model_validate(base).model_dump(mode="json")
    if payload.expected_baseline_fingerprint and payload.expected_baseline_fingerprint != base["baseline_fingerprint"]:
        failure(409, "BASELINE_CHANGED", "Baseline changed; preview again")
    scenario = {**raw, **payload.changes}
    scenario_results = inference.predict(scenario)
    before, after = base["classification"]["probabilities"], scenario_results["classification"]["probabilities"]
    absolute = {c: after[c] - before[c] for c in s.CLASS_ORDER}
    relative = {c: absolute[c] / before[c] if before[c] > 1e-12 else None for c in s.CLASS_ORDER}
    warnings = set(base["warnings"]) | set(inference.warnings(scenario))
    if any(v is None for v in relative.values()):
        warnings.add("RELATIVE_DELTA_UNDEFINED")
    changed = [dict(feature=n, before=raw[n], after=scenario[n]) for n in s.MUTABLE if raw[n] != scenario[n]]
    if not changed:
        warnings.add("NO_INPUT_CHANGE")
    result = dict(contract_version=s.CONTRACT_VERSION, baseline=base, scenario_input=scenario,
        scenario_classification=scenario_results["classification"], scenario_segmentation=scenario_results.get("segmentation"),
        changed_fields=changed, classification_label_changed=base["classification"]["purchase_level"] != scenario_results["classification"]["purchase_level"],
        probability_deltas=dict(absolute=absolute, percentage_points={c: v * 100 for c, v in absolute.items()}, relative=relative),
        comparison_fingerprint="0" * 64, warnings=sorted(warnings), disclaimer=s.NON_CAUSAL, persisted=False)
    result["comparison_fingerprint"] = comparison_hash(result)
    return s.ComparisonResponse.model_validate(result).model_dump(mode="json")
