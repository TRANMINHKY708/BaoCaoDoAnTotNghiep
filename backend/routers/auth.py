"""Only the five AUTH-02 endpoints; no user administration or bootstrap."""

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from backend.core.accounts_security import set_session_cookie
from backend.schemas.auth import Auth01Empty, Auth01Login, Auth01PasswordChange
from backend.services.accounts_service import AuthError

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


def payload(request, model):
    try:
        return model.model_validate(request.state.auth_json)
    except ValidationError:
        raise AuthError(422, "VALIDATION_ERROR") from None


@router.get("/csrf", operation_id="auth01_csrf")
def csrf(request: Request):
    service = request.app.state.accounts
    body, token = service.bootstrap(request.state.auth_raw, request.state.auth_ip)
    response = JSONResponse(body)
    if token:
        set_session_cookie(response, service, token, 300)
    return response


@router.post("/login", operation_id="auth01_login")
def login(request: Request):
    service = request.app.state.accounts
    body, token = service.login(
        request.state.auth_raw,
        request.state.auth_nonce,
        payload(request, Auth01Login),
        request.state.security_request_id,
    )
    response = JSONResponse(body)
    set_session_cookie(response, service, token, 28800)
    return response


@router.get("/me", operation_id="auth01_me")
def me(request: Request):
    return request.app.state.accounts.reply(request.state.auth_context)


@router.post("/logout", status_code=204, operation_id="auth01_logout")
def logout(request: Request):
    payload(request, Auth01Empty)
    service = request.app.state.accounts
    service.logout(
        request.state.auth_raw,
        request.state.auth_nonce,
        request.state.security_request_id,
    )
    response = Response(status_code=204)
    set_session_cookie(response, service)
    return response


@router.post("/change-password", status_code=204, operation_id="auth01_change_password")
def change_password(request: Request):
    service = request.app.state.accounts
    service.change_password(
        request.state.auth_raw,
        request.state.auth_nonce,
        payload(request, Auth01PasswordChange),
        request.state.security_request_id,
    )
    response = Response(status_code=204)
    set_session_cookie(response, service)
    return response
