export type AnalysisTask = 'classification' | 'segmentation';
export type AnalysisJob = {
  job_id: string;
  import_job_id: string;
  task: AnalysisTask;
  model_version: string;
  artifact_sha256: string;
  metadata_sha256: string;
  persist_results: boolean;
  status: 'queued' | 'running' | 'completed' | 'failed';
  counts: Record<string, number>;
  attempts: number;
  error_code: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};
export type AnalysisDetail = {
  job: AnalysisJob;
  offset: number;
  limit: number;
  preview_available: number;
  distribution: Record<string, number>;
  rows: {
    customer_id: string;
    customer_reference?: string;
    snapshot_id: string;
    status: string;
    error_code: string | null;
    saved: boolean;
    result: {
      purchase_level?: string;
      probabilities?: Record<string, number>;
      cluster?: number;
      segment_name?: string;
      distance_to_centroid?: number;
    } | null;
  }[];
};
