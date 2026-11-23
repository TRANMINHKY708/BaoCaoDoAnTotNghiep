"""Customer identity and time-series behavior models."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    external_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    deactivated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    behavior_snapshots: Mapped[list["CustomerBehaviorSnapshot"]] = (
        relationship(
            back_populates="customer",
            cascade="all, delete-orphan",
            order_by="CustomerBehaviorSnapshot.captured_at",
        )
    )


class CustomerBehaviorSnapshot(Base):
    __tablename__ = "customer_behavior_snapshots"
    __table_args__ = (
        CheckConstraint("age >= 0 AND age <= 120", name="age_range"),
        CheckConstraint(
            "membership_years >= 0",
            name="membership_years_nonnegative",
        ),
        CheckConstraint(
            "login_frequency >= 0 AND session_duration_avg >= 0 "
            "AND pages_per_session >= 0",
            name="engagement_nonnegative",
        ),
        CheckConstraint(
            "cart_abandonment_rate BETWEEN 0 AND 100 "
            "AND discount_usage_rate BETWEEN 0 AND 100 "
            "AND returns_rate BETWEEN 0 AND 100 "
            "AND email_open_rate BETWEEN 0 AND 100",
            name="rates_percentage_range",
        ),
        CheckConstraint(
            "wishlist_items >= 0 AND total_purchases >= 0 "
            "AND average_order_value >= 0",
            name="commerce_values_nonnegative",
        ),
        CheckConstraint(
            "days_since_last_purchase >= 0 "
            "AND customer_service_calls >= 0 "
            "AND product_reviews_written >= 0",
            name="counts_nonnegative",
        ),
        CheckConstraint(
            "lifetime_value >= 0 AND credit_balance >= 0",
            name="financial_values_nonnegative",
        ),
        CheckConstraint(
            "signup_quarter IN ('Q1', 'Q2', 'Q3', 'Q4')",
            name="signup_quarter_values",
        ),
        Index(
            "ix_behavior_customer_captured_at",
            "customer_id",
            "captured_at",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    customer_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
    )
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    source: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="manual",
        server_default="manual",
    )

    age: Mapped[float] = mapped_column(Float, nullable=False)
    gender: Mapped[str] = mapped_column(String(50), nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=False)
    city: Mapped[str] = mapped_column(String(150), nullable=False)
    membership_years: Mapped[float] = mapped_column(Float, nullable=False)
    login_frequency: Mapped[float] = mapped_column(Float, nullable=False)
    session_duration_avg: Mapped[float] = mapped_column(Float, nullable=False)
    pages_per_session: Mapped[float] = mapped_column(Float, nullable=False)
    cart_abandonment_rate: Mapped[float] = mapped_column(Float, nullable=False)
    wishlist_items: Mapped[float] = mapped_column(Float, nullable=False)
    total_purchases: Mapped[float] = mapped_column(Float, nullable=False)
    average_order_value: Mapped[float] = mapped_column(Float, nullable=False)
    days_since_last_purchase: Mapped[float] = mapped_column(Float, nullable=False)
    discount_usage_rate: Mapped[float] = mapped_column(Float, nullable=False)
    returns_rate: Mapped[float] = mapped_column(Float, nullable=False)
    email_open_rate: Mapped[float] = mapped_column(Float, nullable=False)
    customer_service_calls: Mapped[float] = mapped_column(Float, nullable=False)
    product_reviews_written: Mapped[float] = mapped_column(Float, nullable=False)
    social_media_engagement_score: Mapped[float] = mapped_column(Float, nullable=False)
    mobile_app_usage: Mapped[float] = mapped_column(Float, nullable=False)
    payment_method_diversity: Mapped[float] = mapped_column(Float, nullable=False)
    lifetime_value: Mapped[float] = mapped_column(Float, nullable=False)
    credit_balance: Mapped[float] = mapped_column(Float, nullable=False)
    churned: Mapped[bool] = mapped_column(Boolean, nullable=False)
    signup_quarter: Mapped[str] = mapped_column(String(2), nullable=False)

    customer: Mapped[Customer] = relationship(
        back_populates="behavior_snapshots"
    )
