import lab from './data/modelLab.json';
import { modelLabel } from '../insights/insights';

/** Typed view of modelLab.json (scripts/export_research_explorer.py). */
export const modelLab = lab;
export type Metric = string;
export interface Run {
  id: string;
  feature_set: string;
  model: string;
  folds: { repeat: number; fold: number }[];
  metrics: Record<Metric, (number | null)[]>;
}
interface PairStats {
  mean_difference: number | null;
  t: number | null;
  p_value: number;
  a_wins: number;
  ties: number;
}
export const runs = lab.runs as unknown as Run[];
export const pairs = lab.pairs as unknown as {
  a: string;
  b: string;
  metrics: Record<Metric, PairStats>;
}[];
export const foldValues = (run: Run, metric: Metric) => run.metrics[metric] ?? [];

export const metricLabel: Record<string, string> = {
  macro_f1: 'Macro F1',
  accuracy: 'Accuracy',
  medium_f1: 'F1 lớp Trung bình',
  macro_precision: 'Macro precision',
  macro_recall: 'Macro recall',
  macro_roc_auc_ovr: 'ROC-AUC (OvR)',
  macro_average_precision_ovr: 'Average precision (OvR)',
  log_loss: 'Log loss',
  multiclass_brier_sum: 'Brier (tổng 3 lớp)',
  top_label_ece_10_bins: 'ECE (10 khoảng)',
  fit_seconds: 'Thời gian huấn luyện (giây)',
};
export const FEATURE_SETS = ['conservative12', 'full24'] as const;
export const featureSetLabel: Record<string, string> = {
  conservative12: 'Bảo thủ 12',
  full24: 'Đầy đủ 24',
};
export const MODEL_COLORS: Record<string, string> = {
  XGBoost: 'var(--insight-high)',
  MLP: 'var(--chart-2)',
  RandomForest: 'var(--insight-ok)',
  LogisticRegression: 'var(--insight-low)',
};
export const T4 = 'conservative12:XGBoost';
export const lowerIsBetter = (metric: string) => (lab.lower_is_better as string[]).includes(metric);
export const runLabel = (run: Run) =>
  `${modelLabel[run.model] ?? run.model} · ${featureSetLabel[run.feature_set]}`;
export const mean = (values: (number | null)[]) => {
  const valid = values.filter((v): v is number => v !== null);
  return valid.reduce((a, b) => a + b, 0) / (valid.length || 1);
};

/** Macro F1, accuracy and coverage of the predictions kept by a confidence threshold. */
export function acceptedScores(matrix: number[][], total: number) {
  const accepted = matrix.flat().reduce((a, b) => a + b, 0);
  const correct = matrix.reduce((sum, row, i) => sum + (row[i] ?? 0), 0);
  const f1s: number[] = [];
  matrix.forEach((row, i) => {
    const support = row.reduce((a, b) => a + b, 0);
    const predicted = matrix.reduce((sum, r) => sum + (r[i] ?? 0), 0);
    if (!support && !predicted) return;
    const tp = row[i] ?? 0;
    const precision = predicted ? tp / predicted : 0;
    const recall = support ? tp / support : 0;
    f1s.push(precision + recall ? (2 * precision * recall) / (precision + recall) : 0);
  });
  return {
    accepted,
    coverage: total ? accepted / total : 0,
    accuracy: accepted ? correct / accepted : null,
    macroF1: f1s.length ? f1s.reduce((a, b) => a + b, 0) / f1s.length : null,
  };
}
