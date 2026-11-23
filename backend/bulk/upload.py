"""F08 ephemeral preparation only. No database, filesystem or model access."""

import csv
import hashlib
import io
import json
import re
import secrets
import time
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from threading import Lock

from backend.bulk.contract import MAX_BYTES, MAX_ROWS, VERSION, catalog
from backend.bulk.validation import Issue, validate_csv, validate_rows
from backend.services.versioned_models import failure
from src.data.dataset_contract import FIELDS

TTL = 600
CAPACITY = 24 * 1024 * 1024
FEATURES = [f.name for f in FIELDS]


def digest(value):
    return hashlib.sha256(
        json.dumps(
            value,
            sort_keys=True,
            ensure_ascii=False,
            separators=(",", ":"),
            default=str,
            allow_nan=False,
        ).encode()
    ).hexdigest()


def safe_text(value, limit=160):
    value = re.sub(r"[\x00-\x1f\x7f<>]", "", str(value))
    return value[:limit]


def parse(raw):
    """Structural transport checks; feature/mapping validity belongs to F07."""
    if not isinstance(raw, bytes) or not raw or len(raw) > MAX_BYTES:
        failure(
            413 if raw else 422, "BULK_FILE_SIZE", "Chọn CSV không rỗng, tối đa 10 MiB."
        )
    try:
        text = raw.decode("utf-8-sig")
        if len(text.split("\n", 1)[0]) > 8192:
            raise ValueError
        reader = csv.reader(io.StringIO(text), strict=True)
        headers = next(reader)
        if (
            not headers
            or len(headers) > 64
            or len(set(headers)) != len(headers)
            or any(
                not h
                or len(h) > 128
                or h != h.strip()
                or any(ord(c) < 32 or ord(c) == 127 for c in h)
                for h in headers
            )
        ):
            raise ValueError
        # Record ordinal includes header; quoted multiline records remain one row, as F07.
        rows = []
        for n, cells in enumerate(reader, 2):
            if cells:
                rows.append((n, cells))
            if len(rows) > MAX_ROWS:
                failure(
                    422, "BULK_ROW_LIMIT", "CSV vượt 1.000 dòng; không cắt bớt dòng."
                )
        if not rows:
            failure(
                422,
                "BULK_ROW_LIMIT",
                "CSV cần từ 1 đến 1.000 dòng dữ liệu; không cắt bớt dòng.",
            )
        return headers, rows
    except (UnicodeDecodeError, StopIteration, csv.Error, ValueError):
        failure(
            422,
            "BULK_INVALID_CSV",
            "CSV phải là UTF-8, dấu phẩy và có header không trùng, không rỗng.",
        )


MESSAGES = {
    "INVALID_CELL_VALUE": "Giá trị sai kiểu hoặc không phải số hữu hạn.",
    "ROW_SCHEMA_ERROR": "Giá trị không đúng kiểu, giới hạn hoặc thời gian của hợp đồng.",
    "MISSING_REQUIRED_COLUMN": "Thiếu cột bắt buộc. Hãy kiểm tra ánh xạ.",
    "MISSING_SNAPSHOT_FEATURE": "Thiếu giá trị cần thiết cho dữ liệu hành vi đầy đủ.",
    "SNAPSHOT_INCOMPLETE_NO_DEFAULT_FILL": "Chưa đủ 25 đặc trưng để tạo snapshot; không tự điền giá trị.",
    "DUPLICATE_ROW": "Dòng trùng hoàn toàn trong cùng nguồn; tất cả dòng trùng được cách ly.",
    "CONFLICTING_CUSTOMER_SNAPSHOT": "Cùng khách hàng và thời điểm nhưng nội dung khác nhau; không chọn thay bạn.",
    "DUPLICATE_ORDER_ID": "Mã đơn hàng trùng trong cùng nguồn; tất cả dòng trùng được cách ly.",
    "ROW_WIDTH_MISMATCH": "Số ô không khớp header CSV.",
    "OBSERVATION_IN_FUTURE": "Thời điểm chốt dữ liệu nằm sau thời điểm kiểm tra.",
    "FORBIDDEN_INPUT_COLUMN": "Cột kết quả, định danh nội bộ hoặc thông tin nhạy cảm không được nhập.",
    "AMBIGUOUS_OR_UNKNOWN_MAPPING": "Ánh xạ trùng đích hoặc trường đích không thuộc hợp đồng.",
    "MODEL_SEMANTICS_AND_TIME_UNVERIFIED": "Đúng schema chưa chứng minh đơn vị và kỳ quan sát phù hợp mô hình.",
    "ORDER_CONTRACT_ONLY_NOT_ML_INPUT": "Đơn hàng chỉ được kiểm tra; chưa tạo snapshot hoặc đầu vào ML.",
}


