export type ReportTarget =
  | { source: 'preview'; receipt: string }
  | { source: 'customer'; customer_id: string; limit?: number }
  | {
      source: 'stored';
      kind: 'prediction' | 'segmentation' | 'what_if';
      customer_id: string;
      record_id: string;
    }
  | { source: 'churn_watchlist'; risk_levels: ('high' | 'medium' | 'low')[] };
export type ReportRequest = ReportTarget & {
  format: 'pdf' | 'xlsx';
  include_ai?: boolean;
  include_research?: boolean;
};
