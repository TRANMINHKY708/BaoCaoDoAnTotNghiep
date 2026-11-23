"""Server-owned AUTH-01 capability mapping, shared workspace, no ownership."""

import json
from pathlib import Path

from starlette.routing import compile_path

MATRIX = json.loads(
    (
        Path(__file__).resolve().parents[1] / "contracts/auth03_capabilities.json"
    ).read_text(encoding="utf-8")
)
OPERATIONS = {(x["method"], x["path"]): x for x in MATRIX["business_operations"]}
# F04.1 additive operation; preserve the historical AUTH-03 contract artifact.
OPERATIONS[("POST", "/api/v1/assistant/chat")] = {
    "method": "POST", "path": "/api/v1/assistant/chat", "public": False,
    "required_capabilities": ["models.read"], "conditional_save": None,
}
OPERATIONS[("POST", "/api/v1/assistant/narrative")] = {
    "method": "POST", "path": "/api/v1/assistant/narrative", "public": False,
    "required_capabilities": ["models.read"], "conditional_save": None,
}
OPERATIONS[("POST", "/api/v1/reports/export")] = {
    "method": "POST", "path": "/api/v1/reports/export", "public": False,
    "required_capabilities": ["models.read"], "conditional_save": None,
}
for _step in ("inspect", "preview", "prepare-confirmation"):
    OPERATIONS[("POST", f"/api/v1/bulk/csv/{_step}")] = {
        "method": "POST", "path": f"/api/v1/bulk/csv/{_step}", "public": False,
        "required_capabilities": ["inference.csv.run"], "conditional_save": None,
    }
OPERATIONS[("POST", "/api/v1/bulk/imports/confirm")] = {
    "method": "POST", "path": "/api/v1/bulk/imports/confirm", "public": False,
    "required_capabilities": ["inference.csv.run", "customers.write", "snapshots.create"], "conditional_save": None,
}
for _method, _path in (("POST", "/api/v1/bulk/analyses"), ("POST", "/api/v1/bulk/analyses/{job_id}/advance"), ("POST", "/api/v1/bulk/analyses/{job_id}/retry")):
    OPERATIONS[(_method, _path)] = {
        "method": _method, "path": _path, "public": False,
        "required_capabilities": ["inference.csv.run", "inference.json.run", "history.read"], "conditional_save": None,
    }
# K11: import and analysis history is read-only shared workspace data, visible to every role.
for _path in ("/api/v1/bulk/imports", "/api/v1/bulk/imports/{job_id}", "/api/v1/bulk/analyses", "/api/v1/bulk/analyses/{job_id}"):
    OPERATIONS[("GET", _path)] = {
        "method": "GET", "path": _path, "public": False,
        "required_capabilities": ["customers.read", "history.read"], "conditional_save": None,
    }
for _method, _path in (("GET", "/api/v1/bulk/analytics/insights"), ("GET", "/api/v1/bulk/analytics/options"), ("GET", "/api/v1/bulk/analytics/overview"), ("POST", "/api/v1/bulk/analytics/export"), ("POST", "/api/v1/bulk/analytics/narrative")):
    OPERATIONS[(_method, _path)] = {
        "method": _method, "path": _path, "public": False,
        "required_capabilities": ["history.read", "customers.read", "models.read"], "conditional_save": None,
    }
# K5 churn API: same capabilities as the existing JSON inference; it never persists results.
for _method, _path, _caps in (("GET", "/api/v1/churn/model", ["models.read"]),
                              ("POST", "/api/v1/churn/predict", ["inference.json.run"]),
                              ("POST", "/api/v1/churn/predict/batch", ["inference.json.run"])):
    OPERATIONS[(_method, _path)] = {
        "method": _method, "path": _path, "public": False,
        "required_capabilities": _caps, "conditional_save": None,
    }
# K9 model management: aggregated usage of registered models, read-only.
OPERATIONS[("GET", "/api/v1/models/usage")] = {
    "method": "GET", "path": "/api/v1/models/usage", "public": False,
    "required_capabilities": ["models.read", "history.read"], "conditional_save": None,
}
PATTERNS = [
    (method, compile_path(path)[0], operation)
    for (method, path), operation in OPERATIONS.items()
]


def operation_for(method, path):
    return next(
        (
            operation
            for candidate, pattern, operation in PATTERNS
            if method == candidate and pattern.fullmatch(path)
        ),
        None,
    )


def capabilities(user):
    return [] if user["must_change_password"] else list(MATRIX["roles"][user["role"]])


def permitted(user, required):
    return set(required).issubset(capabilities(user))
