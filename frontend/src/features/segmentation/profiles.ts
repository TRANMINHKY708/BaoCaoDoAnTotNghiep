import { ApiError } from '../../api/errors';
import type { Spec } from '../predictions/prediction';
export type Stat = { mean: number | null; observed_count: number };
export type Notable = {
  feature: string;
  cluster_mean: number;
  overall_mean: number;
  difference: number;
  standardized_difference: number;
};
export type Cluster = {
  cluster_id: number;
  record_count: number;
  share_percent: number | null;
  status: string;
  features: Record<string, Stat>;
  notable_features: Notable[];
};
export type Profiles = {
  source: string;
  source_name: string;
  model_id: string;
  model_version: string;
  artifact_sha256: string;
  dataset_sha256: string;
  computed_at: string;
  total_records: number;
  records_used: number;
  actual_cluster_count: number;
  configured_cluster_count: number;
  count_unit: string;
  statistics_space: string;
  minimum_observed_per_mean: number;
  status: string;
  feature_names: string[];
  overall: Record<string, Stat>;
  clusters: Cluster[];
  disclaimer: string;
};
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const integer = (n: unknown): n is number => finite(n) && Number.isInteger(n) && n >= 0;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
export function verifyProfiles(v: unknown, spec: Spec): Profiles {
  const fail = () => {
    throw new ApiError('protocol');
  };
  if (!object(v)) return fail();
  const names = spec.features.map((f) => f.name);
  if (
    v.source !== 'cleaned_research_dataset' ||
    v.count_unit !== 'research_records_not_unique_application_customers' ||
    v.statistics_space !== 'original_units_validity_cleaned_before_imputation_clipping_scaling' ||
    v.model_id !== spec.model.model_id ||
    v.model_version !== spec.model.model_version ||
    v.artifact_sha256 !== spec.model.artifact_sha256 ||
    typeof v.dataset_sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(v.dataset_sha256) ||
    typeof v.source_name !== 'string' ||
    typeof v.computed_at !== 'string' ||
    !Number.isFinite(Date.parse(v.computed_at)) ||
    !integer(v.total_records) ||
    v.records_used !== v.total_records ||
    v.configured_cluster_count !== 3 ||
    !integer(v.actual_cluster_count) ||
    v.actual_cluster_count > 3 ||
    v.minimum_observed_per_mean !== 2 ||
    v.status !==
      (v.total_records >= 2 ? 'sufficient_for_descriptive_statistics' : 'insufficient_data') ||
    JSON.stringify(v.feature_names) !== JSON.stringify(names) ||
    !Array.isArray(v.clusters) ||
    v.clusters.length !== 3 ||
    !object(v.overall)
  )
    return fail();
  const stats = (value: unknown, count: number) => {
    if (!object(value) || Object.keys(value).length !== names.length) return fail();
    for (const n of names) {
      const f = value[n];
      if (
        !object(f) ||
        !integer(f.observed_count) ||
        f.observed_count > count ||
        !(f.mean === null || finite(f.mean)) ||
        f.observed_count < 2 !== (f.mean === null)
      )
        return fail();
    }
  };
  stats(v.overall, v.total_records);
  const ids = new Set();
  let total = 0,
    actual = 0;
  for (const c of v.clusters) {
    if (
      !object(c) ||
      !integer(c.cluster_id) ||
      c.cluster_id > 2 ||
      ids.has(c.cluster_id) ||
      !integer(c.record_count) ||
      c.status !==
        (c.record_count >= 2 ? 'sufficient_for_descriptive_statistics' : 'insufficient_data') ||
      !Array.isArray(c.notable_features)
    )
      return fail();
    if (
      v.total_records === 0
        ? c.share_percent !== null
        : !finite(c.share_percent) ||
          Math.abs(c.share_percent - (100 * c.record_count) / v.total_records) > 1e-6
    )
      return fail();
    ids.add(c.cluster_id);
    total += c.record_count;
    if (c.record_count) actual++;
    stats(c.features, c.record_count);
    for (const f of c.notable_features) {
      if (
        !object(f) ||
        typeof f.feature !== 'string' ||
        !names.includes(f.feature) ||
        !finite(f.cluster_mean) ||
        !finite(f.overall_mean) ||
        !finite(f.difference) ||
        !finite(f.standardized_difference)
      )
        return fail();
    }
  }
  if (
    total !== v.total_records ||
    actual !== v.actual_cluster_count ||
    typeof v.disclaimer !== 'string'
  )
    return fail();
  return v as unknown as Profiles;
}
