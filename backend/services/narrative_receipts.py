"""Bounded ephemeral, session-bound references to trusted backend responses."""

import hashlib
import json
import secrets
import time
from threading import Lock

from backend.core.account_permissions import permitted
from backend.schemas import v1, what_if
from backend.services.versioned_models import failure, versioned_models

HEADER = "X-Analysis-Receipt"
MAX_BYTES = 65536
TTL = 600
PATHS = {
    "/api/v1/predict/purchase-level": ("prediction", "inference.json.run"),
    "/api/v1/predict/segment": ("segmentation", "inference.json.run"),
    "/api/v1/what-if/preview": ("what_if", "what_if.preview_compare"),
    "/api/v1/what-if": ("what_if", "what_if.preview_compare"),
}
SAFE_FEATURES = {
    "Login_Frequency",
    "Session_Duration_Avg",
    "Pages_Per_Session",
    "Wishlist_Items",
    "Email_Open_Rate",
    "Mobile_App_Usage",
    "Cart_Abandonment_Rate",
    "Discount_Usage_Rate",
    "Average_Order_Value",
    "Days_Since_Last_Purchase",
    "Returns_Rate",
    "Lifetime_Value",
    "Credit_Balance",
    "Customer_Service_Calls",
    "Product_Reviews_Written",
    "Social_Media_Engagement_Score",
    "Payment_Method_Diversity",
    "Membership_Years",
}


def owner(ctx):
    return str(ctx["user_id"]), str(ctx["id"])


def classification(result):
    return {
        key: result[key]
        for key in (
            "model_id",
            "model_version",
            "purchase_level",
            "probabilities",
            "scope",
        )
        if key in result
    }


def segment(result):
    return {
        key: result[key]
        for key in (
            "model_id",
            "model_version",
            "cluster",
            "segment_id",
            "distance_to_centroid",
            "distance_kind",
        )
        if key in result
    }


def project(path, raw):
    """Validate real response schemas, then discard personal/input/technical fields."""
    kind, capability = PATHS[path]
    if kind == "prediction":
        checked = (
            (
                v1.ExplainedPurchaseResponse
                if "explanation" in raw
                else v1.PurchaseResponse
            )
            .model_validate(raw)
            .model_dump(mode="json")
        )
        data = classification(checked)
        if "explanation" in checked:
            exp = checked["explanation"]
            # Never send encoded country/city/category names or raw input_values.
            features = [
                f
                for f in exp["features"]
                if f["feature_name"].split("__")[-1] in SAFE_FEATURES
            ]
            data["shap"] = {
                "output_space": exp["output_space"],
                "base_value": exp["base_value"],
                "model_output": exp["model_output"],
                "predicted_class": exp["predicted_class"],
                "omitted_features": len(features) != len(exp["features"]),
                "contributions": [
                    {"feature": f["feature_name"], "shap_value": f["shap_value"]}
                    for f in sorted(
                        features, key=lambda f: abs(f["shap_value"]), reverse=True
                    )[:6]
                ],
            }
        versions = [checked["model_version"]]
    elif kind == "segmentation":
        checked = v1.SegmentResponse.model_validate(raw).model_dump(mode="json")
        data = segment(checked)
        state = versioned_models.get("segmentation", checked["model_version"])
        data["artifact_sha256"] = state["artifact_sha256"]
        versions = [checked["model_version"]]
    else:
        compare = "scenario_classification" in raw
        checked = (
            (
                what_if.WhatIfComparisonResponse
                if compare
                else what_if.WhatIfPreviewResponse
            )
            .model_validate(raw)
            .model_dump(mode="json")
        )
        baseline = checked["baseline"] if compare else checked
        data = {
            "baseline": outcome(baseline["classification"]),
            "scope": baseline["scope"],
        }
        versions = [baseline["classification"]["model"]["model_version"]]
        if baseline["segmentation"]:
            data["baseline_segmentation"] = outcome(baseline["segmentation"])
            versions.append(baseline["segmentation"]["model"]["model_version"])
        if compare:
            data.update(
                scenario=outcome(checked["scenario_classification"]),
                changes=checked["changed_fields"],
                probability_deltas=checked["probability_deltas"],
            )
            if checked["scenario_segmentation"]:
                data["scenario_segmentation"] = outcome(
                    checked["scenario_segmentation"]
                )
    return {
        "kind": kind,
        "capability": capability,
        "data": data,
        "model_versions": versions,
        "source": "verified_live_backend_result",
        "persistence": "not_asserted_by_receipt",
        "_export": {
            "generated_at": (baseline if kind == "what_if" else checked).get(
                "generated_at"
            ),
            "customer_id": baseline.get("resolved_customer_id")
            if kind == "what_if"
            else None,
            "snapshot_id": baseline.get("resolved_snapshot_id")
            if kind == "what_if"
            else None,
            "baseline_input": baseline.get("baseline_input")
            if kind == "what_if"
            else None,
            "explanation": {
                k: v for k, v in checked["explanation"].items() if k != "input_values"
            }
            if kind == "prediction" and "explanation" in checked
            else None,
        },
    }


