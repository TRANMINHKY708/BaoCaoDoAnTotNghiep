export type ImportIntent = {
  manifest_reference: string;
  manifest_digest: string;
  idempotency_key: string;
  acknowledge_import: true;
  accept_partial: boolean;
};
export type ImportJob = {
  job_id: string;
  idempotency_key: string;
  status: 'pending' | 'completed' | 'failed';
  counts: Record<string, number>;
  metadata: { filename?: string; sources?: string[] };
  created_at: string;
  completed_at: string | null;
  error_code: string | null;
  error_row: number | null;
};
export type ImportDetail = {
  job: ImportJob;
  total_rows: number;
  offset: number;
  limit: number;
  rows: {
    row: number;
    status: 'applied' | 'excluded';
    customer_id: string | null;
    snapshot_id: string | null;
    outcome: {
      identity?: { source_system: string; external_customer_id: string };
      customer_action?: string;
      snapshot_action?: string;
      missing_features?: string[];
      reason?: string;
      codes?: string[];
    };
  }[];
};
