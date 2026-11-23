"""Bounded CSV/row validation. No file IO, DB, fitted preprocessing or ML calls."""

import csv
import io
import math
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Literal

from pydantic import ValidationError

from backend.bulk.contract import (
    FORBIDDEN,
    MAX_BYTES,
    MAX_ROWS,
    METADATA,
    MODEL_SCHEMAS,
    MONEY_FIELDS,
    VERSION,
    BehaviorRow,
    OrderRow,
    timestamp,
)
from backend.schemas.v1 import BehaviorCreateV1
from src.data.dataset_contract import FIELDS

SPECS = {spec.name: spec for spec in FIELDS}
NUMERIC = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$")


class InvalidCell(ValueError):
    def __init__(self, column):
        super().__init__("Invalid cell")
        self.column = column


@dataclass(frozen=True)
class Issue:
    code: str
    severity: Literal["error", "warning"]
    row: int | None = None
    column: str | None = None
    message: str = "Dữ liệu không đáp ứng hợp đồng. Không sửa giá trị tự động."


@dataclass
class ValidatedRow:
    row: int
    value: object = field(repr=False)
    snapshot_schema_compatible: bool = False
    model_inputs: dict = field(default_factory=dict, repr=False)


@dataclass
class ValidationReport:
    dataset_type: str
    total_rows: int = 0
    rows: list[ValidatedRow] = field(default_factory=list, repr=False)
    issues: list[Issue] = field(default_factory=list)
    contract_version: str = VERSION

    @property
    def valid(self):
        return self.total_rows > 0 and not any(
            i.severity == "error" for i in self.issues
        )

    @property
    def valid_rows(self):
        if any(i.severity == "error" and i.row is None for i in self.issues):
            return []
        invalid = {i.row for i in self.issues if i.severity == "error"}
        return [r for r in self.rows if r.row not in invalid]

    def summary(self):
        """Safe for a future preview API: never return cell values in diagnostics."""
        return {
            "contract_version": self.contract_version,
            "dataset_type": self.dataset_type,
            "total_rows": self.total_rows,
            "valid": self.valid,
            "valid_row_count": len(self.valid_rows),
            "error_count": sum(i.severity == "error" for i in self.issues),
            "warning_count": sum(i.severity == "warning" for i in self.issues),
            "database_write_authorized": False,
            "model_suitability": "not_verified",
        }


def _issue(report, code, row=None, column=None, warning=False):
    report.issues.append(Issue(code, "warning" if warning else "error", row, column))


def _valid_options(dataset_type, profile, models):
    valid_models = isinstance(models, (list, tuple)) and all(
        isinstance(m, tuple)
        and len(m) == 2
        and all(isinstance(v, str) for v in m)
        and m in MODEL_SCHEMAS
        for m in models
    )
    return (
        isinstance(dataset_type, str)
        and isinstance(profile, str)
        and dataset_type in {"behavior", "orders"}
        and profile in {"snapshot", "model_input"}
        and valid_models
        and not (dataset_type == "orders" and models)
        and not (dataset_type == "behavior" and profile == "model_input" and not models)
    )


def _number(value, binary=False):
    if value is None or value == "":
        return None
    if binary and isinstance(value, bool):
        return float(value)
    if binary and value in ("true", "false", "True", "False"):
        return 1.0 if value in ("true", "True") else 0.0
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        raise TypeError("Invalid number")
    if isinstance(value, str) and (len(value) > 64 or not NUMERIC.fullmatch(value)):
        raise ValueError("Invalid number")
    number = float(value)
    if not math.isfinite(number) or (binary and number not in (0, 1)):
        raise ValueError("Invalid number")
    return number


def _order_money(value):
    if value is None or value == "":
        return None
    if isinstance(value, bool) or not isinstance(value, (str, int, Decimal)):
        raise TypeError("Use exact decimal money")
    if isinstance(value, str) and (len(value) > 64 or not NUMERIC.fullmatch(value)):
        raise ValueError("Invalid decimal")
    result = Decimal(value)
    if not result.is_finite():
        raise ValueError("Invalid decimal")
    return result


