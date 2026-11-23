"""Request-scoped account writer boundary; legacy sessions are unaffected."""

from sqlalchemy import event
from backend.models.auth import AuthAuditEvent
from backend.models.customer import Customer, CustomerBehaviorSnapshot
from backend.models.prediction import PredictionRun
from backend.models.scenario import PredictionScenario
from backend.services.account_admin import principal


def replay(db, scenario_id):
    if db.info.get("accounts_writer"):
        db.info.setdefault("accounts_events", {})[
            ("business.replayed", "scenario", scenario_id)
        ] = scenario_id


def bind_writer(db, request):
    service = request.app.state.accounts
    context = request.state.auth_context
    required = request.state.auth_required_caps
    principal(service, db, context, required)
    db.info["accounts_writer"] = True

    def collect(session, flush_context, instances):
        events = session.info.setdefault("accounts_events", {})
        for obj in list(session.new) + list(session.dirty):
            new = obj in session.new
            if not new and not session.is_modified(obj, include_collections=False):
                continue
            resource = (
                "customer"
                if isinstance(obj, Customer)
                else "snapshot"
                if isinstance(obj, CustomerBehaviorSnapshot)
                else "prediction_run"
                if isinstance(obj, PredictionRun)
                else "scenario"
                if isinstance(obj, PredictionScenario)
                else None
            )
            if resource is None or (not new and resource != "customer"):
                continue
            code = "business.created" if new else "business.updated"
            events[(code, resource, id(obj))] = obj

    def commit(session):
        # Flush to allocate UUIDs and detect real changes, but do not commit them.
        session.flush()
        actor, row, _ = principal(service, session, context, required)
        events = session.info.pop("accounts_events", {})
        for (code, resource, _), obj in events.items():
            resource_id = obj if code == "business.replayed" else obj.id
            session.add(
                AuthAuditEvent(
                    event_code=code,
                    outcome="success",
                    actor_user_id=actor.id,
                    session_id=row.id,
                    request_id=request.state.security_request_id,
                    resource_type=resource,
                    resource_id=resource_id,
                    details={},
                )
            )
        session.flush()  # mandatory audit failure aborts the same business tx

    event.listen(db, "before_flush", collect)
    event.listen(db, "before_commit", commit)
    event.listen(
        db, "after_rollback", lambda session: session.info.pop("accounts_events", None)
    )
