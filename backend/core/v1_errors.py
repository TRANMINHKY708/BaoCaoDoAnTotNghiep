"""Scoped v1 errors; keep legacy detail shapes and status behavior unchanged."""

from uuid import uuid4

from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import http_exception_handler, request_validation_exception_handler
from fastapi.responses import JSONResponse, PlainTextResponse
from starlette.exceptions import HTTPException


def is_v1(request):
    return request.url.path == "/api/v1" or request.url.path.startswith("/api/v1/")


def safe_errors(request):
    settings = getattr(request.app.state, "settings", None)
    return is_v1(request) or getattr(settings, "security_profile", "local") == "secured"


def response(request, status, code, message, details=None, headers=None):
    request_id = str(getattr(request.state, "request_id", uuid4()))
    return JSONResponse({"error": {"code": code, "message": message, "details": details or [], "request_id": request_id}},
                        status_code=status, headers={**(headers or {}), "X-Request-ID": request_id})


async def http_error(request, exc):
    if not safe_errors(request):
        return await http_exception_handler(request, exc)
    codes = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED", 409: "CONFLICT", 412: "PRECONDITION_FAILED", 413: "PAYLOAD_TOO_LARGE",
             422: "VALIDATION_ERROR", 500: "INTERNAL_ERROR", 503: "SERVICE_UNAVAILABLE"}
    if isinstance(exc.detail, dict) and {"code", "message"} <= exc.detail.keys():
        code, message = exc.detail["code"], exc.detail["message"]
    else:
        code = codes.get(exc.status_code, "REQUEST_FAILED")
        message = exc.detail if isinstance(exc.detail, str) and exc.status_code < 500 else "Service unavailable" if exc.status_code == 503 else "Request failed"
    details = exc.detail.get("details", []) if isinstance(exc.detail, dict) else []
    return response(request, exc.status_code, code, message, details, headers=exc.headers)


async def validation_error(request, exc):
    if not safe_errors(request):
        return await request_validation_exception_handler(request, exc)
    details = [{"location": list(e["loc"]), "code": e["type"], "message": "Invalid value for this field"} for e in exc.errors()]
    return response(request, 422, "VALIDATION_ERROR", "Request does not match the selected API schema", details)


async def internal_error(request, exc):
    if not safe_errors(request):
        return PlainTextResponse("Internal Server Error", status_code=500)
    return response(request, 500, "INTERNAL_ERROR", "An internal error occurred")


def install_handlers(app):
    from sqlalchemy.exc import SQLAlchemyError

    app.add_exception_handler(HTTPException, http_error)
    app.add_exception_handler(RequestValidationError, validation_error)
    app.add_exception_handler(Exception, internal_error)

    async def database_error(request, exc):
        if not safe_errors(request):
            return PlainTextResponse("Internal Server Error", status_code=500)
        return response(request, 503, "DATABASE_UNAVAILABLE", "Database operation is unavailable")

    app.add_exception_handler(SQLAlchemyError, database_error)

    @app.middleware("http")
    async def request_id(request, call_next):
        if safe_errors(request):
            request.state.request_id = getattr(request.state, "security_request_id", None) or uuid4()
        result = await call_next(request)
        if safe_errors(request):
            result.headers["X-Request-ID"] = str(request.state.request_id)
        if request.url.path == "/api/v1/dashboard/overview":
            result.headers["Cache-Control"] = "no-store"
        return result
