"""Bounded AUTH-01 Argon2id, never logs passwords or hashes."""

import unicodedata

from argon2 import PasswordHasher, extract_parameters
from argon2.exceptions import InvalidHashError, VerificationError
from argon2.low_level import Type

HASHER = PasswordHasher(
    memory_cost=19456,
    time_cost=2,
    parallelism=1,
    salt_len=16,
    hash_len=32,
    type=Type.ID,
)
# Small, explicit offline blocklist for the thesis; no network password checks.
BLOCKLIST = frozenset(
    {
        "12345678",
        "123456789",
        "1234567890",
        "87654321",
        "11111111",
        "00000000",
        "abcd1234",
        "admin123",
        "password",
        "password1",
        "qwertyui",
        "qwerty123",
        "matkhau123",
        "iloveyou",
        "passwordpassword",
        "123456789012345",
        "1234567890123456",
        "qwertyqwertyqwerty",
        "letmeinletmeinletmein",
    }
)


MIN_LENGTH = 8


def normalize_password(value: str) -> str:
    if not isinstance(value, str) or len(value) > 512:
        raise ValueError("Invalid password input")
    value = unicodedata.normalize("NFC", value)
    if not MIN_LENGTH <= len(value) <= 128 or value.isspace():
        raise ValueError("Invalid password length")
    value.encode("utf-8")
    if value.casefold() in BLOCKLIST:
        raise ValueError("Password is too common")
    return value


def hash_password(value: str) -> str:
    value = normalize_password(value)
    return HASHER.hash(value)


def verify_password(encoded: str, value: str) -> bool:
    try:
        value = normalize_password(value)
        p = extract_parameters(encoded)
        if (
            p.type,
            p.version,
            p.memory_cost,
            p.time_cost,
            p.parallelism,
            p.salt_len,
            p.hash_len,
        ) != (Type.ID, 19, 19456, 2, 1, 16, 32):
            return False
        return HASHER.verify(encoded, value)
    except (ValueError, VerificationError, InvalidHashError):
        return False
