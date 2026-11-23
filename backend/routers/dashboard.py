"""Approved T12 additive read-only endpoint; no production write dependency."""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from backend.schemas.dashboard import DashboardOverview
from backend.services.dashboard import get_dashboard_connection, overview, parse_query
from backend.services.versioned_models import failure

router = APIRouter()


async def query_parameters(request: Request):
    if await request.body():
        failure(400, "INVALID_REQUEST", "Dashboard GET does not accept a request body")
    return parse_query(request.query_params.multi_items())


@router.get("/api/v1/dashboard/overview")
def dashboard_overview(query=Depends(query_parameters), conn=Depends(get_dashboard_connection)):
    try:
        result = DashboardOverview.model_validate(overview(conn, query))
    except ValidationError:
        failure(409, "DASHBOARD_DATA_INTEGRITY_ERROR", "Stored results violate dashboard integrity rules")
    return JSONResponse(result.model_dump(mode="json"), headers={"Cache-Control": "no-store"})
