"""Bounded PostgreSQL aggregation, no per-customer query or inference.

One statement shares the same materialized eligibility/latest/cohort CTEs.
All identifiers below are static; user values are bound parameters only.
"""

AGGREGATE_SQL = """
WITH
cr_raw AS MATERIALIZED (
 SELECT r.*, run.task AS run_task, run.model_id AS run_model_id,
        run.status, run.run_type, m.name, m.version, m.task AS model_task
 FROM prediction_results r
 JOIN ml_models m ON m.id = r.model_id
 JOIN prediction_runs run ON run.id = r.run_id
 JOIN ml_models rm ON rm.id = run.model_id
 WHERE r.created_at >= :start AND r.created_at < :end
 AND ((m.name = :cname AND m.version = :cversion)
   OR (rm.name = :cname AND rm.version = :cversion))
),
sr_raw AS MATERIALIZED (
 SELECT r.*, run.task AS run_task, run.model_id AS run_model_id,
        run.status, run.run_type, m.name, m.version, m.task AS model_task
 FROM segmentation_results r
 JOIN ml_models m ON m.id = r.model_id
 JOIN prediction_runs run ON run.id = r.run_id
 JOIN ml_models rm ON rm.id = run.model_id
 WHERE r.created_at >= :start AND r.created_at < :end
 AND ((m.name = :sname AND m.version = :sversion)
   OR (rm.name = :sname AND rm.version = :sversion))
),
cr AS MATERIALIZED (SELECT * FROM cr_raw WHERE status = 'completed' AND run_type IN ('single','batch','csv')),
sr AS MATERIALIZED (SELECT * FROM sr_raw WHERE status = 'completed' AND run_type IN ('single','batch','csv')),
sl AS MATERIALIZED (
 SELECT DISTINCT ON (customer_id) * FROM sr WHERE customer_id IS NOT NULL
 ORDER BY customer_id, created_at DESC, id DESC
),
cohort AS MATERIALIZED (
 SELECT c.* FROM customers c LEFT JOIN sl ON sl.customer_id = c.id
 WHERE CAST(:cluster AS integer) IS NULL OR sl.cluster = :cluster
),
cf AS MATERIALIZED (
 SELECT cr.* FROM cr LEFT JOIN cohort c ON c.id = cr.customer_id
 WHERE c.id IS NOT NULL OR (CAST(:cluster AS integer) IS NULL AND cr.customer_id IS NULL)
),
sf AS MATERIALIZED (
 SELECT sr.* FROM sr LEFT JOIN cohort c ON c.id = sr.customer_id
 WHERE c.id IS NOT NULL OR (CAST(:cluster AS integer) IS NULL AND sr.customer_id IS NULL)
),
cl AS MATERIALIZED (
 SELECT DISTINCT ON (customer_id) * FROM cf WHERE customer_id IS NOT NULL
 ORDER BY customer_id, created_at DESC, id DESC
),
ss AS MATERIALIZED (SELECT sl.* FROM sl JOIN cohort c ON c.id = sl.customer_id),
wb AS MATERIALIZED (SELECT * FROM prediction_scenarios WHERE created_at >= :start AND created_at < :end),
wf AS MATERIALIZED (
 SELECT wb.* FROM wb LEFT JOIN cohort c ON c.id = wb.customer_id
 WHERE c.id IS NOT NULL OR (CAST(:cluster AS integer) IS NULL AND wb.customer_id IS NULL)
),
days AS (SELECT CAST(d AS date) AS bucket FROM generate_series(
 CAST(:date_from AS date)::timestamp, CAST(:date_to AS date)::timestamp - interval '1 day', interval '1 day') d),
cp AS (SELECT (created_at AT TIME ZONE :timezone)::date AS bucket, count(*) n FROM cf GROUP BY 1),
sp AS (SELECT (created_at AT TIME ZONE :timezone)::date AS bucket, count(*) n FROM sf GROUP BY 1),
wp AS (SELECT (created_at AT TIME ZONE :timezone)::date AS bucket, count(*) n FROM wf GROUP BY 1),
recent AS (SELECT * FROM cohort ORDER BY created_at DESC, id DESC LIMIT :limit)
SELECT jsonb_build_object(
 'invalid', (
   SELECT count(*) FROM cr_raw WHERE model_id <> run_model_id
     OR run_task <> 'classification' OR model_task <> 'classification'
     OR name <> :cname OR version <> :cversion
     OR predicted_class NOT BETWEEN 0 AND 2
     OR purchase_level IS DISTINCT FROM (ARRAY['Low','Medium','High'])[predicted_class + 1]
     OR NOT (probability_low BETWEEN 0 AND 1 AND probability_medium BETWEEN 0 AND 1 AND probability_high BETWEEN 0 AND 1)
     OR NOT (abs(probability_low + probability_medium + probability_high - 1) <= 0.000001)
 ) + (
   SELECT count(*) FROM sr_raw WHERE model_id <> run_model_id
     OR run_task <> 'segmentation' OR model_task <> 'segmentation'
     OR name <> :sname OR version <> :sversion OR cluster NOT BETWEEN 0 AND 2
     OR NOT (distance_to_centroid >= 0 AND distance_to_centroid < 'Infinity'::float8)
 ),
 'research_rows', jsonb_build_array((SELECT count(*) FROM cr_raw), (SELECT count(*) FROM sr_raw)),
 'workspace', jsonb_build_object(
   'customers', (SELECT count(*) FROM customers),
   'active_customers', (SELECT count(*) FROM customers WHERE is_active),
   'behavior_snapshots', (SELECT count(*) FROM customer_behavior_snapshots),
   'registered_models', (SELECT count(*) FROM ml_models)),
 'cohort', (SELECT count(*) FROM cohort),
 'classification', jsonb_build_object(
   'total', (SELECT count(*) FROM cf), 'linked', (SELECT count(customer_id) FROM cf),
   'excluded', (SELECT count(*) FROM cr WHERE customer_id IS NULL AND CAST(:cluster AS integer) IS NOT NULL),
   'with_result', (SELECT count(*) FROM cl), 'latest', (SELECT max(created_at) FROM cf),
   'counts', (SELECT jsonb_agg(n ORDER BY k) FROM (
      SELECT k, (SELECT count(*) FROM cl WHERE predicted_class = k) n FROM generate_series(0,2) k) a),
   'means', (SELECT CASE WHEN count(*) = 0 THEN NULL ELSE jsonb_build_object(
      'Low', avg(probability_low), 'Medium', avg(probability_medium), 'High', avg(probability_high)) END FROM cl)),
 'segmentation', jsonb_build_object(
   'total', (SELECT count(*) FROM sf), 'linked', (SELECT count(customer_id) FROM sf),
   'excluded', (SELECT count(*) FROM sr WHERE customer_id IS NULL AND CAST(:cluster AS integer) IS NOT NULL),
   'with_result', (SELECT count(*) FROM ss), 'latest', (SELECT max(created_at) FROM sf),
   'counts', (SELECT jsonb_agg(n ORDER BY k) FROM (
      SELECT k, (SELECT count(*) FROM ss WHERE cluster = k) n FROM generate_series(0,2) k) a)),
 'what_if', jsonb_build_object(
   'scenarios', (SELECT count(*) FROM wf),
   'scenario_results', (SELECT count(*) FROM scenario_results r JOIN wf ON wf.id = r.scenario_id),
   'excluded_unlinked_scenarios', (SELECT count(*) FROM wb WHERE customer_id IS NULL AND CAST(:cluster AS integer) IS NOT NULL),
   'latest_scenario_at', (SELECT max(created_at) FROM wf)),
 'activity', (SELECT jsonb_agg(jsonb_build_object(
    'date', days.bucket, 'purchase_results', coalesce(cp.n,0), 'segmentation_results', coalesce(sp.n,0),
    'what_if_scenarios', coalesce(wp.n,0), 'is_partial', days.bucket = CAST(:today AS date)) ORDER BY days.bucket)
    FROM days LEFT JOIN cp USING(bucket) LEFT JOIN sp USING(bucket) LEFT JOIN wp USING(bucket)),
 'recent', coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id', c.id, 'external_id', c.external_id, 'is_active', c.is_active, 'created_at', c.created_at,
    'purchase_in_window', CASE WHEN cl.id IS NULL THEN NULL ELSE jsonb_build_object('purchase_level', cl.purchase_level, 'created_at', cl.created_at) END,
    'segment_in_window', CASE WHEN ss.id IS NULL THEN NULL ELSE jsonb_build_object('cluster', ss.cluster, 'created_at', ss.created_at) END
    ) ORDER BY c.created_at DESC, c.id DESC) FROM recent c
    LEFT JOIN cl ON cl.customer_id = c.id LEFT JOIN ss ON ss.customer_id = c.id), '[]'::jsonb)
) AS result
"""
