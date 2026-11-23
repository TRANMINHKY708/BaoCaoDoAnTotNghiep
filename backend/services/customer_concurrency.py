"""Optional v1 conditional writes. No schema/version column; no legacy opt-in."""

from datetime import timezone
import hashlib
import json
import re

from fastapi import HTTPException
from sqlalchemy import select

from backend.models.customer import Customer
from backend.schemas.customer import CustomerRead


def customer_etag(customer):
    values = CustomerRead.model_validate(customer).model_dump(mode="json")
    for key in ("created_at", "updated_at", "deactivated_at"):
        value = getattr(customer, key)
        values[key] = value.astimezone(timezone.utc).isoformat(timespec="microseconds") if value else None
    encoded = json.dumps(values, sort_keys=True, separators=(",", ":")).encode()
    return '"' + hashlib.sha256(encoded).hexdigest() + '"'


def locked_customer(db, customer_id, expected_etag):
    customer = db.scalar(select(Customer).where(Customer.id == customer_id).with_for_update().execution_options(populate_existing=True))
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    header = expected_etag.strip()
    # RFC9110 wildcard checks existence only, not version freshness.
    if header == "*":
        return customer
    tag = r'(?:W/)?"[\x21\x23-\x7e\x80-\xff]*"'
    if len(header) > 2048 or re.fullmatch(r"\s*" + tag + r"(?:\s*,\s*" + tag + r")*\s*", header) is None:
        raise HTTPException(status_code=422, detail="Invalid If-Match header")
    if customer_etag(customer) not in re.findall(tag, header):
        raise HTTPException(status_code=412, detail={"code": "PRECONDITION_FAILED",
                            "message": "Customer changed since it was read; reload and retry"})
    return customer
