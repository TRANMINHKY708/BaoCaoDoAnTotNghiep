"""F11 scoped SQL aggregation; no inference, writes, preview cache or research CSV.

Core connections are supplied by the existing REPEATABLE READ / READ ONLY
dashboard dependency. Every consumer uses exactly the same filtered CTEs.
"""

import hashlib
import json
import math

from sqlalchemy import (
    Date,
    String,
    and_,
    case,
    cast,
    distinct,
    exists,
    func,
    literal,
    or_,
    select,
)
from sqlalchemy.dialects.postgresql import aggregate_order_by

from backend.models.analysis import F10_REVISION, BulkAnalysisItem, BulkAnalysisJob
from backend.models.bulk import BulkImportJob, BulkImportRow, CustomerSourceIdentity
from backend.models.customer import Customer, CustomerBehaviorSnapshot
from backend.models.ml import MLModel
from backend.models.prediction import PredictionResult, SegmentationResult
from backend.services.versioned_models import MODEL_NAMES, failure
from src.data.dataset_contract import FIELDS
from src.segmentation.pipeline import FEATURES

MAX_EXPORT = 5000
DEFINITIONS = {
    "customers": "Khách hàng duy nhất có snapshot trong các tác vụ khớp toàn bộ bộ lọc.",
    "snapshots": "Snapshot duy nhất đã nhập hợp lệ và liên kết đúng khách hàng trong phạm vi lọc.",
    "import_jobs": "Lô nhập F09 được các dòng trong phạm vi lọc tham chiếu.",
    "analysis_jobs": "Tác vụ F10 được các dòng trong phạm vi lọc tham chiếu; hai model là hai tác vụ.",
    "analyzed_customers": "Khách hàng duy nhất có ít nhất một kết quả ML đã lưu trong phạm vi lọc.",
    "stored_results": "Kết quả ML đã lưu duy nhất theo task + result UUID; dùng lại qua nhiều lô chỉ tính một lần.",
    "successful_items": "Lượt xử lý snapshot thành công theo checkpoint F10, có thể gồm preview và dùng lại kết quả.",
    "preview_success_items": "Lượt thành công không lưu đầu ra; không xác nhận preview còn tồn tại.",
    "failed_items": "Dòng F10 đang ở trạng thái failed; không suy diễn mọi dòng thành failed khi tác vụ gặp lỗi.",
    "skipped_items": "Dòng F10 ở trạng thái skipped, tính theo tác vụ/snapshot.",
    "queued_items": "Dòng F10 chưa xử lý, gồm phần còn lại của tác vụ gặp lỗi.",
    "failed_jobs": "Tác vụ có lỗi cấp lô; không đồng nghĩa mọi snapshot trong lô đều thất bại.",
}


def require_schema(conn):
    from sqlalchemy import text

    if (
        conn.dialect.name != "postgresql"
        or conn.scalar(text("SELECT version_num FROM alembic_version")) != F10_REVISION
    ):
        failure(
            503,
            "ANALYSIS_MIGRATION_REQUIRED",
            "Cần schema F10 hợp lệ để đọc thống kê lô.",
        )


def job_scope(filters):
    j, source = BulkAnalysisJob.__table__, BulkImportJob.__table__
    statement = select(
        j,
        source.c.status.label("import_status"),
        source.c.metadata_json.label("import_metadata"),
    ).select_from(j.join(source, source.c.id == j.c.import_job_id))
    # Workspace visibility is authorized at the F11 boundary; F09/F10 ownership is unchanged.
    if filters.import_job_id:
        statement = statement.where(j.c.import_job_id == filters.import_job_id)
    if filters.analysis_job_id:
        statement = statement.where(j.c.id == filters.analysis_job_id)
    if filters.date_from:
        statement = statement.where(
            j.c.created_at >= filters.date_from, j.c.created_at < filters.date_to
        )
    version_conditions = []
    for task in ("classification", "segmentation"):
        condition = and_(
            j.c.task == task, j.c.model_version == getattr(filters, task + "_version")
        )
        if getattr(filters, task + "_artifact"):
            condition = and_(
                condition,
                j.c.artifact_sha256 == getattr(filters, task + "_artifact"),
                j.c.metadata_sha256 == getattr(filters, task + "_metadata"),
            )
        version_conditions.append(condition)
    return statement.where(or_(*version_conditions)).cte("selected_jobs")