def _normalize(raw, kind):
    value = dict(raw)
    for name, item in value.items():
        if isinstance(item, str) and any(ord(c) < 32 or ord(c) == 127 for c in item):
            raise InvalidCell(name)
    times = (
        ("captured_at", "observation_start", "observation_end")
        if kind == "behavior"
        else ("ordered_at", "observed_at")
    )
    for name in times:
        if name in value and value[name] == "":
            value[name] = None
    for name in ("currency", "payment_method"):
        if name in value and value[name] == "":
            value[name] = None
    if kind == "behavior":
        for name in value.keys() & SPECS.keys():
            try:
                if SPECS[name].kind != "text":
                    value[name] = _number(value[name], name == "Churned")
                elif value[name] == "":
                    value[name] = None
            except (ValueError, TypeError, OverflowError):
                raise InvalidCell(name) from None
    else:
        for name in ("order_total", "discount_amount"):
            if name in value:
                try:
                    value[name] = _order_money(value[name])
                except (ValueError, TypeError, InvalidOperation):
                    raise InvalidCell(name) from None
    return value


def validate_rows(
    records,
    *,
    dataset_type,
    as_of: datetime,
    profile="snapshot",
    models=(),
    row_numbers=None,
):
    """Pure boundary. Schema-valid is not approval to write or run a model."""
    report = ValidationReport(
        dataset_type, len(records) if isinstance(records, (list, tuple)) else 0
    )
    try:
        cutoff = timestamp(as_of)
    except (ValueError, TypeError):
        _issue(report, "INVALID_AS_OF")
        return report
    if not _valid_options(dataset_type, profile, models):
        _issue(report, "INVALID_VALIDATION_OPTIONS")
        return report
    if not isinstance(records, (list, tuple)) or not records or len(records) > MAX_ROWS:
        _issue(report, "ROW_LIMIT")
        return report
    numbers = list(range(2, len(records) + 2)) if row_numbers is None else row_numbers
    if (
        len(numbers) != len(records)
        or any(type(n) is not int or n < 2 for n in numbers)
        or len(set(numbers)) != len(numbers)
    ):
        _issue(report, "INVALID_ROW_NUMBERS")
        return report
    if models:
        _issue(report, "MODEL_SEMANTICS_AND_TIME_UNVERIFIED", warning=True)
    if dataset_type == "orders":
        _issue(report, "ORDER_CONTRACT_ONLY_NOT_ML_INPUT", warning=True)
    keys, customers, currencies = defaultdict(list), defaultdict(list), defaultdict(set)
    for number, raw in zip(numbers, records):
        if not isinstance(raw, dict):
            _issue(report, "INVALID_ROW", number)
            continue
        if any(str(name).lower() in {x.lower() for x in FORBIDDEN} for name in raw):
            _issue(report, "FORBIDDEN_INPUT_COLUMN", number)
            continue
        allowed = (
            set(METADATA) | set(SPECS)
            if dataset_type == "behavior"
            else set(OrderRow.model_fields)
        )
        if set(raw) - allowed:
            _issue(report, "UNKNOWN_COLUMN", number)
            continue
        required = (
            {"external_id", "captured_at", "source"}
            if dataset_type == "behavior"
            else {
                name
                for name, spec in OrderRow.model_fields.items()
                if spec.is_required()
            }
        )
        if dataset_type == "behavior":
            if profile == "snapshot":
                required |= set(SPECS)
            for model in models:
                required |= set(MODEL_SCHEMAS[model].model_fields)
        absent = required - set(raw)
        if absent:
            for name in sorted(absent):
                _issue(report, "MISSING_REQUIRED_COLUMN", number, name)
            continue
        try:
            parsed = _normalize(raw, dataset_type)
        except InvalidCell as exc:
            _issue(report, "INVALID_CELL_VALUE", number, exc.column)
            continue
        except (ValueError, TypeError, OverflowError, InvalidOperation):
            _issue(report, "INVALID_NUMERIC_VALUE", number)
            continue
        try:
            value = (
                BehaviorRow if dataset_type == "behavior" else OrderRow
            ).model_validate(parsed)
        except ValidationError as exc:
            for error in exc.errors(
                include_input=False, include_context=False, include_url=False
            ):
                column = (
                    error["loc"][0]
                    if error["loc"] and error["loc"][0] in allowed
                    else None
                )
                _issue(report, "ROW_SCHEMA_ERROR", number, column)
            continue
        when = value.captured_at if dataset_type == "behavior" else value.observed_at
        if when > cutoff:
            _issue(report, "OBSERVATION_IN_FUTURE", number)
            continue
        row = ValidatedRow(number, value)
        if dataset_type == "behavior":
            key = (value.external_id, value.captured_at)
            keys[key].append(row)
            customers[value.external_id].append(row)
            missing = [name for name in SPECS if getattr(value, name) is None]
            if profile == "snapshot" and missing:
                for name in missing:
                    _issue(report, "MISSING_SNAPSHOT_FEATURE", number, name)
            if not missing:
                payload = {name: getattr(value, name) for name in SPECS}
                payload.update(
                    captured_at=value.captured_at,
                    source=value.source,
                    Churned=bool(value.Churned),
                )
                try:
                    BehaviorCreateV1.model_validate(payload)
                    row.snapshot_schema_compatible = True
                except ValidationError:
                    _issue(report, "SNAPSHOT_SCHEMA_INCOMPATIBLE", number)
            else:
                _issue(
                    report, "SNAPSHOT_INCOMPLETE_NO_DEFAULT_FILL", number, warning=True
                )
            for model in models:
                schema = MODEL_SCHEMAS[model]
                selected = {name: getattr(value, name) for name in schema.model_fields}
                if not any(v is not None for v in selected.values()):
                    _issue(report, "MODEL_ALL_FEATURES_MISSING", number)
                    continue
                try:
                    row.model_inputs[model] = schema.model_validate(
                        selected
                    ).model_dump()
                except ValidationError:
                    _issue(report, "MODEL_INPUT_INCOMPATIBLE", number)
            if value.observation_start is None:
                _issue(report, "OBSERVATION_WINDOW_UNSPECIFIED", number, warning=True)
            if value.currency is None and any(
                getattr(value, name) is not None for name in MONEY_FIELDS
            ):
                _issue(report, "CURRENCY_UNIT_UNVERIFIED", number, warning=True)
            if (
                value.Membership_Years is not None
                and value.Age is not None
                and value.Membership_Years > value.Age
            ):
                _issue(report, "MEMBERSHIP_EXCEEDS_AGE_REVIEW", number, warning=True)
            if any(
                getattr(value, name) is not None
                for name in ("Lifetime_Value", "Churned", "Total_Purchases")
            ):
                _issue(
                    report,
                    "POST_OUTCOME_FIELDS_NOT_CLASSIFIER_AUTHORIZATION",
                    number,
                    warning=True,
                )
            if (
                value.Total_Purchases is not None
                and not value.Total_Purchases.is_integer()
            ):
                _issue(
                    report,
                    "FRACTIONAL_PURCHASES_PRESERVED",
                    number,
                    "Total_Purchases",
                    warning=True,
                )
        else:
            keys[value.order_id].append(row)
            customers[value.external_id].append(row)
            currencies[value.external_id].add(value.currency)
        for name, item in parsed.items():
            if isinstance(item, str) and item.lstrip().startswith(("=", "+", "-", "@")):
                _issue(report, "SPREADSHEET_LITERAL_PREFIX", number, name, warning=True)
        report.rows.append(row)
    for duplicates in keys.values():
        if len(duplicates) > 1:
            equal = all(
                row.value.model_dump() == duplicates[0].value.model_dump()
                for row in duplicates
            )
            code = (
                "DUPLICATE_ORDER_ID"
                if dataset_type == "orders"
                else "DUPLICATE_ROW"
                if equal
                else "CONFLICTING_CUSTOMER_SNAPSHOT"
            )
            for row in duplicates:
                _issue(report, code, row.row)
    if dataset_type == "behavior":
        for rows in customers.values():
            if len({row.value.source for row in rows}) > 1:
                for row in rows:
                    _issue(
                        report,
                        "CROSS_SOURCE_ID_COLLISION_REVIEW",
                        row.row,
                        warning=True,
                    )
            if len({row.value.captured_at for row in rows}) > 1:
                for row in rows:
                    _issue(
                        report,
                        "MULTIPLE_OBSERVATIONS_SAME_CUSTOMER",
                        row.row,
                        warning=True,
                    )
    else:
        if len({row.value.observed_at for row in report.rows}) > 1:
            _issue(report, "MIXED_ORDER_OBSERVATION_TIMES_REVIEW", warning=True)
        for key, values in currencies.items():
            if len(values) > 1:
                for row in customers[key]:
                    _issue(
                        report,
                        "MIXED_CURRENCY_NO_IMPLICIT_CONVERSION",
                        row.row,
                        warning=True,
                    )
    return report


