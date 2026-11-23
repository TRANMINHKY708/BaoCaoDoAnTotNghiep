"""K8 read-only audit log for Admins (accounts profile). No writes, no secrets.

Events come from `auth_audit_events` (written since AUTH-02). Pagination is keyset on
(occurred_at, id) descending, served by the `ix_auth_audit_time` index.
"""

import base64
import binascii
import json
import re
from datetime import date, datetime, time, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import and_, or_, select, tuple_
from sqlalchemy.orm import aliased

from backend.models.auth import AuthAuditEvent, User
from backend.services.account_admin import principal
from backend.services.accounts_service import AuthError

CATEGORIES = {"auth": "auth.", "users": "user.", "business": "business."}
OUTCOMES = {"success", "denied", "failure"}
TIMEZONES = {"UTC": ZoneInfo("UTC"), "Asia/Ho_Chi_Minh": ZoneInfo("Asia/Ho_Chi_Minh")}
ALLOWED = {"user_id", "category", "outcome", "date_from", "date_to", "timezone", "limit", "cursor"}
DEFAULT_LIMIT, MAX_LIMIT = 50, 100


def invalid():
    raise AuthError(422, "VALIDATION_ERROR")


def encode_cursor(occurred_at, event_id):
    raw = json.dumps([occurred_at.isoformat(), str(event_id)], separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode_cursor(value):
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,200}", value):
        invalid()
    try:
        moment, event_id = json.loads(base64.urlsafe_b64decode(value + "=" * (-len(value) % 4)))
        moment = datetime.fromisoformat(moment)
        if moment.tzinfo is None:
            invalid()
        return moment, UUID(event_id)
    except (ValueError, TypeError, binascii.Error, json.JSONDecodeError):
        invalid()


def audit_query(query):
    """Strict query parsing: unknown or repeated keys are rejected."""
    if set(query) - ALLOWED or any(len(query.getlist(k)) != 1 for k in query):
        invalid()
    values = {"category": query.get("category"), "outcome": query.get("outcome")}
    if values["category"] not in {None, *CATEGORIES} or values["outcome"] not in {None, *OUTCOMES}:
        invalid()
    try:
        values["user_id"] = UUID(query["user_id"]) if "user_id" in query else None
    except ValueError:
        invalid()
    zone = query.get("timezone", "UTC")
    if zone not in TIMEZONES:
        invalid()
    values["timezone"] = zone
    for key in ("date_from", "date_to"):
        raw = query.get(key)
        if raw is not None and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
            invalid()
        try:
            values[key] = date.fromisoformat(raw) if raw else None
        except ValueError:
            invalid()
    if values["date_from"] and values["date_to"] and values["date_from"] > values["date_to"]:
        invalid()
    raw = query.get("limit", str(DEFAULT_LIMIT))
    if not raw.isascii() or not raw.isdigit() or len(raw) > 3 or not 1 <= int(raw) <= MAX_LIMIT:
        invalid()
    values["limit"] = int(raw)
    values["cursor"] = decode_cursor(query["cursor"]) if "cursor" in query else None
    return values


def person(user):
    if user is None:
        return None
    return {"id": str(user.id), "username": user.username, "display_name": user.display_name, "role": user.role}


def conditions(query):
    """Filters shared by the paged log and the export, so a file always matches the screen."""
    filters = []
    if query["user_id"]:
        filters.append(or_(AuthAuditEvent.actor_user_id == query["user_id"],
                           AuthAuditEvent.subject_user_id == query["user_id"]))
    if query["category"]:
        filters.append(AuthAuditEvent.event_code.startswith(CATEGORIES[query["category"]]))
    if query["outcome"]:
        filters.append(AuthAuditEvent.outcome == query["outcome"])
    zone = TIMEZONES[query["timezone"]]
    if query["date_from"]:
        filters.append(AuthAuditEvent.occurred_at >= datetime.combine(query["date_from"], time.min, zone))
    if query["date_to"]:
        end = datetime.combine(query["date_to"] + timedelta(days=1), time.min, zone)
        filters.append(AuthAuditEvent.occurred_at < end)
    return filters


EXPORT_LIMIT = 5000
EXPORT_KEYS = {"user_id", "category", "outcome", "date_from", "date_to", "timezone"}


def export_query(query):
    """The paged-log filters without paging: cursor and limit are not accepted for a file."""
    if set(query) - EXPORT_KEYS:
        invalid()
    return audit_query(query)


class AuditLogService:
    def __init__(self, service):
        self.service = service

    def export(self, context, query):
        """Newest first, at most EXPORT_LIMIT events; returns (events, more_exist, the filtered person)."""
        with self.service.transaction() as db:
            principal(self.service, db, context, ["users.manage"])
            actor, subject = aliased(User), aliased(User)
            filters = conditions(query)
            rows = db.execute(
                select(AuthAuditEvent, actor, subject)
                .outerjoin(actor, actor.id == AuthAuditEvent.actor_user_id)
                .outerjoin(subject, subject.id == AuthAuditEvent.subject_user_id)
                .where(and_(*filters) if filters else True)
                .order_by(AuthAuditEvent.occurred_at.desc(), AuthAuditEvent.id.desc())
                .limit(EXPORT_LIMIT + 1)
            ).all()
            who = db.get(User, query["user_id"]) if query["user_id"] else None
            events = [
                {
                    "occurred_at": event.occurred_at,
                    "event_code": event.event_code,
                    "category": next(k for k, prefix in CATEGORIES.items() if event.event_code.startswith(prefix)),
                    "outcome": event.outcome,
                    "actor": person(a),
                    "subject": person(s),
                    "resource_type": event.resource_type,
                    "resource_id": str(event.resource_id) if event.resource_id else None,
                    "request_id": str(event.request_id),
                }
                for event, a, s in rows[:EXPORT_LIMIT]
            ]
            return events, len(rows) > EXPORT_LIMIT, person(who)

    def read(self, context, query):
        service = self.service
        with service.transaction() as db:
            principal(service, db, context, ["users.manage"])
            actor, subject = aliased(User), aliased(User)
            filters = conditions(query)
            if query["cursor"]:
                filters.append(tuple_(AuthAuditEvent.occurred_at, AuthAuditEvent.id) < tuple_(*query["cursor"]))
            rows = db.execute(
                select(AuthAuditEvent, actor, subject)
                .outerjoin(actor, actor.id == AuthAuditEvent.actor_user_id)
                .outerjoin(subject, subject.id == AuthAuditEvent.subject_user_id)
                .where(and_(*filters) if filters else True)
                .order_by(AuthAuditEvent.occurred_at.desc(), AuthAuditEvent.id.desc())
                .limit(query["limit"] + 1)
            ).all()
            more = len(rows) > query["limit"]
            rows = rows[: query["limit"]]
            items = [
                {
                    "id": str(event.id),
                    "occurred_at": event.occurred_at.isoformat(),
                    "event_code": event.event_code,
                    "category": next(k for k, prefix in CATEGORIES.items() if event.event_code.startswith(prefix)),
                    "outcome": event.outcome,
                    "actor": person(who),
                    "subject": person(target),
                    "resource_type": event.resource_type,
                    "resource_id": str(event.resource_id) if event.resource_id else None,
                    "request_id": str(event.request_id),
                }
                for event, who, target in rows
            ]
            last = rows[-1][0] if rows else None
            return {
                "items": items,
                "limit": query["limit"],
                "next_cursor": encode_cursor(last.occurred_at, last.id) if more and last else None,
                "timezone": query["timezone"],
            }
