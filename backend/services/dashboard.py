"""Read-only snapshot analytics. Never infers, registers, repairs or persists."""
import hashlib
import json
import re
from contextlib import contextmanager
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException, Request
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from backend.db.session import get_engine
from backend.services.dashboard_sql import AGGREGATE_SQL
from backend.services.model_service import PROJECT_ROOT
from backend.services.versioned_models import MODEL_NAMES, failure, versioned_models

CLASS_ORDER = ["Low", "Medium", "High"]
QUERY_NAMES = {"timezone", "date_from", "date_to", "classification_model_version", "segmentation_model_version", "segment_id", "table_limit"}


@contextmanager
def read_transaction(engine):
    """Settings are transaction-local; close rolls back on every exit path."""
    with engine.connect().execution_options(isolation_level="REPEATABLE READ") as conn, conn.begin():
        conn.execute(text("SET TRANSACTION READ ONLY"))
        conn.execute(text("SET LOCAL statement_timeout = '5000ms'"))
        yield conn


def get_dashboard_connection(request: Request = None):
    try:
        engine = request.app.state.accounts.engine if request is not None and request.app.state.settings.security_profile == "accounts" else get_engine()
    except RuntimeError:
        failure(503, "DATABASE_UNAVAILABLE", "Database operation is unavailable")
    try:
        with read_transaction(engine) as conn:
            yield conn
    except SQLAlchemyError as exc:
        code = getattr(exc.orig, "sqlstate", None)
        timeout = code == "57014"
        raise HTTPException(503, detail={
            "code": "DASHBOARD_QUERY_TIMEOUT" if timeout else "DATABASE_UNAVAILABLE",
            "message": "Dashboard query timed out" if timeout else "Database operation is unavailable",
        }, headers={"Retry-After": "1"} if timeout else None) from None


def parse_query(items):
    result = {}
    for key, value in items:
        if key not in QUERY_NAMES or key in result or not value or value.strip() != value or value.lower() == "null":
            failure(422, "VALIDATION_ERROR", "Invalid dashboard query")
        result[key] = value
    if result.get("timezone", "UTC") not in {"UTC", "Asia/Ho_Chi_Minh"}:
        failure(422, "VALIDATION_ERROR", "Unsupported dashboard timezone")
    if ("date_from" in result) != ("date_to" in result):
        failure(422, "VALIDATION_ERROR", "Both calendar dates must be provided")
    for key in ("date_from", "date_to"):
        if key in result:
            try:
                if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", result[key]):
                    raise ValueError()
                result[key] = date.fromisoformat(result[key])
            except ValueError:
                failure(422, "VALIDATION_ERROR", "Invalid calendar date")
    limit = result.get("table_limit", "10")
    if not re.fullmatch(r"[0-9]{1,2}", limit) or not 1 <= int(limit) <= 20:
        failure(422, "VALIDATION_ERROR", "Table limit must be an integer from 1 to 20")
    result["table_limit"] = int(limit)
    for task in ("classification", "segmentation"):
        key = f"{task}_model_version"
        result[key] = result.get(key, "1.0.0")
        if len(result[key]) > 50:
            failure(422, "VALIDATION_ERROR", "Invalid model version")
        versioned_models.get(task, result[key], require_available=False)
    segments = segment_ids(result["segmentation_model_version"])
    if result.get("segment_id") is not None and result["segment_id"] not in segments:
        failure(422, "INVALID_SEGMENT_FILTER", "Segment does not belong to the selected model version")
    return result


def segment_ids(version):
    return ([f"legacy:1.0.0:cluster:{i}" for i in range(3)] if version == "1.0.0"
            else ["engagement_low", "engagement_medium", "engagement_high"])


