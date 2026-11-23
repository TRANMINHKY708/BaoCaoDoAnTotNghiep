"""Spreadsheet-safe export only in the explicitly enabled secured profile."""
from contextvars import ContextVar

secured_export = ContextVar("secured_export", default=False)


def safe_cell(value):
    if isinstance(value, str) and (value.startswith(("\t", "\r", "\n"))
            or value.lstrip(" \t\r\n").startswith(("=", "+", "-", "@"))):
        return "'" + value
    return value


def safe_export(frame):
    if not secured_export.get():
        return frame
    # Export only: never modify inference inputs, source snapshots or persisted JSON.
    result = frame.map(safe_cell)
    result.columns = [safe_cell(name) for name in result.columns]
    return result
