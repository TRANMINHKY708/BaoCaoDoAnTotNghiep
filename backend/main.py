"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from starlette.middleware.cors import CORSMiddleware

from backend.core.config import get_settings
from backend.core.security import (
    SecurityMiddleware,
    install_log_redaction,
    secure_openapi,
)
from backend.core.v1_errors import install_handlers
from backend.routers.assistant import router as assistant_router
from backend.routers.batch_analytics import router as batch_analytics_router
from backend.routers.bulk import router as bulk_router
from backend.routers.bulk_analysis import router as bulk_analysis_router
from backend.routers.bulk_import import router as bulk_import_router
from backend.routers.churn import router as churn_router
from backend.routers.models import router as models_router
from backend.routers.customers import router as customers_router
from backend.routers.dashboard import router as dashboard_router
from backend.routers.database import router as database_router
from backend.routers.prediction import router as prediction_router
from backend.routers.reports import router as reports_router
from backend.routers.v1 import router as v1_router
from backend.routers.what_if import router as what_if_router
from backend.schemas.dashboard import install_openapi as install_dashboard_openapi
from backend.services.churn_model import churn_model
from backend.services.model_service import model_service
from backend.services.versioned_models import verify_legacy_pins, versioned_models


@asynccontextmanager
async def lifespan(app: FastAPI):
    if app.state.settings.security_profile in {"secured", "accounts"}:
        install_log_redaction()
    verify_legacy_pins()
    model_service.load_models()
    versioned_models.load()
    churn_model.load()  # K5: failure is isolated to the churn endpoints (503)
    yield
    if hasattr(app.state, "accounts"):
        app.state.accounts.engine.dispose()


def create_app(settings=None):
    """Local contract is unchanged; secured profile must be explicitly configured."""
    if settings is None:
        try:
            settings = get_settings()
        except Exception:  # noqa: BLE001 -- startup configuration must not disclose secrets
            raise RuntimeError("Invalid application configuration; review environment locally") from None
    application = FastAPI(
        title="Ecommerce Customer Behavior AI API",
        description=(
            "API phân tích, dự báo hành vi mua hàng "
            "và phân khúc khách hàng thương mại điện tử."
        ),
        version="1.0.0",
        lifespan=lifespan,
    )
    application.state.settings = settings
    application.include_router(prediction_router)
    application.include_router(customers_router)
    application.include_router(database_router)
    application.include_router(v1_router)
    application.include_router(what_if_router)
    application.include_router(dashboard_router)
    application.include_router(assistant_router)
    application.include_router(reports_router)
    application.include_router(bulk_router)
    application.include_router(bulk_import_router)
    application.include_router(bulk_analysis_router)
    application.include_router(batch_analytics_router)
    application.include_router(churn_router)
    application.include_router(models_router)  # K9: read-only model usage
    install_handlers(application)
    application.add_api_route("/", root, methods=["GET"])
    application.add_api_route("/health", health, methods=["GET"])
    application.add_api_route("/models/info", models_info, methods=["GET"])
    if settings.security_profile == "secured":
        application.add_middleware(SecurityMiddleware, settings=settings)
        application.add_middleware(CORSMiddleware, allow_origins=settings.security_cors_origins,
            allow_credentials=False, allow_methods=["GET", "POST", "PATCH", "DELETE", "HEAD", "OPTIONS"],
            allow_headers=["Authorization", "Content-Type", "If-Match", "Idempotency-Key"],
            expose_headers=["ETag", "X-Request-ID", "X-Model-Version", "Retry-After", "X-Security-Profile", "X-Workspace-Role"])
        secure_openapi(application)
    install_dashboard_openapi(application)
    if settings.security_profile == "accounts":
        from sqlalchemy.exc import SQLAlchemyError

        from backend.core.accounts_security import (
            AccountsMiddleware,
            error_response,
            install_accounts_openapi,
        )
        from backend.routers.auth import router as auth_router
        from backend.services.accounts_service import AccountsService, AuthError
        from backend.services.narrative_receipts import NarrativeReceiptMiddleware
        from backend.services.narrative_receipts import (
            install_openapi as install_narrative_openapi,
        )
        try:
            service = AccountsService(settings)
        except Exception:  # noqa: BLE001 -- startup configuration must fail closed
            raise RuntimeError("Invalid accounts configuration") from None
        application.state.accounts = service
        application.include_router(auth_router)
        from backend.routers.admin import router as admin_router
        application.include_router(admin_router)
        from backend.routers.admin_audit import router as admin_audit_router
        application.include_router(admin_audit_router)  # K8: read-only audit log
        from backend.routers.admin_overview import router as admin_overview_router
        application.include_router(admin_overview_router)  # K13: read-only admin overview
        from backend.routers.admin_sessions import router as admin_sessions_router
        application.include_router(admin_sessions_router)  # K13: list and revoke one session

        async def auth_failure(request, exc):
            return error_response(service, request.state.security_request_id, exc)

        async def auth_database_failure(request, exc):
            code = "SERVER_BUSY" if getattr(getattr(exc, "orig", None), "sqlstate", None) == "55P03" else "AUTH_UNAVAILABLE"
            return error_response(service, request.state.security_request_id,
                                  AuthError(503, code, retry_after=1 if code == "SERVER_BUSY" else None))

        application.add_exception_handler(AuthError, auth_failure)
        application.add_exception_handler(SQLAlchemyError, auth_database_failure)
        application.add_middleware(NarrativeReceiptMiddleware)
        application.add_middleware(AccountsMiddleware, service=service, routes=application.routes)
        application.add_middleware(CORSMiddleware, allow_origins=settings.security_cors_origins,
            allow_credentials=True, allow_methods=["GET", "POST", "PATCH", "DELETE", "HEAD", "OPTIONS"],
            allow_headers=["Content-Type", "X-CSRF-Token", "X-Requested-With", "If-Match", "Idempotency-Key", "Authorization"],
            expose_headers=["ETag", "X-Request-ID", "X-Model-Version", "Retry-After", "X-Security-Profile", "X-Analysis-Receipt", "Content-Disposition"])
        install_accounts_openapi(application)
        install_narrative_openapi(application)
    return application


def root():
    return {
        "message": "Ecommerce AI API is running",
        "version": "1.0.0",
    }


def health():
    status = model_service.get_status()

    if not all(status.values()):
        raise HTTPException(
            status_code=503,
            detail="One or more models are unavailable",
        )

    return {
        "status": "healthy",
        "models": status,
    }


def models_info():
    return {
        "classification": {
            "algorithm": "XGBoost",
            "task": "Purchase Level Prediction",
            "classes": ["Low", "Medium", "High"],
        },
        "segmentation": {
            "algorithm": "K-Means",
            "task": "Customer Segmentation",
            "n_clusters": model_service.kmeans_metadata[
                "n_clusters"
            ],
            "cluster_names": model_service.kmeans_metadata[
                "cluster_names"
            ],
        },
    }


app = create_app()
