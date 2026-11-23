"""Opt-in, single-workspace security. No users, ownership or database migration."""
import asyncio
from collections import OrderedDict, deque
import hashlib
import hmac
import json
import logging
import math
import threading
import time
from http import HTTPStatus
from uuid import uuid4

from backend.core.security_csv import secured_export

logger = logging.getLogger("ecommerce.security")
PUBLIC = {("GET", "/api/v1/health")}
READ_POST = {"/predict/purchase-level", "/predict/segment", "/predict/batch/purchase-level", "/predict/batch/segment",
             "/api/v1/predict/purchase-level", "/api/v1/predict/segment", "/api/v1/predict/batch/purchase-level",
             "/api/v1/predict/batch/segment", "/api/v1/what-if", "/api/v1/what-if/preview",
             "/api/v1/churn/predict", "/api/v1/churn/predict/batch"}  # K5: inference only, never saved


class SafeServerLogFilter(logging.Filter):
    """Do not serialize URLs/query strings, client addresses or exception objects."""
    def filter(self, record):
        if record.name.startswith("uvicorn.access"):
            record.msg, record.args = "http_access_redacted", ()
        elif record.exc_info or record.stack_info or record.name.startswith("sqlalchemy."):
            record.msg, record.args = "server_event_redacted", ()
        record.exc_info = record.exc_text = record.stack_info = None
        return True


def install_log_redaction():
    for name in ("uvicorn.access", "uvicorn.error", "sqlalchemy.engine.Engine", "sqlalchemy.engine.Connection",
                 "sqlalchemy.pool.impl.QueuePool", "sqlalchemy.pool.impl.AsyncAdaptedQueuePool"):
        target = logging.getLogger(name)
        if not any(isinstance(f, SafeServerLogFilter) for f in target.filters):
            target.addFilter(SafeServerLogFilter())


class WindowLimiter:
    """Thread-safe bounded process-local windows; never evict active identities."""
    def __init__(self, capacity=4096, clock=time.monotonic):
        self.capacity, self.clock = capacity, clock
        self.entries = OrderedDict()
        self.lock = threading.Lock()

    def allow(self, key, limit):
        with self.lock:
            now = self.clock()
            # All windows have the same retention, so insertion/LRU order is safe.
            for old in list(self.entries):
                q = self.entries[old]
                while q and q[0] <= now - 60:
                    q.popleft()
                if not q:
                    del self.entries[old]
            if key not in self.entries and len(self.entries) >= self.capacity:
                return False
            q = self.entries.setdefault(key, deque())
            if len(q) >= limit:
                return False
            q.append(now)
            return True


def strict_json(body):
    def pairs(items):
        out = {}
        for key, value in items:
            if key in out:
                raise ValueError("Duplicate key")
            out[key] = value
        return out
    def constant(_):
        raise ValueError("Nonfinite")
    def check(value, depth=0):
        if depth > 32:
            raise ValueError("Nesting")
        if isinstance(value, float) and not math.isfinite(value):
            raise ValueError("Nonfinite")
        if isinstance(value, str):
            value.encode("utf-8")
        if isinstance(value, dict):
            for k, v in value.items():
                check(k, depth + 1); check(v, depth + 1)
        elif isinstance(value, list):
            for v in value:
                check(v, depth + 1)
    result = json.loads(body.decode("utf-8"), object_pairs_hook=pairs, parse_constant=constant)
    check(result)
    return result


