"""CSV adapter for explicit model versions; does not alter legacy CSV behavior."""

import csv
import io

import pandas as pd
from fastapi import HTTPException
from fastapi.responses import Response
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from backend.services.csv_prediction_service import MAX_FILE_SIZE, MAX_ROWS
from backend.services.versioned_models import INPUT_MODELS, ensure_persistence_allowed, failure, infer
from backend.core.security_csv import safe_export, secured_export


RESERVED = {"Model_ID", "Model_Version", "Generated_At", "Prediction_Task", "Predicted_Class",
            "Purchase_Level_Predicted", "Probability_Low", "Probability_Medium", "Probability_High",
            "Cluster", "Segment_ID", "Segment_Name", "Distance_To_Centroid", "Distance_Kind"}


async def csv_prediction(file, task, version, requested_save, db):
    ensure_persistence_allowed(task, version, requested_save)
    if not (file.filename or "").lower().endswith(".csv"):
        failure(422, "INVALID_CSV_FILE", "Expected a UTF-8 .csv file")
    contents = await file.read(MAX_FILE_SIZE + 1)
    if len(contents) > MAX_FILE_SIZE:
        failure(413, "CSV_TOO_LARGE", "CSV exceeds the 10 MiB upload limit")
    if secured_export.get():
        return await run_in_threadpool(_predict_contents, contents, task, version, requested_save, db)
    return _predict_contents(contents, task, version, requested_save, db)


def _predict_contents(contents, task, version, requested_save, db):
    from backend.routers.v1 import save

    try:
        text = contents.decode("utf-8-sig")
        header = next(csv.reader(io.StringIO(text)))
        if not header or any(not h.strip() for h in header) or len(set(header)) != len(header):
            failure(422, "INVALID_CSV_HEADERS", "CSV headers must be nonblank and unique")
        if RESERVED.intersection(header):
            failure(422, "RESERVED_CSV_HEADERS", "Input CSV contains reserved prediction/provenance headers")
        frame = pd.read_csv(io.StringIO(text), dtype=str, keep_default_na=False, nrows=MAX_ROWS + 1)
    except (UnicodeDecodeError, pd.errors.ParserError, pd.errors.EmptyDataError, StopIteration):
        failure(422, "INVALID_CSV_FILE", "CSV is empty, malformed or not UTF-8")
    if frame.empty or len(frame) > MAX_ROWS:
        failure(422, "CSV_ROW_LIMIT", "CSV must contain between 1 and 1000 data rows")
    schema = INPUT_MODELS[(task, version)]
    features = list(schema.model_fields)
    if not set(features).issubset(frame.columns):
        failure(422, "MISSING_CSV_FEATURES", "CSV is missing required columns for the selected model version")
    if set(frame.columns) - set(features) - {"customer_id", "external_id"}:
        failure(422, "UNEXPECTED_CSV_FEATURES", "Only selected model features and optional customer_id/external_id passthrough columns are allowed")
    text_columns = {"Gender", "Country", "City", "Signup_Quarter"}
    inputs, errors = [], []
    for index, row in frame[features].iterrows():
        customer = {}
        for name in features:
            value = row[name]
            if value == "":
                value = None
            elif name not in text_columns:
                try:
                    value = float(value)
                except ValueError:
                    pass
            customer[name] = value
        try:
            inputs.append(schema.model_validate(customer).model_dump())
        except ValidationError as exc:
            errors.extend({"location": ["csv", int(index) + 2, *e["loc"]], "code": e["type"],
                           "message": "Invalid CSV field for the selected model"} for e in exc.errors())
    if errors:
        raise HTTPException(422, detail={"code": "CSV_VALIDATION_ERROR", "message": "CSV contains invalid rows", "details": errors})
    # Infer all rows before a transaction; no partial persistence on invalid input.
    results = [infer(task, version, customer) for customer in inputs]
    save(db, task, version, requested_save, inputs, results, "csv")
    output = frame.copy()
    output["Model_ID"] = [r["model_id"] for r in results]
    output["Model_Version"] = version
    output["Generated_At"] = [r["generated_at"] for r in results]
    output["Prediction_Task"] = task
    if task == "classification":
        output["Predicted_Class"] = [r["predicted_class"] for r in results]
        output["Purchase_Level_Predicted"] = [r["purchase_level"] for r in results]
        for name in ("Low", "Medium", "High"):
            output[f"Probability_{name}"] = [r["probabilities"][name] for r in results]
    else:
        for field, column in (("cluster", "Cluster"), ("segment_id", "Segment_ID"), ("segment_name", "Segment_Name"),
                              ("distance_to_centroid", "Distance_To_Centroid"), ("distance_kind", "Distance_Kind")):
            output[column] = [r[field] for r in results]
    return Response(safe_export(output).to_csv(index=False).encode("utf-8-sig"), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{task}_v1.csv"', "X-Model-Version": version})
