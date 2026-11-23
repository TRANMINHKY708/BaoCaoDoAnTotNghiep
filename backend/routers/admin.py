"""Exactly six approved AUTH-01 admin operations, accounts profile only."""

from uuid import UUID
from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from backend.core.accounts_security import set_session_cookie
from backend.routers.auth import payload
from backend.schemas.admin import CreateUser, PatchUser, Reauthenticate, ResetPassword
from backend.services.account_admin import AdminService, admin_query
from backend.services.accounts_service import AuthError

router = APIRouter(prefix="/api/v1/admin/users", tags=["Account administration"])


def target_id(value):
    try:
        return UUID(value)
    except ValueError:
        raise AuthError(422, "VALIDATION_ERROR") from None


@router.get("", operation_id="auth01_list_users")
def listing(request: Request):
    return AdminService(request.app.state.accounts).read(
        request.state.auth_context, query=admin_query(request.query_params)
    )


@router.post("", status_code=201, operation_id="auth01_create_user")
def create(request: Request):
    result, tag = AdminService(request.app.state.accounts).mutate(
        request.state.auth_context,
        "create",
        payload(request, CreateUser),
        request.state.security_request_id,
    )
    return JSONResponse(
        result,
        status_code=201,
        headers={"ETag": tag, "Location": "/api/v1/admin/users/" + result["id"]},
    )


@router.get("/{user_id}", operation_id="auth01_get_user")
def detail(user_id: str, request: Request):
    if request.query_params:
        raise AuthError(422, "VALIDATION_ERROR")
    result, tag = AdminService(request.app.state.accounts).read(
        request.state.auth_context, target=target_id(user_id)
    )
    return JSONResponse(result, headers={"ETag": tag})


def mutation(request, user_id, operation, model):
    s = request.app.state.accounts
    result, tag = AdminService(s).mutate(
        request.state.auth_context,
        operation,
        payload(request, model),
        request.state.security_request_id,
        target=target_id(user_id),
        if_match=",".join(request.headers.getlist("If-Match")) or None,
    )
    response = (
        JSONResponse(result, headers={"ETag": tag})
        if operation == "patch"
        else Response(status_code=204, headers={"ETag": tag})
    )
    if operation == "revoke" and result["id"] == str(
        request.state.auth_context["user_id"]
    ):
        set_session_cookie(response, s)
    return response


@router.patch("/{user_id}", operation_id="auth01_patch_user")
def patch(user_id: str, request: Request):
    return mutation(request, user_id, "patch", PatchUser)


@router.post(
    "/{user_id}/reset-password", status_code=204, operation_id="auth01_reset_password"
)
def reset(user_id: str, request: Request):
    return mutation(request, user_id, "reset", ResetPassword)


@router.post(
    "/{user_id}/revoke-sessions", status_code=204, operation_id="auth01_revoke_sessions"
)
def revoke(user_id: str, request: Request):
    return mutation(request, user_id, "revoke", Reauthenticate)
