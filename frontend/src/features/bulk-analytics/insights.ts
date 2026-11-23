import { ApiError } from '../../api/errors';
import type { BatchFilters, BatchView, ModelIdentity } from './types';
import type { ComparisonFeature } from './comparisonData';

export type InsightTarget = {
  section: 'purchase_distribution' | 'segment_distribution' | 'comparison' | 'results';
  feature_key: ComparisonFeature | null;
  scope: 'same_applied_filters';
};
export type Insight = {
  insight_id: string;
  rule_id: string;
  rule_version: string;
  insight_type: 'observed_fact' | 'derived_comparison' | 'data_availability';
  title: string;
  description: string;
  model_identity: ModelIdentity | null;
  feature_key: ComparisonFeature | null;
  unit: { kind: string; label: string; verification_status: string } | null;
  observed_values: {
    metric: string;
    value: number | string | boolean | null;
    value_type: string;
    unit: string;
    cluster_id: number | null;
    evidence_id: string;
  }[];
  derived_values: { operation: 'subtract'; operands: string[]; value: number; unit: string }[];
  sample_counts: {
    value: number | null;
    unit: string;
    scope: string;
    evidence_id?: string | null;
    unavailable_reason?: string | null;
  }[];
  evidence: {
    evidence_id: string;
    source_field: string;
    semantic_selector: Record<string, unknown>;
    observed_value: unknown;
    source_fingerprint: string;
  }[];
  limitations: { code: string; description: string }[];
  navigation_target: InsightTarget;
};
export type InsightEnvelope = {
  contract_version: '1.0.0';
  rule_set_version: '1.0.0';
  precision_policy: 'significant-digits-12-v1';
  source: 'postgresql_f09_f10_saved_history';
  as_of: string;
  aggregate_fingerprint: string;
  filter_scope: BatchFilters;
  resolved_models: ModelIdentity[];
  status: 'ready' | 'no_eligible_facts';
  insights: Insight[];
  evaluations: {
    rule_id: string;
    rule_version: string;
    status: 'emitted' | 'skipped';
    reason_code: string | null;
    parameters: Record<string, unknown>;
  }[];
};

export function checkedInsights(value: InsightEnvelope, data: BatchView, feature?: string) {
  const identity = (models: BatchView['models']) =>
    models
      .map((m) => [m.task, m.model_version, m.artifact_sha256, m.metadata_sha256].join('|'))
      .sort()
      .join(';');
  if (
    value.contract_version !== '1.0.0' ||
    value.rule_set_version !== '1.0.0' ||
    value.source !== data.source ||
    value.aggregate_fingerprint !== data.fingerprint ||
    identity(value.resolved_models) !== identity(data.models) ||
    !['ready', 'no_eligible_facts'].includes(value.status) ||
    !Array.isArray(value.insights)
  )
    throw new ApiError('protocol');
  for (const key of new Set([...Object.keys(data.filters), ...Object.keys(value.filter_scope)])) {
    const a = data.filters[key as keyof typeof data.filters] ?? null;
    const b = value.filter_scope[key as keyof typeof value.filter_scope] ?? null;
    if (
      (key === 'date_from' || key === 'date_to') &&
      a &&
      b &&
      Date.parse(String(a)) === Date.parse(String(b))
    )
      continue;
    if (a !== b) throw new ApiError('protocol');
  }
  for (const item of value.insights) {
    if (
      !['purchase_distribution', 'segment_distribution', 'comparison', 'results'].includes(
        item.navigation_target.section,
      ) ||
      item.navigation_target.scope !== 'same_applied_filters' ||
      (item.feature_key && item.feature_key !== feature) ||
      item.navigation_target.feature_key !== item.feature_key ||
      item.evidence.some((e) => e.source_fingerprint !== data.fingerprint) ||
      (item.model_identity &&
        !data.models.some((m) => identity([m]) === identity([item.model_identity!])))
    )
      throw new ApiError('protocol');
  }
  return value;
}
