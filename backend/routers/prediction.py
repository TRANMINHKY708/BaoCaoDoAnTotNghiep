"""Routes for purchase-level and customer-segment predictions."""

from typing import Annotated

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from backend.db.session import get_optional_db
from backend.demo_data import (
    DEMO_KMEANS_BATCH_REQUEST,
    DEMO_KMEANS_REQUEST,
    DEMO_XGBOOST_BATCH_REQUEST,
    DEMO_XGBOOST_REQUEST,
)
from backend.services.csv_prediction_service import (
    process_csv_prediction,
)
from backend.schemas.prediction import (
    BatchPredictionRequest,
    PredictionRequest,
)
from backend.services.prediction_service import (
    predict_purchase_level,
    predict_purchase_level_batch,
    predict_segment,
    predict_segment_batch,
)
from backend.services.persistence_service import persist_inference_results


router = APIRouter(
    prefix="/predict",
    tags=["AI Prediction"],
)


@router.post("/purchase-level")
def purchase_level(
    request: Annotated[
        PredictionRequest,
        Body(
            openapi_examples={
                "video-demo": {
                    "summary": "Dữ liệu mẫu sẵn sàng chạy",
                    "value": DEMO_XGBOOST_REQUEST,
                }
            }
        ),
    ],
    db: Session | None = Depends(get_optional_db),
):
    result = predict_purchase_level(request.customer)
    if request.save_result:
        if db is None:
            raise HTTPException(
                status_code=503,
                detail="Database persistence is not configured",
            )
        persist_inference_results(
            db,
            task="classification",
            run_type="single",
            inputs=[request.customer],
            results=[result],
            customer_ids=[request.customer_id],
            snapshot_ids=[request.behavior_snapshot_id],
        )
    return result


@router.post("/segment")
def segment(
    request: Annotated[
        PredictionRequest,
        Body(
            openapi_examples={
                "video-demo": {
                    "summary": "Dữ liệu mẫu sẵn sàng chạy",
                    "value": DEMO_KMEANS_REQUEST,
                }
            }
        ),
    ],
    db: Session | None = Depends(get_optional_db),
):
    result = predict_segment(request.customer)
    if request.save_result:
        if db is None:
            raise HTTPException(
                status_code=503,
                detail="Database persistence is not configured",
            )
        persist_inference_results(
            db,
            task="segmentation",
            run_type="single",
            inputs=[request.customer],
            results=[result],
            customer_ids=[request.customer_id],
            snapshot_ids=[request.behavior_snapshot_id],
        )
    return result


@router.post("/batch/purchase-level")
def batch_purchase_level(
    request: Annotated[
        BatchPredictionRequest,
        Body(
            openapi_examples={
                "video-demo": {
                    "summary": "Hai khách hàng mẫu",
                    "value": DEMO_XGBOOST_BATCH_REQUEST,
                }
            }
        ),
    ],
    db: Session | None = Depends(get_optional_db),
):
    response = predict_purchase_level_batch(request.customers)
    if request.save_results:
        if db is None:
            raise HTTPException(
                status_code=503,
                detail="Database persistence is not configured",
            )
        persist_inference_results(
            db,
            task="classification",
            run_type="batch",
            inputs=request.customers,
            results=response["results"],
            customer_ids=request.customer_ids,
            snapshot_ids=request.behavior_snapshot_ids,
        )
    return response


@router.post("/batch/segment")
def batch_segment(
    request: Annotated[
        BatchPredictionRequest,
        Body(
            openapi_examples={
                "video-demo": {
                    "summary": "Hai khách hàng mẫu",
                    "value": DEMO_KMEANS_BATCH_REQUEST,
                }
            }
        ),
    ],
    db: Session | None = Depends(get_optional_db),
):
    response = predict_segment_batch(request.customers)
    if request.save_results:
        if db is None:
            raise HTTPException(
                status_code=503,
                detail="Database persistence is not configured",
            )
        persist_inference_results(
            db,
            task="segmentation",
            run_type="batch",
            inputs=request.customers,
            results=response["results"],
            customer_ids=request.customer_ids,
            snapshot_ids=request.behavior_snapshot_ids,
        )
    return response


@router.post("/csv/purchase-level")
async def csv_purchase_level(
    file: UploadFile = File(...),
    save_results: bool = Form(False),
    db: Session | None = Depends(get_optional_db),
):
    return await process_csv_prediction(
        file=file,
        task="purchase-level",
        save_results=save_results,
        db=db,
    )


@router.post("/csv/segment")
async def csv_segment(
    file: UploadFile = File(...),
    save_results: bool = Form(False),
    db: Session | None = Depends(get_optional_db),
):
    return await process_csv_prediction(
        file=file,
        task="segment",
        save_results=save_results,
        db=db,
    )
