"""CSV upload, validation, batch inference, and CSV export services."""

import io
from typing import Literal

import pandas as pd
from fastapi import HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from backend.services.model_service import model_service
from backend.services.prediction_service import (
    CLASS_NAMES,
    _pipeline_feature_types,
    prepare_customer,
)
from backend.services.persistence_service import persist_inference_results
from backend.core.security_csv import safe_export, secured_export


MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_ROWS = 1000
CHUNK_SIZE = 1000
PredictionTask = Literal["purchase-level", "segment"]


def get_model_config(task: PredictionTask):
    if task == "purchase-level":
        model = model_service.xgboost
        metadata = model_service.xgboost_metadata
    else:
        model = model_service.kmeans
        metadata = model_service.kmeans_metadata

    if model is None or metadata is None:
        raise HTTPException(
            status_code=503,
            detail=f"Model for {task} is unavailable",
        )

    features = metadata.get(
        "input_features",
        metadata.get("features"),
    )
    if not features:
        raise HTTPException(
            status_code=500,
            detail=f"Feature metadata missing for {task}",
        )

    return model, metadata, features


def _read_csv(content: bytes) -> pd.DataFrame:
    if not content:
        raise HTTPException(
            status_code=422,
            detail="Uploaded CSV file is empty",
        )

    try:
        frame = pd.read_csv(io.BytesIO(content), nrows=MAX_ROWS + 1 if secured_export.get() else None)
    except (UnicodeDecodeError, pd.errors.ParserError) as exc:
        raise HTTPException(
            status_code=422,
            detail="Unable to parse CSV file as UTF-8 CSV",
        ) from exc
    except pd.errors.EmptyDataError as exc:
        raise HTTPException(
            status_code=422,
            detail="Uploaded CSV file is empty",
        ) from exc

    if frame.empty:
        raise HTTPException(
            status_code=422,
            detail="CSV must contain at least one customer row",
        )
    if len(frame) > MAX_ROWS:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "CSV row limit exceeded",
                "maximum_rows": MAX_ROWS,
                "received_rows": len(frame),
            },
        )

    return frame


def _validate_csv_rows(
    frame: pd.DataFrame,
    model,
    features: list,
) -> pd.DataFrame:
    missing_columns = [
        feature
        for feature in features
        if feature not in frame.columns
    ]
    if missing_columns:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "CSV is missing required columns",
                "missing_columns": missing_columns,
            },
        )

    validated_rows = []
    errors = []
    numeric_features, _ = _pipeline_feature_types(
        model,
        features,
    )

    for index, row in frame[features].iterrows():
        customer = row.to_dict()
        for feature in numeric_features:
            value = customer[feature]
            if isinstance(value, str):
                try:
                    customer[feature] = float(value)
                except ValueError:
                    pass

        try:
            validated_rows.append(
                prepare_customer(
                    customer=customer,
                    pipeline=model,
                    features=features,
                )
            )
        except HTTPException as exc:
            errors.append({
                "row": int(index) + 2,
                "detail": exc.detail,
            })

    if errors:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Invalid rows in CSV",
                "errors": errors,
            },
        )

    return pd.concat(validated_rows, ignore_index=True)


def _predict_purchase_level_csv(
    result: pd.DataFrame,
    model_frame: pd.DataFrame,
    model,
    metadata: dict,
) -> pd.DataFrame:
    class_mapping = metadata.get("class_mapping", {})
    classifier = model.named_steps["classifier"]
    class_ids = [int(value) for value in classifier.classes_]

    predictions = []
    probability_chunks = []
    for start in range(0, len(model_frame), CHUNK_SIZE):
        chunk = model_frame.iloc[start : start + CHUNK_SIZE]
        predictions.extend(model.predict(chunk))
        probability_chunks.append(model.predict_proba(chunk))

    probabilities = pd.DataFrame(
        pd.concat(
            [pd.DataFrame(chunk) for chunk in probability_chunks],
            ignore_index=True,
        ).to_numpy(),
        columns=class_ids,
    )
    predicted_classes = [int(value) for value in predictions]

    result["Predicted_Class"] = predicted_classes
    result["Purchase_Level_Predicted"] = [
        class_mapping.get(str(value), CLASS_NAMES[value])
        for value in predicted_classes
    ]

    for class_id in class_ids:
        class_name = class_mapping.get(
            str(class_id),
            CLASS_NAMES[class_id],
        )
        result[f"Probability_{class_name}"] = probabilities[
            class_id
        ].astype(float)

    return result


