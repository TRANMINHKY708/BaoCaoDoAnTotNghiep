export type BatchFilters = {
  import_job_id?: string | null;
  analysis_job_id?: string | null;
  classification_version?: string;
  segmentation_version?: string;
  classification_artifact?: string | null;
  classification_metadata?: string | null;
  segmentation_artifact?: string | null;
  segmentation_metadata?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  purchase_level?: string | null;
  cluster?: number | null;
  customer_query?: string | null;
};
export type ModelIdentity = {
  task: string;
  model_version: string;
  artifact_sha256: string;
  metadata_sha256: string;
};
export type BatchOptions = {
  scope: 'shared_workspace_read_only';
  imports: { job_id: string; created_at: string; filename: string }[];
  analyses: {
    id: string;
    import_job_id: string;
    task: string;
    model_version: string;
    status: string;
    created_at: string;
  }[];
  models: ModelIdentity[];
  truncated: { imports: boolean; analyses: boolean; models: boolean };
  limit: number;
};
export type ResultRow = ModelIdentity & {
  item_id: string;
  customer_id: string;
  snapshot_id: string;
  external_id: string;
  captured_at: string;
  analysis_job_id: string;
  import_job_id: string;
  analysis_created_at: string;
  result_created_at: string;
  item_status: string;
  error_code: string | null;
  purchase_level: string | null;
  cluster: number | null;
  segment_name: string | null;
  distance_to_centroid: number | null;
  reference_count: number;
  saved: boolean;
  probabilities: Record<string, number> | null;
};
export type BatchView = {
  source: 'postgresql_f09_f10_saved_history';
  as_of: string;
  timezone: 'Asia/Ho_Chi_Minh';
  filters: BatchFilters;
  fingerprint: string;
  kpis: Record<string, number>;
  definitions: Record<string, string>;
  models: ModelIdentity[];
  data_origins: string[];
  purchase_distribution: { label: string; count: number; share_percent: number }[];
  cluster_distribution: {
    cluster: number;
    segment_name: string;
    count: number;
    share_percent: number;
  }[];
  cluster_profiles: {
    cluster: number;
    records: number;
    means: Record<string, number | null>;
    status: string;
  }[];
  overall_means: Record<string, number | null>;
  trend: { day: string; analysis_jobs: number; failed_jobs: number }[];
  trend_available: boolean;
  warnings: string[];
  total_rows: number;
  offset: number;
  limit: number;
  rows: ResultRow[];
};
export type BatchAction = { filters: BatchFilters; fingerprint: string };
export type BatchExport = BatchAction & { source: 'batch_analytics'; format: 'pdf' | 'xlsx' };
export type BatchNarrative = {
  source: 'verified_batch_aggregates';
  result_fingerprint: string;
  generated_at: string;
  history_persisted: false;
  narrative: {
    overview: string;
    notable_factors: string[];
    interpretation: string;
    limitations: string[];
    reference_suggestions: string[];
  };
};