def validate_csv(
    contents: bytes, *, dataset_type, as_of, profile="snapshot", models=(), mapping=None
):
    """mapping is explicit {source_column: canonical_column}, never fuzzy guessing."""
    report = ValidationReport(dataset_type)
    if not _valid_options(dataset_type, profile, models):
        _issue(report, "INVALID_VALIDATION_OPTIONS")
        return report
    if not isinstance(contents, bytes) or len(contents) > MAX_BYTES:
        _issue(report, "FILE_SIZE_OR_TYPE")
        return report
    try:
        text = contents.decode("utf-8-sig")
        if len(text.split("\n", 1)[0]) > 8192:
            _issue(report, "INVALID_HEADERS")
            return report
        reader = csv.reader(io.StringIO(text), strict=True)
        headers = next(reader)
        if (
            not headers
            or len(headers) > 64
            or any(
                not h or len(h) > 128 or h != h.strip() or any(ord(c) < 32 for c in h)
                for h in headers
            )
            or len(set(headers)) != len(headers)
        ):
            _issue(report, "INVALID_HEADERS")
            return report
        if any(h.lower() in {x.lower() for x in FORBIDDEN} for h in headers):
            _issue(report, "FORBIDDEN_INPUT_COLUMN")
            return report
        mapping = {} if mapping is None else mapping
        if not isinstance(mapping, dict) or set(mapping) - set(headers):
            _issue(report, "INVALID_MAPPING")
            return report
        canonical = [mapping.get(h, h) for h in headers]
        allowed = (
            set(METADATA) | set(SPECS)
            if dataset_type == "behavior"
            else set(OrderRow.model_fields)
        )
        if any(
            not isinstance(name, str) or name not in allowed for name in canonical
        ) or len(set(canonical)) != len(canonical):
            _issue(report, "AMBIGUOUS_OR_UNKNOWN_MAPPING")
            return report
        required = (
            {"external_id", "captured_at", "source"}
            if dataset_type == "behavior"
            else {
                name
                for name, spec in OrderRow.model_fields.items()
                if spec.is_required()
            }
        )
        if dataset_type == "behavior":
            if profile == "snapshot":
                required |= set(SPECS)
            for model in models:
                if model in MODEL_SCHEMAS:
                    required |= set(MODEL_SCHEMAS[model].model_fields)
        for name in sorted(required - set(canonical)):
            _issue(report, "MISSING_REQUIRED_COLUMN", column=name)
        if report.issues:
            return report
        records, numbers, seen = [], [], 0
        for number, cells in enumerate(reader, 2):
            if not cells:
                continue
            seen += 1
            if seen > MAX_ROWS:
                report.total_rows = seen
                _issue(report, "ROW_LIMIT")
                return report
            if len(cells) != len(headers):
                _issue(report, "ROW_WIDTH_MISMATCH", number)
                continue
            records.append(dict(zip(canonical, cells)))
            numbers.append(number)
        result = validate_rows(
            records,
            dataset_type=dataset_type,
            as_of=as_of,
            profile=profile,
            models=models,
            row_numbers=numbers,
        )
        result.issues[:0] = report.issues
        result.total_rows += sum(
            issue.code == "ROW_WIDTH_MISMATCH" for issue in report.issues
        )
        return result
    except (UnicodeDecodeError, StopIteration, csv.Error):
        _issue(report, "INVALID_UTF8_OR_CSV")
        return report