def evaluate(entry, config):
    """Run F07 over each explicit source namespace; never infer or merge sources."""
    raw, headers, records = entry["raw"], entry["headers"], entry["records"]
    models = tuple((m["task"], m["version"]) for m in config["models"])
    options = {
        "dataset_type": entry["dataset_type"],
        "as_of": entry["created"],
        "profile": config["profile"],
        "models": models,
    }
    mapping = config["mapping"]
    # F07 is authoritative for header mapping, target columns and required fields.
    initial = validate_csv(raw, mapping=mapping, **options)
    global_errors = [
        i for i in initial.issues if i.row is None and i.severity == "error"
    ]
    canonical = [mapping.get(h, h) for h in headers]
    groups, widths = defaultdict(list), []
    if not global_errors:
        for n, cells in records:
            if len(cells) != len(headers):
                widths.append(Issue("ROW_WIDTH_MISMATCH", "error", n))
            else:
                item = dict(zip(canonical, cells))
                groups[item.get("source", "")].append((n, item))
    issues, valid = list(global_errors) + widths, {}
    for group in groups.values():
        result = validate_rows(
            [row for _, row in group], row_numbers=[n for n, _ in group], **options
        )
        issues.extend(result.issues)
        valid.update({row.row: row for row in result.valid_rows})
    issues = list(dict.fromkeys(issues))
    by_row = defaultdict(list)
    for issue in issues:
        by_row[issue.row].append(issue)
    rows = []
    normalized = []
    for number, cells in records:
        row_issues = by_row[number] + by_row[None]
        codes = {i.code for i in row_issues}
        duplicate = bool(
            codes
            & {"DUPLICATE_ROW", "CONFLICTING_CUSTOMER_SNAPSHOT", "DUPLICATE_ORDER_ID"}
        )
        accepted = valid.get(number)
        is_error = accepted is None
        raw_value = dict(zip(canonical, cells))
        missing = (
            [
                name
                for name in FEATURES
                if (
                    getattr(accepted.value, name, None)
                    if accepted
                    else raw_value.get(name)
                )
                in (None, "")
            ]
            if entry["dataset_type"] == "behavior"
            else []
        )
        normalized_value = accepted.value.model_dump(mode="json") if accepted else None
        key = None
        identity = None
        if accepted:
            identity = {
                "source_system": accepted.value.source,
                "external_customer_id": accepted.value.external_id,
            }
            key_fields = [VERSION, entry["dataset_type"], identity["source_system"]]
            key_fields += (
                [identity["external_customer_id"], normalized_value["captured_at"]]
                if entry["dataset_type"] == "behavior"
                else [accepted.value.order_id]
            )
            key = digest(key_fields)
            normalized.append(
                {
                    "row": number,
                    "row_key": key,
                    "identity": identity,
                    "data": normalized_value,
                    "snapshot_eligible": accepted.snapshot_schema_compatible,
                    "missing_features": missing,
                }
            )
        rows.append(
            {
                "row": number,
                "status": "duplicate"
                if duplicate
                else "error"
                if is_error
                else "warning"
                if any(i.severity == "warning" for i in row_issues)
                else "valid",
                "valid": not is_error,
                "error": is_error,
                "warning": any(i.severity == "warning" for i in row_issues),
                "duplicate": duplicate,
                "skipped": duplicate,
                "row_key": key,
                "identity": identity,
                "snapshot_eligible": bool(
                    accepted and accepted.snapshot_schema_compatible
                ),
                "missing_features": missing,
                "values": {}
                if global_errors
                else {safe_text(h, 128): safe_text(v) for h, v in zip(headers, cells)},
            }
        )

    records_by_number = dict(records)

    def diagnostic(issue):
        source = next(
            (h for h, c in zip(headers, canonical) if c == issue.column), None
        )
        cells = records_by_number.get(issue.row, [])
        index = headers.index(source) if source in headers else -1
        return {
            "row": issue.row,
            "source_column": source,
            "field": issue.column,
            "code": issue.code,
            "severity": issue.severity,
            "message": MESSAGES.get(
                issue.code, "Cần kiểm tra theo hợp đồng F07; không tự sửa dữ liệu."
            ),
            "value": safe_text(cells[index], 80) if 0 <= index < len(cells) else None,
        }

    stats = {
        "total": len(records),
        "valid": len(valid),
        "error": sum(r["error"] for r in rows),
        "warning": sum(r["warning"] for r in rows),
        "duplicate": sum(r["duplicate"] for r in rows),
        "skipped": sum(r["skipped"] for r in rows),
        "snapshot_eligible": sum(r["snapshot_eligible"] for r in rows),
        "snapshot_ineligible": sum(
            r["valid"] and not r["snapshot_eligible"] for r in rows
        )
        if entry["dataset_type"] == "behavior"
        else 0,
    }
    return {
        "stats": stats,
        "issues": [diagnostic(i) for i in issues],
        "rows": rows,
        "normalized": normalized,
        "mapping_valid": not global_errors,
        "valid": len(valid) == len(records),
    }


