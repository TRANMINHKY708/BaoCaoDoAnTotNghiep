"""Accounts transport and server-owned AUTH-03 capabilities; never Bearer."""

import asyncio
import copy
from email.message import Message
import json
import logging
from pathlib import Path
import re
import time
import threading
from urllib.parse import urlsplit
from uuid import uuid4

from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.concurrency import run_in_threadpool
from starlette.routing import Match

from backend.core.security import strict_json
from backend.core.security_csv import secured_export
from backend.core.account_permissions import OPERATIONS, permitted, operation_for
from backend.services.accounts_service import AuthError

AUTH_PATHS = {
    "/api/v1/auth/" + x for x in ("csrf", "login", "logout", "me", "change-password")
}
UNSAFE = {"POST", "PATCH", "PUT", "DELETE"}
# Admin GETs that accept a query string (strictly parsed by their services); K8 added the audit log.
ADMIN_QUERY_PATHS = {"/api/v1/admin/users", "/api/v1/admin/audit-events", "/api/v1/admin/audit-events/export"}
logger = logging.getLogger("ecommerce.accounts")
INFERENCE_SLOTS = threading.BoundedSemaphore(2)


def set_session_cookie(response, service, token=None, seconds=0):
    options = dict(
        key=service.cookie_name,
        path="/",
        secure=not service.settings.accounts_insecure_loopback,
        httponly=True,
        samesite="strict",
    )
    if token is None:
        response.delete_cookie(**options)
    else:
        response.set_cookie(value=token, max_age=seconds, **options)


def error_response(service, request_id, exc):
    headers = {
        "X-Request-ID": str(request_id),
        "X-Security-Profile": "accounts",
        "Cache-Control": "no-store",
    }
    if exc.retry_after:
        headers["Retry-After"] = str(exc.retry_after)
    response = JSONResponse(
        {
            "error": {
                "code": exc.code,
                "message": "Yêu cầu không thể thực hiện an toàn.",
                "details": [],
                "request_id": str(request_id),
            }
        },
        status_code=exc.status,
        headers=headers,
    )
    if exc.clear_cookie:
        set_session_cookie(response, service)
    return response


