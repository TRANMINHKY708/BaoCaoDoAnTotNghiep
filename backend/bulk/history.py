"""Application-only immutability for the new F09 ledger; no old table policies changed."""

from sqlalchemy import event, inspect, select
from sqlalchemy.orm import Session

from backend.db.history_policy import HistoryPolicyError
from backend.models.bulk import (
    F09_TABLES,
    BulkImportJob,
    BulkImportRow,
    CustomerSourceIdentity,
)


def install():
    def before_flush(db, *_):
        for value in db.deleted:
            if isinstance(
                value, (BulkImportJob, BulkImportRow, CustomerSourceIdentity)
            ):
                raise HistoryPolicyError("F09 history cannot be deleted")
        for value in db.dirty:
            if not isinstance(
                value, (BulkImportJob, BulkImportRow, CustomerSourceIdentity)
            ):
                continue
            state = inspect(value)
            changes = {
                c.key
                for c in state.mapper.column_attrs
                if state.attrs[c.key].history.has_changes()
            }
            if not changes:
                continue
            if not isinstance(value, BulkImportJob) or changes - {
                "status",
                "counts",
                "error_code",
                "error_row",
                "completed_at",
            }:
                raise HistoryPolicyError("F09 identity/row history is immutable")
            previous = db.connection().scalar(
                select(BulkImportJob.status)
                .where(BulkImportJob.id == value.id)
                .with_for_update()
            )
            if (
                previous != "pending"
                or value.status not in {"completed", "failed"}
                or value.completed_at is None
            ):
                raise HistoryPolicyError("F09 terminal jobs are immutable")

    def before_execute(state):
        if (state.is_update or state.is_delete) and getattr(
            getattr(state.statement, "table", None), "name", None
        ) in F09_TABLES:
            raise HistoryPolicyError("F09 bulk updates/deletes are not allowed")

    event.listen(Session, "before_flush", before_flush)
    event.listen(Session, "do_orm_execute", before_execute)
