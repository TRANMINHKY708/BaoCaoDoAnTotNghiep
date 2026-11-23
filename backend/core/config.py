"""Environment-based application settings."""

from functools import lru_cache
from pathlib import Path
from typing import Literal
import re

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    database_url: str | None = None
    test_database_url: str | None = None
    database_echo: bool = False
    security_profile: Literal["local", "secured", "accounts"] = "local"
    accounts_allowed_hosts: list[str] = Field(default_factory=list)
    accounts_insecure_loopback: bool = False
    security_viewer_token: SecretStr | None = Field(default=None, repr=False)
    security_operator_token: SecretStr | None = Field(default=None, repr=False)
    security_cors_origins: list[str] = Field(default_factory=list)
    security_json_bytes: int = Field(default=1048576, ge=65536, le=1048576)
    security_multipart_bytes: int = Field(default=12582912, ge=10485760, le=12582912)
    security_requests_per_minute: int = Field(default=60, ge=1, le=600)
    security_prediction_per_minute: int = Field(default=20, ge=1, le=120)
    security_what_if_per_minute: int = Field(default=30, ge=1, le=120)
    security_csv_per_minute: int = Field(default=5, ge=1, le=30)
    security_auth_failures_per_minute: int = Field(default=10, ge=1, le=60)
    security_max_inflight: int = Field(default=2, ge=1, le=8)
    security_body_timeout_seconds: float = Field(default=10, gt=0, le=30)

    @model_validator(mode="after")
    def secure_configuration(self):
        if self.security_profile != "secured":
            return self
        tokens = [s.get_secret_value() if s else "" for s in
                  (self.security_viewer_token, self.security_operator_token)]
        if any(not re.fullmatch(r"[A-Za-z0-9_-]{43,128}", t) or len(set(t)) < 16 for t in tokens) or tokens[0] == tokens[1]:
            raise ValueError("Secured profile requires two distinct strong environment tokens")
        if self.database_echo:
            raise ValueError("SQL echo is forbidden in secured profile")
        from urllib.parse import urlsplit
        for origin in self.security_cors_origins:
            url = urlsplit(origin)
            if (url.scheme not in {"http", "https"} or not url.hostname or url.username or url.password
                    or url.path or url.query or url.fragment or "*" in origin or origin == "null"):
                raise ValueError("CORS requires explicit HTTP(S) origins without paths or credentials")
        return self

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        hide_input_in_errors=True,
    )

    @model_validator(mode="after")
    def accounts_configuration(self):
        if self.security_profile != "accounts":
            return self
        from urllib.parse import urlsplit
        if not self.database_url or self.database_echo or not self.security_cors_origins or not self.accounts_allowed_hosts:
            raise ValueError("Accounts requires database, explicit origins/hosts and SQL echo disabled")
        loopback = {"localhost", "127.0.0.1", "::1"}
        for host in self.accounts_allowed_hosts:
            if not host or any(x in host for x in ("*", "/", "@", " ")):
                raise ValueError("Accounts requires exact trusted hosts")
            if self.accounts_insecure_loopback and host not in loopback:
                raise ValueError("Insecure accounts development is loopback-only")
        for origin in self.security_cors_origins:
            u = urlsplit(origin)
            if (u.scheme not in {"http", "https"} or not u.hostname or u.username or u.password
                    or u.path or u.query or u.fragment or "*" in origin):
                raise ValueError("Accounts requires exact origin allowlist")
            if self.accounts_insecure_loopback:
                if u.hostname not in loopback:
                    raise ValueError("Insecure accounts development is loopback-only")
            elif u.scheme != "https":
                raise ValueError("Accounts production origins require HTTPS")
        return self


class GeminiSettings(BaseSettings):
    """Reuse root dotenv loading without changing AUTH/database settings or os.environ."""

    gemini_api_key: SecretStr | None = Field(default=None, repr=False)
    gemini_model: str = "gemini-3.5-flash-lite"
    model_config = Settings.model_config.copy()


@lru_cache
def get_settings() -> Settings:
    return Settings()
