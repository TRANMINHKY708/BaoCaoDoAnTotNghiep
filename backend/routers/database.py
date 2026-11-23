"""Database readiness endpoint."""

from fastapi import APIRouter, HTTPException, Request

from backend.db.session import check_database_connection


router = APIRouter(prefix="/database", tags=["Database"])


@router.get("/health")
def database_health(request: Request):
    try:
        connected = check_database_connection(request.app.state.settings.database_url) if request.app.state.settings.security_profile == "accounts" else check_database_connection()
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Database is unavailable or not configured",
        ) from exc
    return {
        "status": "healthy" if connected else "unhealthy",
        "connected": connected,
    }
