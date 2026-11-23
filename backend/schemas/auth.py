"""Strict write DTOs; no administration endpoints in AUTH-02."""

from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.core.passwords import normalize_password


class AuthRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, hide_input_in_errors=True)


class Auth01Login(AuthRequest):
    username: str = Field(
        min_length=3, max_length=64, pattern=r"^[a-z0-9][a-z0-9._-]{2,63}$"
    )
    password: str = Field(min_length=1, max_length=512, repr=False)

    @field_validator("password")
    @classmethod
    def password_policy(cls, value):
        return normalize_password(value)


class Auth01PasswordChange(AuthRequest):
    current_password: str = Field(min_length=1, max_length=512, repr=False)
    new_password: str = Field(min_length=1, max_length=512, repr=False)

    @field_validator("current_password", "new_password")
    @classmethod
    def password_policy(cls, value):
        return normalize_password(value)


class Auth01Empty(AuthRequest):
    pass
