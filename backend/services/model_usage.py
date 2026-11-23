"""K9 model usage: read-only aggregation of saved runs and results per registered model version.

One bounded statement over ml_models, prediction_runs, prediction_results and segmentation_results.
Only models that persist results appear here; research versions are inference-only (no rows).
"""

from datetime import UTC, datetime

from sqlalchemy import text

USAGE_SQL = text("""
WITH runs AS (
  SELECT model_id,
         count(*) AS runs_total,
         count(*) FILTER (WHERE status = 'completed') AS runs_completed,
         count(*) FILTER (WHERE status = 'completed' AND run_type = 'single') AS runs_single,
         count(*) FILTER (WHERE status = 'completed' AND run_type = 'batch') AS runs_batch,
         count(*) FILTER (WHERE status = 'completed' AND run_type = 'csv') AS runs_csv,
         count(*) FILTER (WHERE status = 'completed' AND run_type = 'scenario') AS runs_scenario,
         max(created_at) AS last_run_at
  FROM prediction_runs GROUP BY model_id
),
results AS (
  SELECT model_id, count(*) AS saved, max(created_at) AS last_result_at FROM (
    SELECT model_id, created_at FROM prediction_results
    UNION ALL
    SELECT model_id, created_at FROM segmentation_results
  ) r GROUP BY model_id
),
customers AS (
  SELECT model_id, count(DISTINCT customer_id) AS customers FROM (
    SELECT model_id, customer_id FROM prediction_results WHERE customer_id IS NOT NULL
    UNION ALL
    SELECT model_id, customer_id FROM segmentation_results WHERE customer_id IS NOT NULL
  ) c GROUP BY model_id
)
SELECT m.name, m.version, m.task, m.algorithm, m.artifact_checksum, m.created_at AS registered_at,
       coalesce(runs.runs_total, 0) AS runs_total, coalesce(runs.runs_completed, 0) AS runs_completed,
       coalesce(runs.runs_single, 0) AS runs_single, coalesce(runs.runs_batch, 0) AS runs_batch,
       coalesce(runs.runs_csv, 0) AS runs_csv, coalesce(runs.runs_scenario, 0) AS runs_scenario,
       coalesce(results.saved, 0) AS results_saved, coalesce(customers.customers, 0) AS customers,
       greatest(runs.last_run_at, results.last_result_at) AS last_used_at
FROM ml_models m
LEFT JOIN runs ON runs.model_id = m.id
LEFT JOIN results ON results.model_id = m.id
LEFT JOIN customers ON customers.model_id = m.id
ORDER BY m.task, m.name, m.version
LIMIT 50
""")


def iso(value):
    return value.isoformat() if value is not None else None


def model_usage(conn):
    rows = conn.execute(USAGE_SQL).mappings().all()
    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "models": [
            {
                "model_id": r["name"],
                "model_version": r["version"],
                "task": r["task"],
                "algorithm": r["algorithm"],
                "artifact_sha256": r["artifact_checksum"],
                "registered_at": iso(r["registered_at"]),
                "runs_total": r["runs_total"],
                "runs_completed": r["runs_completed"],
                "runs_by_type": {k: r[f"runs_{k}"] for k in ("single", "batch", "csv", "scenario")},
                "results_saved": r["results_saved"],
                "customers": r["customers"],
                "last_used_at": iso(r["last_used_at"]),
            }
            for r in rows
        ],
        "scope": "registered models that persist results; research versions are inference-only and have no usage rows",
    }