def resolve_window(query, as_of):
    zone = UTC if query.get("timezone", "UTC") == "UTC" else ZoneInfo("Asia/Ho_Chi_Minh")
    today = as_of.astimezone(zone).date()
    start = query.get("date_from", today - timedelta(days=29))
    end = query.get("date_to", today + timedelta(days=1))
    if not 1 <= (end - start).days <= 366 or end > today + timedelta(days=1) or start > today:
        failure(422, "VALIDATION_ERROR", "Invalid calendar date range (1 to 366 days)")
    return start, end, datetime.combine(start, time(), zone), min(datetime.combine(end, time(), zone), as_of)


def expected_registry_metadata(state):
    """Verify metadata identity even if inference is offline; never deserialize a model.

    Only catalog-pinned local JSON is inspected. Missing dictionary remains a
    warning, not a forced inference dependency or a fallback to another version.
    """
    if state["metadata_object"] is not None:
        return state["metadata_object"]
    path = (PROJECT_ROOT / state["metadata"]).resolve()
    if not path.is_relative_to(PROJECT_ROOT.resolve()):
        return None
    try:
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != state["metadata_sha256"]:
            return None
        value = json.loads(raw)
        return value if isinstance(value, dict) else None
    except (OSError, ValueError):
        return None


def overview(conn, query):
    as_of = conn.scalar(text("SELECT transaction_timestamp()"))
    start_date, end_date, start, end = resolve_window(query, as_of)
    states = {task: versioned_models.get(task, query[f"{task}_model_version"], require_available=False)
              for task in ("classification", "segmentation")}
    registries = conn.execute(text("SELECT name, task, version, artifact_checksum, metadata_json FROM ml_models "
                                   "WHERE (name = :cn AND version = :cv) OR (name = :sn AND version = :sv)"),
                              {"cn": MODEL_NAMES["classification"], "cv": query["classification_model_version"],
                               "sn": MODEL_NAMES["segmentation"], "sv": query["segmentation_model_version"]}).mappings().all()
    for row in registries:
        task = next(t for t in states if MODEL_NAMES[t] == row["name"])
        state = states[task]
        if row["task"] != task or row["artifact_checksum"] != state["artifact_sha256"]:
            failure(409, "MODEL_REGISTRY_MISMATCH", "Stored model identity differs from the pinned catalog")
        # An unavailable inference artifact must not prevent valid historical reads.
        expected_metadata = expected_registry_metadata(state)
        if expected_metadata is not None and row["metadata_json"] != expected_metadata:
            failure(409, "MODEL_REGISTRY_MISMATCH", "Stored model metadata differs from the pinned catalog")
    ids = segment_ids(query["segmentation_model_version"])
    cluster = ids.index(query["segment_id"]) if query.get("segment_id") is not None else None
    data = conn.scalar(text(AGGREGATE_SQL), {
        "start": start, "end": end, "date_from": start_date, "date_to": end_date,
        "timezone": query.get("timezone", "UTC"),
        "today": as_of.astimezone(ZoneInfo(query.get("timezone", "UTC"))).date(), "cluster": cluster, "limit": query["table_limit"],
        "cname": MODEL_NAMES["classification"], "cversion": query["classification_model_version"],
        "sname": MODEL_NAMES["segmentation"], "sversion": query["segmentation_model_version"],
    })
    if any(not states[task]["default"] and data["research_rows"][i] for i, task in enumerate(states)):
        failure(409, "MODEL_PERSISTENCE_POLICY_MISMATCH", "Unexpected persisted research results require investigation")
    if data["invalid"]:
        failure(409, "DASHBOARD_DATA_INTEGRITY_ERROR", "Stored results violate dashboard integrity rules")
    warnings = ["CURRENT_CUSTOMERS_NOT_HISTORICAL_POPULATION"]
    if end_date > as_of.astimezone(ZoneInfo(query.get("timezone", "UTC"))).date():
        warnings.append("PARTIAL_CURRENT_DAY")
    if any(not s["default"] for s in states.values()):
        warnings.append("RESEARCH_PERSISTENCE_UNSUPPORTED")
    if any(s["pipeline"] is None for s in states.values()):
        warnings.append("INFERENCE_MODEL_UNAVAILABLE")
    labels = (states["segmentation"]["metadata_object"] or {}).get("cluster_names", {})
    labels = {i: labels.get(str(i)) for i in range(3)}
    if not all(isinstance(v, str) and 1 <= len(v) <= 150 for v in labels.values()):
        warnings.append("SEGMENT_LABELS_UNAVAILABLE")
        labels = {i: v if isinstance(v, str) and 1 <= len(v) <= 150 else None for i, v in labels.items()}
    panels = {}
    for task, state in states.items():
        raw = data[task]
        n = raw["with_result"]
        panel = {"model": {"task": task, "model_id": MODEL_NAMES[task], "model_version": state["version"],
                           "artifact_sha256": state["artifact_sha256"], "available_for_inference": state["pipeline"] is not None,
                           "persistence_supported": state["default"]},
                 "stored_results": {"total": raw["total"], "linked": raw["linked"],
                                    "unlinked": raw["total"] - raw["linked"], "excluded_unlinked": raw["excluded"]},
                 "customers": {"with_result": n, "without_result": data["cohort"] - n},
                 "distribution": [], "latest_result_at": raw["latest"]}
        for i, count in enumerate(raw["counts"]):
            entry = {"customers": count, "share": count / n if n else None}
            entry.update({"purchase_level": CLASS_ORDER[i]} if task == "classification"
                         else {"cluster": i, "segment_id": ids[i], "display_label": labels[i]})
            panel["distribution"].append(entry)
        if task == "classification":
            panel["mean_probabilities"] = raw["means"]
        panels[task] = panel
    if any(p["stored_results"]["unlinked"] for p in panels.values()):
        warnings.append("UNLINKED_RESULTS_NOT_CUSTOMERS")
    if any(p["stored_results"]["excluded_unlinked"] for p in panels.values()):
        warnings.append("UNLINKED_RESULTS_EXCLUDED_BY_SEGMENT_FILTER")
    if data["what_if"]["excluded_unlinked_scenarios"]:
        warnings.append("UNLINKED_SCENARIOS_EXCLUDED_BY_SEGMENT_FILTER")
    for item in data["recent"]:
        seg = item["segment_in_window"]
        if seg is not None:
            i = seg.pop("cluster")
            seg.update(segment_id=ids[i], display_label=labels[i])
    return {
        "contract_version": "dashboard-snapshot-v1", "generated_at": datetime.now(UTC).isoformat(),
        "as_of": as_of.isoformat(), "source": "application_postgresql_not_research_dataset",
        "scope": "stored_snapshot_analysis_not_causal_or_future", "purchase_level_source": "stored_model_prediction_not_ground_truth",
        "target_thresholds": {"low_inclusive": 10, "medium_inclusive": 15},
        "filters": {"date_from": start_date.isoformat(), "date_to": end_date.isoformat(), "window_start": start.isoformat(),
                    "window_end": end.isoformat(), "timezone": query.get("timezone", "UTC"), "classification_model_version": states["classification"]["version"],
                    "segmentation_model_version": states["segmentation"]["version"], "segment_id": query.get("segment_id")},
        "workspace_totals": {"filter_scope": "all_workspace_as_of_not_filtered", **data["workspace"]},
        "cohort": {"customers": data["cohort"], "include_inactive": True,
                   "selection_rule": "all_current_customers" if cluster is None else "latest_linked_segmentation_in_window"},
        **panels, "what_if": {**data["what_if"], "filter_scope": "window_and_cohort_not_model_selectors", "integrity": "counts_only_not_verified"},
        "activity_by_day": data["activity"], "recent_customers": {"selection_rule": "cohort_customer_created_at_desc_id_desc",
             "limit": query["table_limit"], "cohort_total": data["cohort"], "items": data["recent"]}, "warnings": warnings,
    }
