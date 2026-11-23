"""Transactional customer CRUD and history queries."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.models.customer import Customer, CustomerBehaviorSnapshot
from backend.models.prediction import PredictionResult, SegmentationResult
from backend.schemas.customer import BehaviorSnapshotCreate, CustomerCreate, CustomerUpdate
from backend.services.customer_concurrency import locked_customer


def get_customer_or_404(db: Session, customer_id: UUID) -> Customer:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


def create_customer(db: Session, payload: CustomerCreate) -> Customer:
    customer = Customer(external_id=payload.external_id)
    db.add(customer)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Customer external_id already exists",
        ) from exc
    db.refresh(customer)
    return customer


def list_customers(
    db: Session,
    *,
    offset: int,
    limit: int,
    include_inactive: bool,
) -> tuple[list[Customer], int]:
    filters = [] if include_inactive else [Customer.is_active.is_(True)]
    total = db.scalar(
        select(func.count(Customer.id)).where(*filters)
    ) or 0
    items = list(
        db.scalars(
            select(Customer)
            .where(*filters)
            .order_by(Customer.created_at.desc(), Customer.id)
            .offset(offset)
            .limit(limit)
        )
    )
    return items, total


def update_customer(
    db: Session,
    customer_id: UUID,
    payload: CustomerUpdate,
    *,
    expected_etag: str | None = None,
) -> Customer:
    customer = (locked_customer(db, customer_id, expected_etag) if expected_etag is not None
                else get_customer_or_404(db, customer_id))
    changes = payload.model_dump(exclude_unset=True)

    if "external_id" in changes:
        customer.external_id = changes["external_id"]
    if "is_active" in changes:
        customer.is_active = changes["is_active"]
        customer.deactivated_at = (
            None
            if customer.is_active
            else datetime.now(timezone.utc)
        )

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Customer external_id already exists",
        ) from exc
    db.refresh(customer)
    return customer


def deactivate_customer(db: Session, customer_id: UUID, *, expected_etag: str | None = None) -> None:
    customer = (locked_customer(db, customer_id, expected_etag) if expected_etag is not None
                else get_customer_or_404(db, customer_id))
    customer.is_active = False
    customer.deactivated_at = datetime.now(timezone.utc)
    db.commit()


def add_behavior_snapshot(
    db: Session,
    customer_id: UUID,
    payload: BehaviorSnapshotCreate,
) -> CustomerBehaviorSnapshot:
    customer = get_customer_or_404(db, customer_id)
    if not customer.is_active:
        raise HTTPException(
            status_code=409,
            detail="Cannot add behavior to an inactive customer",
        )

    values = payload.model_dump(by_alias=False)
    if values["captured_at"] is None:
        values.pop("captured_at")
    snapshot = CustomerBehaviorSnapshot(
        customer_id=customer_id,
        **values,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


def list_behavior_snapshots(
    db: Session,
    customer_id: UUID,
    *,
    offset: int,
    limit: int,
) -> tuple[list[CustomerBehaviorSnapshot], int]:
    get_customer_or_404(db, customer_id)
    condition = CustomerBehaviorSnapshot.customer_id == customer_id
    total = db.scalar(
        select(func.count(CustomerBehaviorSnapshot.id)).where(condition)
    ) or 0
    items = list(
        db.scalars(
            select(CustomerBehaviorSnapshot)
            .where(condition)
            .order_by(CustomerBehaviorSnapshot.captured_at.desc())
            .offset(offset)
            .limit(limit)
        )
    )
    return items, total


def list_prediction_history(
    db: Session,
    customer_id: UUID,
    *,
    offset: int,
    limit: int,
) -> tuple[list[PredictionResult], int]:
    get_customer_or_404(db, customer_id)
    condition = PredictionResult.customer_id == customer_id
    total = db.scalar(
        select(func.count(PredictionResult.id)).where(condition)
    ) or 0
    items = list(
        db.scalars(
            select(PredictionResult)
            .where(condition)
            .order_by(PredictionResult.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
    )
    return items, total


def list_segmentation_history(
    db: Session,
    customer_id: UUID,
    *,
    offset: int,
    limit: int,
) -> tuple[list[SegmentationResult], int]:
    get_customer_or_404(db, customer_id)
    condition = SegmentationResult.customer_id == customer_id
    total = db.scalar(
        select(func.count(SegmentationResult.id)).where(condition)
    ) or 0
    items = list(
        db.scalars(
            select(SegmentationResult)
            .where(condition)
            .order_by(SegmentationResult.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
    )
    return items, total