class SecurityMiddleware:
    def __init__(self, app, settings):
        self.app, self.settings = app, settings
        self.limiter = WindowLimiter()
        self.auth_limiter = WindowLimiter()
        self.slots = threading.BoundedSemaphore(settings.security_max_inflight)
        self.credentials = [(role, secret.get_secret_value().encode("ascii")) for role, secret in
                            (("viewer", settings.security_viewer_token), ("operator", settings.security_operator_token))]

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        started, request_id, status = time.monotonic(), str(uuid4()), 500
        scope.setdefault("state", {})["security_request_id"] = request_id
        headers = {}
        for k, v in scope["headers"]:
            headers.setdefault(k.lower(), []).append(v)
        path, method = scope["path"], scope["method"]
        response_started, response_complete = False, False
        async def safe_send(message):
            nonlocal status, response_started, response_complete
            if message["type"] == "http.response.start":
                response_started, status = True, message["status"]
                protected_headers = {b"x-content-type-options": b"nosniff", b"x-frame-options": b"DENY",
                    b"referrer-policy": b"no-referrer", b"cache-control": b"no-store",
                    b"x-security-profile": b"secured", b"x-request-id": str(scope["state"].get("request_id", request_id)).encode()}
                # T11 approved, server-verified shared role; never infer role from a client header.
                if scope["state"].get("security_role") in {"viewer", "operator"}:
                    protected_headers[b"x-workspace-role"] = scope["state"]["security_role"].encode("ascii")
                if path not in {"/docs", "/redoc", "/docs/oauth2-redirect"}:
                    protected_headers[b"content-security-policy"] = b"default-src 'none'; frame-ancestors 'none'"
                if scope.get("scheme") == "https":
                    protected_headers[b"strict-transport-security"] = b"max-age=31536000"
                message["headers"] = [(k, v) for k, v in message.get("headers", []) if k.lower() not in protected_headers]
                message["headers"].extend(protected_headers.items())
            if message["type"] == "http.response.body" and not message.get("more_body", False):
                response_complete = True
            await send(message)
        async def error(code, name, message, retry=False):
            extra = [(b"content-type", b"application/json"), (b"www-authenticate", b"Bearer")] if code == 401 else [(b"content-type", b"application/json")]
            if retry: extra.append((b"retry-after", b"60" if code == 429 else b"1"))
            data = json.dumps({"error": {"code": name, "message": message, "details": [], "request_id": request_id}}).encode()
            await safe_send({"type": "http.response.start", "status": code, "headers": extra + [(b"content-length", str(len(data)).encode())]})
            await safe_send({"type": "http.response.body", "body": data})
        acquired, context = False, None
        try:
            if sum(len(k) + len(v) for k, v in scope["headers"]) > 32768:
                return await error(431, "HEADERS_TOO_LARGE", "Request headers exceed the configured limit")
            if len(headers.get(b"content-type", [])) > 1 or (b"transfer-encoding" in headers and b"content-length" in headers):
                return await error(400, "INVALID_REQUEST", "Ambiguous request framing is forbidden")
            if (method, path) not in PUBLIC:
                auth = headers.get(b"authorization", [])
                role = None
                if len(auth) == 1 and len(auth[0]) <= 140:
                    scheme, sep, candidate = auth[0].partition(b" ")
                    if sep and scheme.lower() == b"bearer":
                        for known_role, token in self.credentials:
                            if hmac.compare_digest(candidate, token): role = known_role
                if role is None:
                    ip = (scope.get("client") or ("unknown",))[0]
                    key = ("failed_auth", hashlib.sha256(str(ip).encode()).digest())
                    if not self.auth_limiter.allow(key, self.settings.security_auth_failures_per_minute):
                        return await error(429, "RATE_LIMITED", "Too many authentication attempts", True)
                    return await error(401, "UNAUTHORIZED", "A valid Bearer credential is required")
                scope["state"]["security_role"] = role
                identity = role  # Two shared credentials, not per-user accounts.
                category = "csv" if "/predict/csv/" in path else "what_if" if path.startswith("/api/v1/what-if") and method == "POST" else "prediction" if "/predict/" in path or path == "/api/v1/churn/predict" else "general"
                cap = {"csv": self.settings.security_csv_per_minute, "what_if": self.settings.security_what_if_per_minute,
                       "prediction": self.settings.security_prediction_per_minute, "general": self.settings.security_requests_per_minute}[category]
                if not self.limiter.allow((identity, "all"), self.settings.security_requests_per_minute) or (category != "general" and not self.limiter.allow((identity, category), cap)):
                    return await error(429, "RATE_LIMITED", "Request quota exceeded", True)
                if role == "viewer" and method not in {"GET", "HEAD", "OPTIONS"} and not (method == "POST" and path in READ_POST):
                    return await error(403, "FORBIDDEN", "Operator credential is required for this operation")
                if method in {"POST", "PATCH", "PUT", "DELETE"} or b"content-length" in headers or b"transfer-encoding" in headers:
                    multipart = headers.get(b"content-type", [b""])[0].lower().startswith(b"multipart/form-data")
                    limit = 65536 if path.startswith("/api/v1/what-if") else self.settings.security_multipart_bytes if multipart else self.settings.security_json_bytes
                    length = headers.get(b"content-length", [])
                    if len(length) > 1 or (length and (not length[0].isdigit() or len(length[0]) > 20)):
                        return await error(400, "INVALID_REQUEST", "Invalid Content-Length")
                    if length and int(length[0]) > limit:
                        return await error(413, "PAYLOAD_TOO_LARGE", "Request exceeds the configured body limit")
                    chunks, size = [], 0
                    deadline = time.monotonic() + self.settings.security_body_timeout_seconds
                    try:
                        while True:
                            remaining = deadline - time.monotonic()
                            if remaining <= 0: raise TimeoutError()
                            event = await asyncio.wait_for(receive(), timeout=remaining)
                            if event["type"] == "http.disconnect": return
                            chunk = event.get("body", b"")
                            size += len(chunk)
                            if size > limit:
                                return await error(413, "PAYLOAD_TOO_LARGE", "Request exceeds the configured body limit")
                            chunks.append(chunk)
                            if not event.get("more_body", False): break
                    except TimeoutError:
                        return await error(408, "REQUEST_TIMEOUT", "Request body timed out")
                    body = b"".join(chunks)
                    if not multipart and body:
                        try: parsed = strict_json(body)
                        except (ValueError, UnicodeError, RecursionError):
                            return await error(400, "INVALID_JSON", "Body must be finite UTF-8 JSON with unique keys")
                        if role == "viewer" and isinstance(parsed, dict) and any(parsed.get(k, False) != False for k in ("save_result", "save_results")):
                            return await error(403, "FORBIDDEN", "Viewer cannot persist inference results")
                    sent = False
                    original_receive = receive
                    async def replay():
                        nonlocal sent
                        if not sent:
                            sent = True
                            return {"type": "http.request", "body": body, "more_body": False}
                        return await original_receive()
                    receive = replay
                if category in {"csv", "what_if", "prediction"}:
                    acquired = self.slots.acquire(blocking=False)
                    if not acquired: return await error(503, "SERVER_BUSY", "Inference capacity is busy", True)
                context = secured_export.set(True)
            await self.app(scope, receive, safe_send)
        except Exception:
            # Do not pass exception objects/SQL parameters to a server traceback logger.
            if not response_started:
                await error(500, "INTERNAL_ERROR", "An internal error occurred")
            elif not response_complete:
                # Headers cannot be replaced once sent; terminate a broken stream.
                await safe_send({"type": "http.response.body", "body": b"", "more_body": False})
        finally:
            if context is not None: secured_export.reset(context)
            if acquired: self.slots.release()
            logged_method = method if method in {"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"} else "OTHER"
            logger.info("security_request", extra={"request_id": request_id, "method": logged_method,
                "status": status, "elapsed_ms": round((time.monotonic() - started) * 1000, 3)})