def _predict_segment_csv(
    result: pd.DataFrame,
    model_frame: pd.DataFrame,
    model,
    metadata: dict,
) -> pd.DataFrame:
    clusters = []
    distance_chunks = []
    for start in range(0, len(model_frame), CHUNK_SIZE):
        chunk = model_frame.iloc[start : start + CHUNK_SIZE]
        clusters.extend(model.predict(chunk))
        distance_chunks.append(model.transform(chunk))

    distances = pd.concat(
        [pd.DataFrame(chunk) for chunk in distance_chunks],
        ignore_index=True,
    ).to_numpy()
    cluster_ids = [int(value) for value in clusters]
    cluster_names = metadata["cluster_names"]

    result["Cluster"] = cluster_ids
    result["Segment_Name"] = [
        cluster_names[str(cluster)]
        for cluster in cluster_ids
    ]
    result["Distance_To_Centroid"] = [
        float(distances[index, cluster])
        for index, cluster in enumerate(cluster_ids)
    ]
    return result


def _csv_response(frame: pd.DataFrame, filename: str):
    content = safe_export(frame).to_csv(index=False).encode("utf-8-sig")
    return StreamingResponse(
        io.BytesIO(content),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            )
        },
    )


async def process_csv_prediction(
    file: UploadFile,
    task: PredictionTask,
    save_results: bool = False,
    db: Session | None = None,
):
    filename = file.filename or ""
    if not filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=422,
            detail="Only .csv files are accepted",
        )

    content = await file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail={
                "message": "CSV file exceeds 10 MB limit",
                "maximum_bytes": MAX_FILE_SIZE,
            },
        )

    if secured_export.get():
        return await run_in_threadpool(_process_csv_contents, content, task, save_results, db)
    return _process_csv_contents(content, task, save_results, db)


def _process_csv_contents(content, task, save_results, db):
    frame = _read_csv(content).reset_index(drop=True)
    model, metadata, features = get_model_config(task)
    model_frame = _validate_csv_rows(frame, model, features)
    result = frame.copy()

    if task == "purchase-level":
        result = _predict_purchase_level_csv(
            result,
            model_frame,
            model,
            metadata,
        )
        output_filename = "purchase_level_predictions.csv"
        persistence_task = "classification"
        persistence_results = [
            {
                "predicted_class": int(row["Predicted_Class"]),
                "purchase_level": row["Purchase_Level_Predicted"],
                "probabilities": {
                    "Low": float(row["Probability_Low"]),
                    "Medium": float(row["Probability_Medium"]),
                    "High": float(row["Probability_High"]),
                },
            }
            for _, row in result.iterrows()
        ]
    else:
        result = _predict_segment_csv(
            result,
            model_frame,
            model,
            metadata,
        )
        output_filename = "customer_segmentation_predictions.csv"
        persistence_task = "segmentation"
        persistence_results = [
            {
                "cluster": int(row["Cluster"]),
                "segment_name": row["Segment_Name"],
                "distance_to_centroid": float(
                    row["Distance_To_Centroid"]
                ),
            }
            for _, row in result.iterrows()
        ]

    if save_results:
        if db is None:
            raise HTTPException(
                status_code=503,
                detail="Database persistence is not configured",
            )
        persist_inference_results(
            db,
            task=persistence_task,
            run_type="csv",
            inputs=model_frame.to_dict(orient="records"),
            results=persistence_results,
            source="csv",
        )

    return _csv_response(result, output_filename)
