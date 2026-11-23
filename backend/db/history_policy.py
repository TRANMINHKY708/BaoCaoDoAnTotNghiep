"""Approved application Session guard, NOT a PostgreSQL trigger/security boundary.

Core Connection/raw SQL and external writers can bypass this policy. No schema,
privilege, FK cascade or retention changes are made here.
"""

from numbers import Integral

from sqlalchemy import event, inspect, select
from sqlalchemy.orm import Session


class HistoryPolicyError(RuntimeError):
    pass


_installed = False


def install_history_policy():
    global _installed
    if _installed:
        return
    from backend.models.customer import CustomerBehaviorSnapshot
    from backend.models.ml import MLModel
    from backend.models.prediction import PredictionResult, PredictionRun, SegmentationResult
    from backend.models.scenario import ScenarioResult

    immutable = (CustomerBehaviorSnapshot, PredictionResult, SegmentationResult, ScenarioResult)
    protected = (*immutable, MLModel, PredictionRun)
    table_names = {cls.__tablename__ for cls in protected}

    def block():
        raise HistoryPolicyError("Historical identity/results cannot be rewritten through the application Session")

    def before_flush(session, flush_context, instances):
        for obj in session.deleted:
            if isinstance(obj, protected):
                block()
        for obj in session.dirty:
            state = inspect(obj)
            changed = {col.key for col in state.mapper.column_attrs if state.attrs[col.key].history.has_changes()}
            if not changed:
                continue
            if isinstance(obj, immutable):
                block()
            if isinstance(obj, MLModel) and changed - {"is_active"}:
                block()
            if isinstance(obj, PredictionRun):
                history = state.attrs.status.history
                previous = history.deleted[0] if history.deleted else obj.status
                if previous != "pending" or changed - {"status", "success_count", "failure_count", "completed_at", "error_message"}:
                    block()
                # The Session may have read pending before another writer
                # finalized it. Lock/recheck DB state, not just identity-map history.
                current = session.connection().execute(select(PredictionRun.status).where(
                    PredictionRun.id == obj.id).with_for_update()).scalar_one()
                if current != "pending":
                    block()
                values = [obj.requested_count, obj.success_count, obj.failure_count]
                if any(not isinstance(v, Integral) or isinstance(v, bool) or v < 0 for v in values):
                    block()
                if obj.status not in {"pending", "completed", "failed"}:
                    block()
                if obj.success_count + obj.failure_count > obj.requested_count:
                    block()
                if obj.status != "pending" and (obj.success_count + obj.failure_count != obj.requested_count or obj.completed_at is None):
                    block()

    def before_execute(state):
        if state.is_update or state.is_delete:
            table = getattr(state.statement, "table", None)
            if table is not None and table.name in table_names:
                # State transitions must use ORM instances so before_flush can
                # compare old/new values. Session bulk DML has no such history.
                block()

    if not event.contains(Session, "before_flush", before_flush):
        event.listen(Session, "before_flush", before_flush)
        event.listen(Session, "do_orm_execute", before_execute)
    _installed = True
