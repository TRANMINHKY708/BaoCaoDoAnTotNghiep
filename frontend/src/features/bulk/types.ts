export type Dataset = 'behavior' | 'orders';
export type Filter = 'all' | 'valid' | 'error' | 'warning' | 'duplicate' | 'skipped';
export type ModelChoice = { task: 'classification' | 'segmentation'; version: string };
export type BulkConfig = {
  mapping: Record<string, string>;
  profile: 'snapshot' | 'model_input';
  models: ModelChoice[];
};
export type Inspection = {
  upload_reference: string;
  filename: string;
  size: number;
  file_fingerprint: string;
  headers: string[];
  total_rows: number;
  expires_at: string;
  contract: {
    contract_version: string;
    behavior_required_metadata: string[];
    behavior_optional_metadata: string[];
    behavior_features: { name: string }[];
    order_schema: { properties: Record<string, unknown> };
    models: { task: ModelChoice['task']; version: string; features: string[] }[];
  };
};
export type Stats = {
  total: number;
  valid: number;
  error: number;
  warning: number;
  duplicate: number;
  skipped: number;
  snapshot_eligible: number;
  snapshot_ineligible: number;
};
export type Preview = {
  preview_reference: string;
  expires_at: string;
  valid: boolean;
  mapping_valid: boolean;
  stats: Stats;
  rows: {
    row: number;
    status: string;
    valid: boolean;
    error: boolean;
    warning: boolean;
    duplicate: boolean;
    skipped: boolean;
    identity: { source_system: string; external_customer_id: string } | null;
    snapshot_eligible: boolean;
    missing_features: string[];
    values: Record<string, string>;
  }[];
  issues: {
    row: number | null;
    source_column: string | null;
    field: string | null;
    code: string;
    severity: string;
    message: string;
    value: string | null;
  }[];
  page: number;
  page_size: number;
  filtered_rows: number;
  database_written: false;
};
export type Manifest = {
  state: 'prepared_not_imported';
  manifest_reference: string;
  manifest_digest: string;
  row_keys: string[];
  expires_at: string;
  stats: Stats;
  database_written: false;
};
export type BulkSteps = {
  inspect: { body: FormData; response: Inspection };
  preview: {
    body: BulkConfig & {
      upload_reference: string;
      page: number;
      page_size: number;
      status: Filter;
    };
    response: Preview;
  };
  'prepare-confirmation': {
    body: {
      upload_reference: string;
      preview_reference: string;
      acknowledge_review: boolean;
      accept_partial: boolean;
    };
    response: Manifest;
  };
};