class AccountsMiddleware:
    def __init__(self, app, service, routes):
        self.app, self.service, self.routes = app, service, routes

    @staticmethod
    def origin(headers, settings, bootstrap=False):
        value = headers.get(b"origin", [b""])[0].decode("latin1")
        site = headers.get(b"sec-fetch-site", [b""])[0].decode("latin1")
        mode = headers.get(b"sec-fetch-mode", [b""])[0].decode("latin1")
        dest = headers.get(b"sec-fetch-dest", [b""])[0].decode("latin1")
        if bootstrap and (
            site == "cross-site" or mode == "navigate" or dest == "document"
        ):
            raise AuthError(403, "ORIGIN_NOT_ALLOWED")
        if value:
            if value not in settings.security_cors_origins:
                raise AuthError(403, "ORIGIN_NOT_ALLOWED")
        elif not (
            bootstrap
            and site == "same-origin"
            and mode in {"cors", "same-origin"}
            and dest == "empty"
        ):
            raise AuthError(403, "ORIGIN_NOT_ALLOWED")

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        rid = uuid4()
        scope.setdefault("state", {})["security_request_id"] = rid
        headers = {}
        for k, v in scope["headers"]:
            headers.setdefault(k.lower(), []).append(v)
        path, method = scope["path"], scope["method"]
        service, settings = self.service, self.service.settings
        status, started = 500, False
        acquired, export_context = False, None
        admin = path.startswith("/api/v1/admin/")
        operation = None
        required = []
        multipart = (
            headers.get(b"content-type", [b""])[0]
            .lower()
            .startswith(b"multipart/form-data")
        )

        async def safe_send(message):
            nonlocal status, started
            if message["type"] == "http.response.start":
                started, status = True, message["status"]
                extra = {
                    b"x-request-id": str(rid).encode(),
                    b"x-security-profile": b"accounts",
                    b"cache-control": b"no-store",
                    b"x-content-type-options": b"nosniff",
                    b"x-frame-options": b"DENY",
                    b"referrer-policy": b"no-referrer",
                }
                if scope.get("scheme") == "https":
                    extra[b"strict-transport-security"] = b"max-age=31536000"
                if path not in {"/docs", "/redoc", "/docs/oauth2-redirect"}:
                    extra[b"content-security-policy"] = (
                        b"default-src 'none'; frame-ancestors 'none'"
                    )
                message["headers"] = [
                    (k, v)
                    for k, v in message.get("headers", [])
                    if k.lower() not in extra
                ]
                message["headers"].extend(extra.items())
            await send(message)

        try:
            if sum(len(k) + len(v) for k, v in scope["headers"]) > 32768:
                raise AuthError(431, "HEADERS_TOO_LARGE")
            if any(
                len(headers.get(k, [])) > 1
                for k in (
                    b"host",
                    b"origin",
                    b"authorization",
                    b"content-length",
                    b"content-type",
                    b"x-csrf-token",
                )
            ) or (b"transfer-encoding" in headers and b"content-length" in headers):
                raise AuthError(400, "INVALID_REQUEST")
            if method == "GET" and path == "/api/v1/health":
                return await self.app(scope, receive, safe_send)
            try:
                host = urlsplit(
                    "//" + headers.get(b"host", [b""])[0].decode("latin1")
                ).hostname
            except ValueError:
                raise AuthError(400, "INVALID_REQUEST") from None
            if host not in settings.accounts_allowed_hosts or (
                not settings.accounts_insecure_loopback
                and scope.get("scheme") != "https"
            ):
                raise AuthError(400, "INVALID_REQUEST")
            if b"authorization" in headers:
                raise AuthError(401, "UNAUTHORIZED")
            limit = (
                16384
                if path in AUTH_PATHS or admin
                else 65536
                if path.startswith("/api/v1/what-if")
                else settings.security_multipart_bytes
                if multipart
                else settings.security_json_bytes
            )
            size = headers.get(b"content-length", [b""])[0]
            if size and (not size.isdigit() or len(size) > 20):
                raise AuthError(400, "INVALID_REQUEST")
            if size and int(size) > limit:
                raise AuthError(413, "PAYLOAD_TOO_LARGE")
            ip = str((scope.get("client") or ("unknown",))[0])
            service.quotas.check(("ip", ip), 60)
            if (
                path in {"/api/v1/auth/login", "/api/v1/auth/change-password"}
                and method == "POST"
            ) or (admin and method in UNSAFE):
                service.quotas.check(("verify", ip), 10)
            cookie_text = b";".join(headers.get(b"cookie", [])).decode("latin1")
            values = re.findall(
                r"(?:^|;)\s*" + re.escape(service.cookie_name) + r"=([^;]*)",
                cookie_text,
            )
            if len(values) > 1:
                raise AuthError(400, "INVALID_REQUEST")
            raw = (
                values[0]
                if values and re.fullmatch(r"[A-Za-z0-9_-]{43}", values[0])
                else None
            )
            nonce = headers.get(b"x-csrf-token", [b""])[0].decode("latin1")
            scope["state"].update(auth_raw=raw, auth_nonce=nonce)
            if path == "/api/v1/auth/csrf" and method == "GET":
                self.origin(headers, settings, bootstrap=True)
                if headers.get(b"x-requested-with", [b""])[0] != b"MK-eAI":
                    raise AuthError(403, "CSRF_FAILED")
                service.quotas.check(("csrf", ip), 20)
            elif path == "/api/v1/auth/logout" and method == "POST":
                self.origin(headers, settings)
                ctx = await run_in_threadpool(service.retained, raw)
                if (
                    not re.fullmatch(r"[A-Za-z0-9_-]{43}", nonce)
                    or not ctx
                    or not secrets_equal(ctx["csrf_token"], nonce)
                ):
                    raise AuthError(403, "CSRF_FAILED")
            else:
                ctx = await run_in_threadpool(service.resolve, raw)
                if ctx is None or (
                    path != "/api/v1/auth/login" and ctx["state"] != "authenticated"
                ):
                    raise AuthError(
                        401, "UNAUTHORIZED", clear_cookie=path != "/api/v1/auth/login"
                    )
                scope["state"]["auth_context"] = ctx
                if path not in AUTH_PATHS and ctx["user"]["must_change_password"]:
                    raise AuthError(403, "PASSWORD_CHANGE_REQUIRED")
                matched = next(
                    (
                        route
                        for route in self.routes
                        if route.matches(scope)[0] == Match.FULL
                    ),
                    None,
                )
                operation = operation_for(method, path)
                required = (
                    ["users.manage"]
                    if admin
                    else list(operation["required_capabilities"])
                    if operation
                    else []
                )
                if required and not permitted(ctx["user"], required):
                    raise AuthError(403, "FORBIDDEN")
                if (
                    matched
                    and not operation
                    and not admin
                    and path not in AUTH_PATHS
                    and path
                    not in {"/docs", "/redoc", "/openapi.json", "/docs/oauth2-redirect"}
                ):
                    raise AuthError(403, "FORBIDDEN")
                scope["state"]["auth_required_caps"] = required
                if method in UNSAFE:
                    self.origin(headers, settings)
                    if not re.fullmatch(
                        r"[A-Za-z0-9_-]{43}", nonce
                    ) or not secrets_equal(ctx["csrf_token"], nonce):
                        raise AuthError(403, "CSRF_FAILED")
                if path == "/api/v1/auth/login" and ctx["state"] == "authenticated":
                    raise AuthError(409, "ALREADY_AUTHENTICATED")
                if ctx["user"]:
                    service.quotas.check(("user", str(ctx["user_id"])), 60)
            if path in AUTH_PATHS or admin:
                if b"idempotency-key" in headers:
                    raise AuthError(400, "UNSUPPORTED_IDEMPOTENCY_KEY")
                if scope.get("query_string") and not (
                    admin and method == "GET" and path in ADMIN_QUERY_PATHS
                ):
                    raise AuthError(422, "VALIDATION_ERROR")
            if (
                path in AUTH_PATHS
                or admin
                or method in UNSAFE
                or b"content-length" in headers
                or b"transfer-encoding" in headers
            ):
                body, length = [], 0
                deadline = time.monotonic() + 10
                while True:
                    try:
                        event = await asyncio.wait_for(
                            receive(), max(0, deadline - time.monotonic())
                        )
                    except TimeoutError:
                        raise AuthError(408, "REQUEST_TIMEOUT") from None
                    if event["type"] == "http.disconnect":
                        return
                    chunk = event.get("body", b"")
                    length += len(chunk)
                    if length > limit:
                        raise AuthError(413, "PAYLOAD_TOO_LARGE")
                    body.append(chunk)
                    if not event.get("more_body", False):
                        break
                data = b"".join(body)
                if method == "GET" and data and (path in AUTH_PATHS or admin):
                    raise AuthError(400, "INVALID_REQUEST")
                parsed = {}
                if data and multipart and (path in AUTH_PATHS or admin):
                    raise AuthError(415, "UNSUPPORTED_MEDIA_TYPE")
                if data and not multipart:
                    content = Message()
                    content["Content-Type"] = headers.get(b"content-type", [b""])[
                        0
                    ].decode("latin1")
                    charsets = [
                        v for k, v in content.get_params([]) if k.lower() == "charset"
                    ]
                    if (
                        content.get_content_type() != "application/json"
                        or len(charsets) > 1
                        or any(v.lower() != "utf-8" for v in charsets)
                    ):
                        raise AuthError(415, "UNSUPPORTED_MEDIA_TYPE")
                    try:
                        parsed = strict_json(data)
                    except (ValueError, UnicodeError, RecursionError):
                        raise AuthError(400, "INVALID_JSON") from None

                    def depth(value, n=0):
                        if n > (
                            8
                            if path in AUTH_PATHS
                            or admin
                            or path.startswith("/api/v1/what-if")
                            else 32
                        ):
                            raise AuthError(422, "VALIDATION_ERROR")
                        if isinstance(value, dict):
                            for v in value.values():
                                depth(v, n + 1)
                        elif isinstance(value, list):
                            for v in value:
                                depth(v, n + 1)

                    depth(parsed)
                if (
                    operation
                    and operation["conditional_save"]
                    and isinstance(parsed, dict)
                ):
                    flag = operation["conditional_save"]["flag"]
                    from pydantic import TypeAdapter, ValidationError

                    try:
                        saving = TypeAdapter(bool).validate_python(
                            parsed.get(flag, False)
                        )
                    except ValidationError:
                        saving = True  # fail closed before business parsing
                    if saving:
                        required += operation["conditional_save"]["when_true_requires"]
                        if not permitted(ctx["user"], required):
                            raise AuthError(403, "FORBIDDEN")
                scope["state"].update(auth_json=parsed, auth_ip=ip)
                original_receive, delivered = receive, False

                async def replay():
                    nonlocal delivered
                    if not delivered:
                        delivered = True
                        return {
                            "type": "http.request",
                            "body": data,
                            "more_body": False,
                        }
                    return await original_receive()

                receive = replay
            if operation and method in UNSAFE:
                scope["state"]["auth_required_caps"] = required
                scope["state"]["auth_writer"] = (
                    any(
                        x in required
                        for x in (
                            "customers.write",
                            "snapshots.create",
                            "analysis.legacy.save",
                            "what_if.legacy.save",
                        )
                    )
                    or "inference.csv.run" in required
                )
            category = (
                "csv"
                if "/predict/csv/" in path
                else "what_if"
                if path.startswith("/api/v1/what-if") and method == "POST"
                else "prediction"
                if "/predict/" in path and method == "POST"
                else None
            )
            if category:
                service.quotas.check(
                    (category, str(ctx["user_id"])),
                    {"csv": 5, "prediction": 20, "what_if": 30}[category],
                )
                acquired = INFERENCE_SLOTS.acquire(blocking=False)
                if not acquired:
                    raise AuthError(503, "SERVER_BUSY", retry_after=1)
            export_context = secured_export.set(True)
            await self.app(scope, receive, safe_send)
        except AuthError as exc:
            if not started:
                await error_response(service, rid, exc)(scope, receive, safe_send)
        except SQLAlchemyError as exc:
            code = (
                "SERVER_BUSY"
                if getattr(getattr(exc, "orig", None), "sqlstate", None) == "55P03"
                else "AUTH_UNAVAILABLE"
            )
            if not started:
                await error_response(
                    service,
                    rid,
                    AuthError(
                        503, code, retry_after=1 if code == "SERVER_BUSY" else None
                    ),
                )(scope, receive, safe_send)
        except Exception:
            if not started:
                await error_response(service, rid, AuthError(500, "INTERNAL_ERROR"))(
                    scope, receive, safe_send
                )
        finally:
            if acquired:
                INFERENCE_SLOTS.release()
            if export_context is not None:
                secured_export.reset(export_context)
            logger.info(
                "auth_request", extra={"request_id": str(rid), "status": status}
            )


