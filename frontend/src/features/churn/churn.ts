import data from './data/churnReport.json';

/** Static churn research results exported by scripts/export_churn_report.py (reports/k). */
export const churnReport = data;
export type ChurnReport = typeof data;
export type CurveSource = 'oof' | 'holdout';

export const RISK_ORDER = ['low', 'medium', 'high'] as const;
export type RiskLevel = (typeof RISK_ORDER)[number];
export const riskLabel: Record<RiskLevel, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
};
export const riskColor: Record<RiskLevel, string> = {
  low: 'var(--insight-ok)',
  medium: 'var(--insight-mid)',
  high: 'var(--insight-risk)',
};

export const sourceLabel: Record<CurveSource, string> = {
  oof: 'Ngoài fold trên tập huấn luyện',
  holdout: 'Tập kiểm tra (đã chấm một lần)',
};

export interface ThresholdPoint {
  threshold: number;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  rows: number;
  contacted: number;
  contactedShare: number;
  precision: number | null;
  recall: number;
  f1: number | null;
}

/** Confusion counts and derived metrics when flagging customers with probability >= threshold. */
export function thresholdPoint(source: CurveSource, index: number): ThresholdPoint {
  const curve = churnReport.curves[source];
  const threshold = churnReport.curves.thresholds[index] ?? 0.5;
  const tp = curve.tp[index] ?? 0;
  const fp = curve.fp[index] ?? 0;
  const fn = curve.fn[index] ?? 0;
  const tn = curve.tn[index] ?? 0;
  const contacted = tp + fp;
  const precision = contacted ? tp / contacted : null;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 =
    precision !== null && precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : null;
  return {
    threshold,
    tp,
    fp,
    fn,
    tn,
    rows: curve.rows,
    contacted,
    contactedShare: contacted / curve.rows,
    precision,
    recall,
    f1,
  };
}

/** Index of a threshold on the exported grid (nearest point). */
export function thresholdIndex(value: number): number {
  const grid = churnReport.curves.thresholds;
  let best = 0;
  grid.forEach((t, i) => {
    if (Math.abs(t - value) < Math.abs((grid[best] ?? 0) - value)) best = i;
  });
  return best;
}

/** Risk level used by the deployed model (same rule as src/training/churn_artifacts.py). */
export function riskLevel(probability: number): RiskLevel {
  const { low_below: low, high_from: high } = churnReport.model.risk_thresholds;
  if (probability < low) return 'low';
  if (probability >= high) return 'high';
  return 'medium';
}
