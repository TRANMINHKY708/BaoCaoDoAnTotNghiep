"""Pydantic schemas for customers and behavior history."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from backend.demo_data import DEMO_BEHAVIOR


class CustomerCreate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {"external_id": "VIDEO-DEMO-001"},
        },
    )
    external_id: str = Field(min_length=1, max_length=100)


class CustomerUpdate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "external_id": "VIDEO-DEMO-001-UPDATED",
                "is_active": True,
            },
        },
    )
    external_id: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    is_active: bool | None = None


class CustomerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    external_id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    deactivated_at: datetime | None


class CustomerPage(BaseModel):
    items: list[CustomerRead]
    total: int
    offset: int
    limit: int


class BehaviorSnapshotCreate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        json_schema_extra={"example": DEMO_BEHAVIOR},
    )

    captured_at: datetime | None = None
    source: str = Field(default="manual", min_length=1, max_length=30)
    age: float = Field(alias="Age", ge=0, le=120)
    gender: str = Field(alias="Gender", min_length=1, max_length=50)
    country: str = Field(alias="Country", min_length=1, max_length=100)
    city: str = Field(alias="City", min_length=1, max_length=150)
    membership_years: float = Field(alias="Membership_Years", ge=0)
    login_frequency: float = Field(alias="Login_Frequency", ge=0)
    session_duration_avg: float = Field(alias="Session_Duration_Avg", ge=0)
    pages_per_session: float = Field(alias="Pages_Per_Session", ge=0)
    cart_abandonment_rate: float = Field(
        alias="Cart_Abandonment_Rate",
        ge=0,
        le=100,
    )
    wishlist_items: float = Field(alias="Wishlist_Items", ge=0)
    total_purchases: float = Field(alias="Total_Purchases", ge=0)
    average_order_value: float = Field(alias="Average_Order_Value", ge=0)
    days_since_last_purchase: float = Field(
        alias="Days_Since_Last_Purchase",
        ge=0,
    )
    discount_usage_rate: float = Field(
        alias="Discount_Usage_Rate",
        ge=0,
        le=100,
    )
    returns_rate: float = Field(alias="Returns_Rate", ge=0, le=100)
    email_open_rate: float = Field(alias="Email_Open_Rate", ge=0, le=100)
    customer_service_calls: float = Field(alias="Customer_Service_Calls", ge=0)
    product_reviews_written: float = Field(alias="Product_Reviews_Written", ge=0)
    social_media_engagement_score: float = Field(
        alias="Social_Media_Engagement_Score",
        ge=0,
    )
    mobile_app_usage: float = Field(alias="Mobile_App_Usage", ge=0)
    payment_method_diversity: float = Field(alias="Payment_Method_Diversity", ge=0)
    lifetime_value: float = Field(alias="Lifetime_Value", ge=0)
    credit_balance: float = Field(alias="Credit_Balance", ge=0)
    churned: bool = Field(alias="Churned")
    signup_quarter: str = Field(
        alias="Signup_Quarter",
        pattern=r"^Q[1-4]$",
    )


class BehaviorSnapshotRead(BehaviorSnapshotCreate):
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )

    id: UUID
    customer_id: UUID
    captured_at: datetime


class BehaviorSnapshotPage(BaseModel):
    items: list[BehaviorSnapshotRead]
    total: int
    offset: int
    limit: int


class PredictionHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    run_id: UUID
    model_id: UUID
    customer_id: UUID | None
    behavior_snapshot_id: UUID | None
    predicted_class: int
    purchase_level: str
    probability_low: float
    probability_medium: float
    probability_high: float
    created_at: datetime


class SegmentationHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    run_id: UUID
    model_id: UUID
    customer_id: UUID | None
    behavior_snapshot_id: UUID | None
    cluster: int
    segment_name: str
    distance_to_centroid: float
    created_at: datetime


class HistoryPage(BaseModel):
    items: list[PredictionHistoryRead | SegmentationHistoryRead]
    total: int
    offset: int
    limit: int