def scope(conn, filters):
    jobs = job_scope(filters)
    identities = (
        conn.execute(
            select(
                jobs.c.task,
                jobs.c.model_version,
                jobs.c.artifact_sha256,
                jobs.c.metadata_sha256,
            ).distinct()
        )
        .mappings()
        .all()
    )
    if any(
        sum(row["task"] == task for row in identities) > 1
        for task in ("classification", "segmentation")
    ):
        failure(
            409,
            "BATCH_MODEL_IDENTITY_AMBIGUOUS",
            "Cùng phiên bản có nhiều danh tính artifact. Chọn đúng mô hình hoặc một tác vụ; không trộn phân bố.",
        )
    i, c, s = (
        BulkAnalysisItem.__table__,
        Customer.__table__,
        CustomerBehaviorSnapshot.__table__,
    )
    p, g = PredictionResult.__table__, SegmentationResult.__table__
    pm, gm = MLModel.__table__.alias("pm"), MLModel.__table__.alias("gm")
    source_row = BulkImportRow.__table__
    valid_source = exists(
        select(1).where(
            source_row.c.job_id == jobs.c.import_job_id,
            source_row.c.customer_id == i.c.customer_id,
            source_row.c.snapshot_id == i.c.snapshot_id,
            source_row.c.status == "applied",
        )
    )
    valid_prediction = and_(
        jobs.c.task == "classification",
        jobs.c.model_version == "1.0.0",
        jobs.c.persist_results.is_(True),
        i.c.status == "success",
        p.c.id.is_not(None),
        i.c.segmentation_result_id.is_(None),
        p.c.customer_id == i.c.customer_id,
        p.c.behavior_snapshot_id == i.c.snapshot_id,
        pm.c.name == MODEL_NAMES["classification"],
        pm.c.task == "classification",
        pm.c.version == jobs.c.model_version,
        pm.c.artifact_checksum == jobs.c.artifact_sha256,
        p.c.predicted_class
        == case(
            (p.c.purchase_level == "Low", 0),
            (p.c.purchase_level == "Medium", 1),
            (p.c.purchase_level == "High", 2),
            else_=-1,
        ),
        func.abs(
            p.c.probability_low + p.c.probability_medium + p.c.probability_high - 1
        )
        <= 1e-6,
    )
    valid_segment = and_(
        jobs.c.task == "segmentation",
        jobs.c.model_version == "1.0.0",
        jobs.c.persist_results.is_(True),
        i.c.status == "success",
        g.c.id.is_not(None),
        i.c.prediction_result_id.is_(None),
        g.c.customer_id == i.c.customer_id,
        g.c.behavior_snapshot_id == i.c.snapshot_id,
        gm.c.name == MODEL_NAMES["segmentation"],
        gm.c.task == "segmentation",
        gm.c.version == jobs.c.model_version,
        gm.c.artifact_checksum == jobs.c.artifact_sha256,
        g.c.cluster.between(0, 2),
        g.c.distance_to_centroid < float("inf"),
        g.c.segment_name
        == gm.c.metadata_json["cluster_names"][cast(g.c.cluster, String)].as_string(),
    )
    no_result = and_(
        i.c.prediction_result_id.is_(None),
        i.c.segmentation_result_id.is_(None),
        or_(i.c.status != "success", jobs.c.persist_results.is_(False)),
    )
    valid = and_(
        jobs.c.import_status == "completed",
        c.c.id.is_not(None),
        s.c.id.is_not(None),
        s.c.customer_id == i.c.customer_id,
        valid_source,
        or_(valid_prediction, valid_segment, no_result),
    )
    feature_columns = {f.name: s.c[f.column] for f in FIELDS if f.name in FEATURES}
    key = case(
        (p.c.id.is_not(None), literal("p:") + cast(p.c.id, String)),
        (g.c.id.is_not(None), literal("s:") + cast(g.c.id, String)),
        else_=literal("i:") + cast(i.c.id, String),
    )
    raw = select(
        i.c.id.label("item_id"),
        i.c.customer_id,
        i.c.snapshot_id,
        i.c.status.label("item_status"),
        i.c.error_code,
        c.c.external_id,
        s.c.captured_at,
        jobs.c.id.label("analysis_job_id"),
        jobs.c.import_job_id,
        jobs.c.task,
        jobs.c.model_version,
        jobs.c.artifact_sha256,
        jobs.c.metadata_sha256,
        jobs.c.persist_results,
        jobs.c.status.label("job_status"),
        jobs.c.counts.label("job_counts"),
        jobs.c.import_metadata,
        jobs.c.created_at.label("analysis_created_at"),
        p.c.id.label("prediction_result_id"),
        g.c.id.label("segmentation_result_id"),
        p.c.purchase_level,
        p.c.probability_low,
        p.c.probability_medium,
        p.c.probability_high,
        g.c.cluster,
        g.c.segment_name,
        g.c.distance_to_centroid,
        case(
            (p.c.id.is_not(None), p.c.created_at),
            (g.c.id.is_not(None), g.c.created_at),
            else_=jobs.c.created_at,
        ).label("result_created_at"),
        key.label("event_key"),
        valid.label("valid"),
        *[col.label(name) for name, col in feature_columns.items()],
    ).select_from(
        i.join(jobs, jobs.c.id == i.c.job_id)
        .outerjoin(c, c.c.id == i.c.customer_id)
        .outerjoin(s, s.c.id == i.c.snapshot_id)
        .outerjoin(p, p.c.id == i.c.prediction_result_id)
        .outerjoin(g, g.c.id == i.c.segmentation_result_id)
        .outerjoin(pm, pm.c.id == p.c.model_id)
        .outerjoin(gm, gm.c.id == g.c.model_id)
    )
    if filters.customer_query:
        q = filters.customer_query
        if q.upper().startswith("KH-"):
            q = q[3:].lower()
        escaped = (
            "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        )
        identity = CustomerSourceIdentity.__table__
        raw = raw.where(
            or_(
                cast(c.c.id, String).ilike(escaped, escape="\\"),
                c.c.external_id.ilike(escaped, escape="\\"),
                exists(
                    select(1).where(
                        identity.c.customer_id == i.c.customer_id,
                        identity.c.external_customer_id.ilike(escaped, escape="\\"),
                    )
                ),
            )
        )
    initial = raw.cte("initial_items")
    if conn.scalar(
        select(func.count()).select_from(initial).where(initial.c.valid.is_not(True))
    ):
        failure(
            409,
            "BATCH_DATA_INTEGRITY",
            "Liên kết lô, snapshot hoặc kết quả lịch sử không hợp lệ. Không tạo thống kê thay thế.",
        )
    conditions = []
    for attr, value in (
        ("purchase_level", filters.purchase_level),
        ("cluster", filters.cluster),
    ):
        if value is not None:
            other = initial.alias("matches_" + attr)
            conditions.append(
                exists(
                    select(1).where(
                        other.c.customer_id == initial.c.customer_id,
                        other.c.snapshot_id == initial.c.snapshot_id,
                        getattr(other.c, attr) == value,
                    )
                )
            )
    scoped = select(initial).where(*conditions).cte("scoped_items")
    ranked = select(
        scoped,
        func.row_number()
        .over(
            partition_by=scoped.c.event_key,
            order_by=(scoped.c.analysis_created_at, scoped.c.item_id),
        )
        .label("rank"),
        func.count().over(partition_by=scoped.c.event_key).label("reference_count"),
    ).cte("ranked_results")
    canonical = select(ranked).where(ranked.c.rank == 1).cte("unique_results")
    return scoped, canonical, [dict(row) for row in identities]


def _means(row):
    result = {}
    for name in FEATURES:
        value = (
            float(row[name]) if row["records"] >= 2 and row[name] is not None else None
        )
        if value is not None and not math.isfinite(value):
            failure(
                409,
                "BATCH_DATA_INTEGRITY",
                "Đặc trưng thống kê có giá trị không hữu hạn.",
            )
        result[name] = value
    return result


def view(conn, filters, offset=0, limit=50, *, export=False):
    require_schema(conn)
    raw, unique, identities = scope(conn, filters)
    origins = set()
    for metadata in conn.scalars(
        select(BulkImportJob.metadata_json).where(
            BulkImportJob.id.in_(select(raw.c.import_job_id).distinct())
        )
    ):
        sources = metadata.get("sources", [])
        if isinstance(sources, list):
            origins.update(str(s)[:100] for s in sources if isinstance(s, str))
    output = or_(
        raw.c.prediction_result_id.is_not(None),
        raw.c.segmentation_result_id.is_not(None),
    )
    kpi = (
        conn.execute(
            select(
                func.now().label("as_of"),
                func.count(distinct(raw.c.customer_id)).label("customers"),
                func.count(distinct(raw.c.snapshot_id)).label("snapshots"),
                func.count(distinct(raw.c.import_job_id)).label("import_jobs"),
                func.count(distinct(raw.c.analysis_job_id)).label("analysis_jobs"),
                func.count(distinct(raw.c.customer_id))
                .filter(output)
                .label("analyzed_customers"),
                func.count(distinct(raw.c.event_key))
                .filter(output)
                .label("stored_results"),
                func.count()
                .filter(raw.c.item_status == "success")
                .label("successful_items"),
                func.count()
                .filter(
                    and_(
                        raw.c.item_status == "success", raw.c.persist_results.is_(False)
                    )
                )
                .label("preview_success_items"),
                func.count()
                .filter(raw.c.item_status == "failed")
                .label("failed_items"),
                func.count()
                .filter(raw.c.item_status == "skipped")
                .label("skipped_items"),
                func.count()
                .filter(raw.c.item_status == "queued")
                .label("queued_items"),
                func.count(distinct(raw.c.analysis_job_id))
                .filter(raw.c.job_status == "failed")
                .label("failed_jobs"),
                func.md5(
                    func.coalesce(
                        func.string_agg(
                            cast(func.row_to_json(raw.table_valued()), String),
                            aggregate_order_by(literal("|"), raw.c.item_id),
                        ),
                        literal(""),
                    )
                ).label("membership"),
            )
        )
        .mappings()
        .one()
    )
    kpis = {
        key: int(value)
        for key, value in kpi.items()
        if key not in {"membership", "as_of"}
    }
    normalized = filters.model_dump(mode="json")
    fingerprint = hashlib.sha256(
        json.dumps(
            {
                "filters": normalized,
                "membership": kpi["membership"],
                "models": sorted(
                    identities, key=lambda x: (x["task"], x["artifact_sha256"])
                ),
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()
    purchase = [
        dict(row)
        for row in conn.execute(
            select(unique.c.purchase_level.label("label"), func.count().label("count"))
            .where(unique.c.prediction_result_id.is_not(None))
            .group_by(unique.c.purchase_level)
        ).mappings()
    ]
    clusters = [
        dict(row)
        for row in conn.execute(
            select(unique.c.cluster, unique.c.segment_name, func.count().label("count"))
            .where(unique.c.segmentation_result_id.is_not(None))
            .group_by(unique.c.cluster, unique.c.segment_name)
            .order_by(unique.c.cluster)
        ).mappings()
    ]
    if purchase:
        observed = {r["label"]: r["count"] for r in purchase}
        purchase = [
            {"label": name, "count": observed.get(name, 0)}
            for name in ("Low", "Medium", "High")
        ]
    for group in (purchase, clusters):
        total = sum(row["count"] for row in group)
        for row in group:
            row["share_percent"] = 100 * row["count"] / total if total else 0
    profiles_query = (
        select(
            unique.c.cluster,
            func.count().label("records"),
            *[func.avg(unique.c[n]).label(n) for n in FEATURES],
        )
        .where(unique.c.segmentation_result_id.is_not(None))
        .group_by(unique.c.cluster)
        .order_by(unique.c.cluster)
    )
    profiles = [
        {
            "cluster": r["cluster"],
            "records": r["records"],
            "means": _means(r),
            "status": "available" if r["records"] >= 2 else "insufficient_data",
        }
        for r in conn.execute(profiles_query).mappings()
    ]
    overall = (
        conn.execute(
            select(
                func.count().label("records"),
                *[func.avg(unique.c[n]).label(n) for n in FEATURES],
            ).where(unique.c.segmentation_result_id.is_not(None))
        )
        .mappings()
        .one()
    )
    days = (
        select(
            raw.c.analysis_job_id,
            raw.c.job_status,
            cast(
                func.timezone("Asia/Ho_Chi_Minh", raw.c.analysis_created_at), Date
            ).label("day"),
        )
        .distinct()
        .cte("analysis_days")
    )
    trend = [
        {
            "day": r["day"].isoformat(),
            "analysis_jobs": r["analysis_jobs"],
            "failed_jobs": r["failed_jobs"],
        }
        for r in conn.execute(
            select(
                days.c.day,
                func.count().label("analysis_jobs"),
                func.count().filter(days.c.job_status == "failed").label("failed_jobs"),
            )
            .group_by(days.c.day)
            .order_by(days.c.day)
        ).mappings()
    ]
    total_rows = conn.scalar(select(func.count()).select_from(unique))
    if export and total_rows > MAX_EXPORT:
        failure(
            413,
            "BATCH_REPORT_TOO_LARGE",
            "Báo cáo vượt 5.000 dòng. Hãy thu hẹp bộ lọc; không xuất thiếu âm thầm.",
        )
    page = (
        conn.execute(
            select(unique)
            .order_by(unique.c.result_created_at.desc(), unique.c.event_key)
            .offset(0 if export else offset)
            .limit(MAX_EXPORT if export else limit)
        )
        .mappings()
        .all()
    )
    rows = []
    for row in page:
        rows.append(
            {
                key: row[key]
                for key in (
                    "item_id",
                    "customer_id",
                    "snapshot_id",
                    "external_id",
                    "captured_at",
                    "analysis_job_id",
                    "import_job_id",
                    "task",
                    "model_version",
                    "artifact_sha256",
                    "metadata_sha256",
                    "analysis_created_at",
                    "result_created_at",
                    "item_status",
                    "error_code",
                    "purchase_level",
                    "cluster",
                    "segment_name",
                    "distance_to_centroid",
                    "reference_count",
                )
            }
            | {
                "saved": row["prediction_result_id"] is not None
                or row["segmentation_result_id"] is not None,
                "probabilities": {
                    "Low": row["probability_low"],
                    "Medium": row["probability_medium"],
                    "High": row["probability_high"],
                }
                if row["prediction_result_id"]
                else None,
            }
        )
    return {
        "source": "postgresql_f09_f10_saved_history",
        "as_of": kpi["as_of"],
        "timezone": "Asia/Ho_Chi_Minh",
        "filters": normalized,
        "fingerprint": fingerprint,
        "kpis": kpis,
        "definitions": DEFINITIONS,
        "models": identities,
        "data_origins": sorted(origins),
        "purchase_distribution": sorted(
            purchase, key=lambda r: ("Low", "Medium", "High").index(r["label"])
        ),
        "cluster_distribution": clusters,
        "cluster_profiles": profiles,
        "overall_means": _means(overall),
        "trend": trend,
        "trend_available": len(trend) >= 2,
        "warnings": [
            "Thống kê trong phạm vi tác vụ/snapshot đã lọc, không phải toàn bộ khách hàng chưa có tác vụ.",
            "Kết quả lưu dùng lại chỉ đếm một lần; checkpoint thành công có thể gồm preview đã hết hạn.",
            "Trung bình là dữ liệu snapshot gốc của lô, không phải dữ liệu nghiên cứu hoặc giá trị đã scaling; tối thiểu 2 bản ghi mới hiển thị.",
            "Khoảng thời gian lọc theo ngày tạo tác vụ F10, cuối khoảng không bao gồm. Biểu đồ thời gian đếm tác vụ theo ngày Việt Nam.",
            "Phân loại snapshot, không dự báo chắc chắn giao dịch tương lai. Cluster ID không là thứ hạng; khoảng cách không phải xác suất.",
            "Đơn vị tiền tệ chưa được xác minh; không mặc định Average_Order_Value là VND. Nguồn demo/nghiên cứu được nhập vẫn giữ tính chất demo/nghiên cứu.",
        ],
        "total_rows": total_rows,
        "offset": 0 if export else offset,
        "limit": MAX_EXPORT if export else limit,
        "rows": rows,
    }


def options(conn, import_job_id=None):
    require_schema(conn)
    source, j = BulkImportJob.__table__, BulkAnalysisJob.__table__
    imports = list(
        conn.execute(
            select(source.c.id, source.c.created_at, source.c.metadata_json)
            .where(exists(select(1).where(j.c.import_job_id == source.c.id)))
            .order_by(source.c.created_at.desc(), source.c.id)
            .limit(101)
        ).mappings()
    )
    query = select(
        j.c.id,
        j.c.import_job_id,
        j.c.task,
        j.c.model_version,
        j.c.status,
        j.c.created_at,
    )
    if import_job_id:
        query = query.where(j.c.import_job_id == import_job_id)
    jobs = list(
        conn.execute(
            query.order_by(j.c.created_at.desc(), j.c.id).limit(101)
        ).mappings()
    )
    models = (
        conn.execute(
            select(
                j.c.task, j.c.model_version, j.c.artifact_sha256, j.c.metadata_sha256
            )
            .distinct()
            .order_by(j.c.task, j.c.model_version, j.c.artifact_sha256)
            .limit(101)
        )
        .mappings()
        .all()
    )
    return {
        "scope": "shared_workspace_read_only",
        "imports": [
            {
                "job_id": r["id"],
                "created_at": r["created_at"],
                "filename": str(r["metadata_json"].get("filename", "Lô nhập"))[:200],
            }
            for r in imports[:100]
        ],
        "analyses": [dict(r) for r in jobs[:100]],
        "models": [dict(r) for r in models[:100]],
        "truncated": {
            "imports": len(imports) > 100,
            "analyses": len(jobs) > 100,
            "models": len(models) > 100,
        },
        "limit": 100,
    }


def check_fingerprint(data, expected):
    if data["fingerprint"] != expected:
        failure(
            409,
            "BATCH_ANALYTICS_CHANGED",
            "Dữ liệu đã thay đổi từ lần xem trước. Tải lại dashboard trước khi xuất hoặc yêu cầu AI nhận xét.",
        )
