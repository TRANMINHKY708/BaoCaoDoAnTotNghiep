"""Customer, behavior, prediction, and segmentation history APIs."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from backend.db.session import get_db
from backend.schemas.customer import (
    BehaviorSnapshotCreate,
    BehaviorSnapshotPage,
    BehaviorSnapshotRead,
    CustomerCreate,
    CustomerPage,
    CustomerRead,
    CustomerUpdate,
    HistoryPage,
)
from backend.services import customer_service


router = APIRouter(prefix="/customers", tags=["Customers"])


@router.post("", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    return customer_service.create_customer(db, payload)


@router.get("", response_model=CustomerPage)
def list_customers(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    include_inactive: bool = False,
    db: Session = Depends(get_db),
):
    items, total = customer_service.list_customers(
        db,
        offset=offset,
        limit=limit,
        include_inactive=include_inactive,
    )
    return CustomerPage(items=items, total=total, offset=offset, limit=limit)


@router.get("/{customer_id}", response_model=CustomerRead)
def get_customer(customer_id: UUID, db: Session = Depends(get_db)):
    return customer_service.get_customer_or_404(db, customer_id)


@router.patch("/{customer_id}", response_model=CustomerRead)
def update_customer(
    customer_id: UUID,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
):
    return customer_service.update_customer(db, customer_id, payload)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_customer(
    customer_id: UUID,
    db: Session = Depends(get_db),
):
    customer_service.deactivate_customer(db, customer_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{customer_id}/behaviors",
    response_model=BehaviorSnapshotRead,
    status_code=status.HTTP_201_CREATED,
)
def add_behavior_snapshot(
    customer_id: UUID,
    payload: BehaviorSnapshotCreate,
    db: Session = Depends(get_db),
):
    return customer_service.add_behavior_snapshot(db, customer_id, payload)


@router.get("/{customer_id}/behaviors", response_model=BehaviorSnapshotPage)
def list_behavior_snapshots(
    customer_id: UUID,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    items, total = customer_service.list_behavior_snapshots(
        db,
        customer_id,
        offset=offset,
        limit=limit,
    )
    return BehaviorSnapshotPage(
        items=items,
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get("/{customer_id}/predictions", response_model=HistoryPage)
def list_prediction_history(
    customer_id: UUID,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    items, total = customer_service.list_prediction_history(
        db,
        customer_id,
        offset=offset,
        limit=limit,
    )
    return HistoryPage(items=items, total=total, offset=offset, limit=limit)


@router.get("/{customer_id}/segments", response_model=HistoryPage)
def list_segmentation_history(
    customer_id: UUID,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    items, total = customer_service.list_segmentation_history(
        db,
        customer_id,
        offset=offset,
        limit=limit,
    )
    return HistoryPage(items=items, total=total, offset=offset, limit=limit)
