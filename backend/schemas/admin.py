"""Strict AUTH-01 Admin DTOs; no client-owned security state."""

from typing import Literal
import unicodedata
from pydantic import Field, field_validator, model_validator
from backend.schemas.auth import AuthRequest
from backend.core.passwords import normalize_password

Role = Literal["ADMIN", "OPERATOR", "VIEWER"]


class Reauthenticate(AuthRequest):
    admin_password: str = Field(min_length=1, max_length=512, repr=False)

    @field_validator("admin_password")
    @classmethod
    def password(cls, value):
        return normalize_password(value)


class CreateUser(Reauthenticate):
    username: str = Field(
        min_length=3, max_length=64, pattern=r"^[a-z0-9][a-z0-9._-]{2,63}$"
    )
    display_name: str = Field(min_length=1, max_length=100)
    role: Role
    initial_password: str = Field(min_length=1, max_length=512, repr=False)

    @field_validator("initial_password")
    @classmethod
    def initial(cls, value):
        return normalize_password(value)

    @field_validator("display_name")
    @classmethod
    def display(cls, value):
        value = unicodedata.normalize("NFC", value).strip()
        if not value or len(value) > 100:
            raise ValueError("Invalid display name")
        return value


class PatchUser(Reauthenticate):
    display_name: str = Field(default="", min_length=1, max_length=100)
    role: Role = "VIEWER"
    is_active: bool = True
    _display = field_validator("display_name")(CreateUser.display.__func__)

    @model_validator(mode="after")
    def has_change(self):
        if not self.model_fields_set.intersection(
            {"display_name", "role", "is_active"}
        ):
            raise ValueError("No mutable fields")
        return self


class ResetPassword(Reauthenticate):
    initial_password: str = Field(min_length=1, max_length=512, repr=False)
    _initial = field_validator("initial_password")(CreateUser.initial.__func__)