def outcome(value):
    data = (
        classification(value) if value["task"] == "classification" else segment(value)
    )
    data.update(
        model_id=value["model"]["model_id"],
        model_version=value["model"]["model_version"],
    )
    return data


class ReceiptStore:
    def __init__(self):
        self.lock, self.entries = Lock(), {}
        self.narratives = {}

    def issue(self, ctx, path, data):
        if (
            len(json.dumps(data, ensure_ascii=False, allow_nan=False).encode())
            > MAX_BYTES
        ):
            return None
        with self.lock:
            now = time.monotonic()
            self.entries = {
                key: item for key, item in self.entries.items() if item[0] > now
            }
            while len(self.entries) >= 128:
                self.entries.pop(next(iter(self.entries)))
            token = secrets.token_urlsafe(32)
            self.entries[token] = (now + TTL, owner(ctx), path, data)
            self.narratives = {
                key: value
                for key, value in self.narratives.items()
                if key in self.entries
            }
            return token

    def resolve(self, ctx, token):
        with self.lock:
            entry = self.entries.get(token)
            if not entry or entry[0] <= time.monotonic() or entry[1] != owner(ctx):
                failure(
                    409,
                    "NARRATIVE_RESULT_EXPIRED",
                    "Kết quả không còn được xác minh trong phiên này. Hãy chạy lại phân tích.",
                )
            if not permitted(ctx["user"], [entry[3]["capability"], "models.read"]):
                failure(403, "FORBIDDEN", "Tài khoản không có quyền đọc kết quả này.")
            # Return a detached copy, never a mutable cache entry.
            value = json.loads(json.dumps(entry[3]))
        value["fingerprint"] = hashlib.sha256(
            json.dumps(
                value, sort_keys=True, ensure_ascii=False, separators=(",", ":")
            ).encode()
        ).hexdigest()
        return value

    def remember_narrative(self, ctx, token, result):
        self.resolve(ctx, token)
        with self.lock:
            entry = self.entries.get(token)
            if entry and entry[0] > time.monotonic() and entry[1] == owner(ctx):
                self.narratives[token] = result.model_dump(mode="json")

    def narrative_for_export(self, ctx, token):
        self.resolve(ctx, token)
        with self.lock:
            result = self.narratives.get(token)
            return json.loads(json.dumps(result)) if result else None


receipts = ReceiptStore()


class NarrativeReceiptMiddleware:
    """Observe small successful JSON responses only; never alter result bodies."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        ctx = scope.get("state", {}).get("auth_context")
        path = scope.get("path")
        if (
            scope["type"] != "http"
            or scope.get("method") != "POST"
            or path not in PATHS
            or not ctx
            or ctx.get("state") != "authenticated"
        ):
            return await self.app(scope, receive, send)
        start, chunks, size, passthrough = None, [], 0, False

        async def observe(event):
            nonlocal start, size, passthrough
            if event["type"] == "http.response.start":
                if event["status"] != 200:
                    passthrough = True
                    return await send(event)
                start = event
            elif passthrough:
                await send(event)
            elif event["type"] == "http.response.body":
                size += len(event.get("body", b""))
                chunks.append(event)
                if size > MAX_BYTES or not event.get("more_body", False):
                    if size <= MAX_BYTES:
                        try:
                            data = project(
                                path,
                                json.loads(
                                    b"".join(c.get("body", b"") for c in chunks)
                                ),
                            )
                            token = receipts.issue(ctx, path, data)
                            if token:
                                start = dict(
                                    start,
                                    headers=[
                                        *start.get("headers", []),
                                        (HEADER.lower().encode(), token.encode()),
                                    ],
                                )
                        except Exception:  # noqa: BLE001, S110 -- receipt failures must not change inference or log inputs
                            pass
                    await send(start)
                    for chunk in chunks:
                        await send(chunk)
                    chunks.clear()
                    passthrough = True

        await self.app(scope, receive, observe)


def install_openapi(app):
    original = app.openapi

    def generate():
        spec = original()
        for path in PATHS:
            operation = spec.get("paths", {}).get(path, {}).get("post")
            if operation:
                operation["responses"]["200"].setdefault("headers", {})[HEADER] = {
                    "description": "Optional short-lived session-bound reference for AI commentary. No persistence or authentication credential. May be absent if unavailable/oversized.",
                    "schema": {"type": "string", "pattern": "^[A-Za-z0-9_-]{43}$"},
                }
        return spec

    app.openapi = generate