def secure_openapi(app):
    original = app.openapi
    def generate():
        if app.openapi_schema is not None: return app.openapi_schema
        spec = original()
        spec.setdefault("components", {}).setdefault("securitySchemes", {})["WorkspaceBearer"] = {
            "type": "http", "scheme": "bearer", "description": "Shared workspace viewer/operator credential, not per-user ownership"}
        spec["x-security-profile"] = "secured_shared_workspace"
        spec["x-authenticated-response-headers"] = {"X-Workspace-Role": {"type": "string", "enum": ["viewer", "operator"],
            "description": "Server-verified shared-workspace role; absent on public/unauthenticated responses. Not user identity or ownership."}}
        spec["x-security-limits"] = {"json_bytes": app.state.settings.security_json_bytes,
            "what_if_bytes": 65536, "multipart_bytes": app.state.settings.security_multipart_bytes,
            "file_csv_bytes": 10485760, "rate_limit_scope": "one_process_not_distributed"}
        for path, item in spec["paths"].items():
            for method, operation in item.items():
                if method.upper() not in {"GET", "POST", "PATCH", "DELETE", "PUT", "HEAD", "OPTIONS"}: continue
                if (method.upper(), path) in PUBLIC: operation["security"] = []
                else:
                    operation["security"] = [{"WorkspaceBearer": []}]
                    operation["x-workspace-access"] = "viewer_or_operator_no_save" if method == "get" or path in READ_POST else "operator"
                    for code in (400, 401, 403, 404, 405, 408, 409, 413, 422, 429, 431, 500, 503):
                        item = operation["responses"].setdefault(str(code), {"description": HTTPStatus(code).phrase})
                        item["content"] = {"application/json": {"schema": {"$ref": "#/components/schemas/ErrorEnvelope"}}}
        return spec
    app.openapi = generate