class UploadStore:
    """One process, strict admission cap, session-owned random references, fixed TTL."""

    def __init__(self):
        self.lock, self.entries = Lock(), {}

    def resolve_manifest(self, reference, owner):
        """Internal hand-off only; no endpoint/write. Return detached immutable snapshot."""
        with self.lock:
            self.cleanup()
            for entry in self.entries.values():
                if (
                    entry["owner"] == owner
                    and entry.get("manifest_reference") == reference
                    and "manifest" in entry
                ):
                    return json.loads(entry["manifest"])
            failure(
                410,
                "BULK_REFERENCE_EXPIRED",
                "Bản chuẩn bị đã hết hạn hoặc không thuộc phiên hiện tại.",
            )

    def cleanup(self):
        for token in list(self.entries):
            if self.entries[token]["deadline"] <= time.monotonic():
                del self.entries[token]

    def get(self, reference, owner):
        self.cleanup()
        entry = self.entries.get(reference)
        if not entry or entry["owner"] != owner:
            failure(
                410,
                "BULK_REFERENCE_EXPIRED",
                "Lô đã hết hạn, khác phiên hoặc máy chủ đã khởi động lại. Hãy chọn lại CSV.",
            )
        return entry

    def inspect(self, raw, filename, dataset_type, owner):
        headers, records = parse(raw)
        with self.lock:
            self.cleanup()
            others = [e for e in self.entries.values() if e["owner"] != owner]
            if len(others) >= 8 or sum(e["size"] for e in others) + len(raw) > CAPACITY:
                failure(
                    429,
                    "BULK_MEMORY_BUSY",
                    "Bộ nhớ lô tạm đã đầy. Chờ tối đa 10 phút rồi thử lại.",
                )
            for previous in list(self.entries):
                if self.entries[previous]["owner"] == owner:
                    del self.entries[previous]
            token = secrets.token_urlsafe(32)
            now = datetime.now(UTC)
            # Raw bytes retained, parse records on demand to avoid storing duplicated text.
            self.entries[token] = {
                "raw": raw,
                "size": len(raw),
                "headers": headers,
                "dataset_type": dataset_type,
                "filename": safe_text(
                    re.split(r"[/\\]", filename or "du-lieu.csv")[-1], 100
                )
                or "du-lieu.csv",
                "owner": owner,
                "created": now,
                "expires": now + timedelta(seconds=TTL),
                "deadline": time.monotonic() + TTL,
                "config": None,
                "preview_reference": None,
            }
            entry = self.entries[token]
            # Fingerprint canonical CSV content, not filename/BOM/newline transport.
            entry["fingerprint"] = digest([headers, [cells for _, cells in records]])
            return {
                "upload_reference": token,
                "filename": entry["filename"],
                "size": len(raw),
                "file_fingerprint": entry["fingerprint"],
                "headers": headers,
                "total_rows": len(records),
                "expires_at": entry["expires"].isoformat(),
                "contract": catalog(),
            }

    def preview(self, payload, owner):
        with self.lock:
            entry = self.get(payload.upload_reference, owner)
            config = {
                "profile": payload.profile,
                "models": [m.model_dump() for m in payload.models],
                "mapping": payload.mapping,
            }
            if entry["config"] != config:
                entry["config"] = config
                entry["preview_reference"] = secrets.token_urlsafe(32)
                entry.pop("manifest", None)
            working = {**entry, "records": parse(entry["raw"])[1]}
            result = evaluate(working, config)
            rows = result["rows"]
            if payload.status != "all":
                rows = [r for r in rows if r[payload.status]]
            start = (payload.page - 1) * payload.page_size
            page = rows[start : start + payload.page_size]
            page_numbers = {r["row"] for r in page}
            return {
                "preview_reference": entry["preview_reference"],
                "expires_at": entry["expires"].isoformat(),
                "valid": result["valid"],
                "mapping_valid": result["mapping_valid"],
                "stats": result["stats"],
                "rows": page,
                "issues": [
                    i
                    for i in result["issues"]
                    if i["row"] is None or i["row"] in page_numbers
                ],
                "page": payload.page,
                "page_size": payload.page_size,
                "filtered_rows": len(rows),
                "database_written": False,
            }

    def prepare(self, payload, owner):
        with self.lock:
            entry = self.get(payload.upload_reference, owner)
            if (
                not entry["config"]
                or payload.preview_reference != entry["preview_reference"]
            ):
                failure(
                    409,
                    "BULK_PREVIEW_CHANGED",
                    "Ánh xạ hoặc lô đã thay đổi. Hãy kiểm tra lại.",
                )
            result = evaluate(
                {**entry, "records": parse(entry["raw"])[1]}, entry["config"]
            )
            stats = result["stats"]
            if not result["mapping_valid"] or not stats["valid"]:
                failure(422, "BULK_NO_VALID_ROWS", "Chưa có dòng hợp lệ để chuẩn bị.")
            if not payload.acknowledge_review or (
                stats["error"] and not payload.accept_partial
            ):
                failure(
                    422,
                    "BULK_CONFIRMATION_REQUIRED",
                    "Cần xác nhận đã xem cảnh báo và chỉ chuyển các dòng hợp lệ.",
                )
            manifest = {
                "state": "prepared_not_imported",
                "dataset_type": entry["dataset_type"],
                "contract_version": VERSION,
                "filename": entry["filename"],
                "size": entry["size"],
                "file_fingerprint": entry["fingerprint"],
                "mapping": entry["config"]["mapping"],
                "profile": entry["config"]["profile"],
                "models": entry["config"]["models"],
                "stats": stats,
                "row_keys": [r["row_key"] for r in result["normalized"]],
                "rows": result["normalized"],
                "excluded_rows": [
                    {
                        "row": r["row"],
                        "status": r["status"],
                        "codes": sorted(
                            {
                                i["code"]
                                for i in result["issues"]
                                if i["row"] == r["row"] and i["severity"] == "error"
                            }
                        ),
                    }
                    for r in result["rows"]
                    if r["error"]
                ],
                "created_at": datetime.now(UTC).isoformat(),
                "expires_at": entry["expires"].isoformat(),
                "database_written": False,
            }
            # Immutable serialized server snapshot, never trust client counts/rows.
            if "manifest" not in entry:
                entry["manifest"] = json.dumps(
                    manifest, sort_keys=True, ensure_ascii=False
                )
                entry["manifest_reference"] = secrets.token_urlsafe(32)
            public = json.loads(entry["manifest"])
            public.pop("rows")
            public.pop("excluded_rows", None)
            public["manifest_digest"] = hashlib.sha256(
                entry["manifest"].encode()
            ).hexdigest()
            public["manifest_reference"] = entry["manifest_reference"]
            return public


uploads = UploadStore()