def secrets_equal(a, b):
    import hmac

    return hmac.compare_digest(a, b)


def install_accounts_openapi(app):
    original = app.openapi
    fragment = json.loads(
        (
            Path(__file__).resolve().parents[1] / "contracts" / "auth03_openapi.json"
        ).read_text(encoding="utf-8")
    )

    def generate():
        if app.openapi_schema is not None:
            return app.openapi_schema
        spec = original()
        spec["x-security-profile"] = "accounts"
        spec["x-auth02-business-enabled"] = True
        spec["x-auth03-admin-implemented"] = True
        for kind, values in fragment["components"].items():
            spec.setdefault("components", {}).setdefault(kind, {}).update(
                copy.deepcopy(values)
            )
        for path, item in spec["paths"].items():
            for method, operation in item.items():
                if not isinstance(operation, dict) or "operationId" not in operation:
                    continue
                operation["security"] = (
                    []
                    if (method, path) == ("get", "/api/v1/health")
                    else [{"AccountSession": []}]
                )
                if path not in AUTH_PATHS and path != "/api/v1/health":
                    if method.upper() in UNSAFE:
                        operation.setdefault("parameters", []).extend(
                            [
                                {"$ref": "#/components/parameters/Auth01Origin"},
                                {"$ref": "#/components/parameters/Auth01Csrf"},
                            ]
                        )
                    operation["x-required-capabilities"] = OPERATIONS.get(
                        (method.upper(), path), {}
                    ).get("required_capabilities", [])
                    for code in (401, 403, 429, 503):
                        operation["responses"].setdefault(
                            str(code),
                            {
                                "description": "Accounts authorization",
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "$ref": "#/components/schemas/Auth01ErrorEnvelope"
                                        }
                                    }
                                },
                            },
                        )
        spec["paths"].update(copy.deepcopy(fragment["paths"]))
        app.openapi_schema = spec
        return spec

    app.openapi = generate
