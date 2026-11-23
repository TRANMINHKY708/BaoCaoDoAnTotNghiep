import { ApiError } from '../../api/errors';
import research from '../insights/researchInsights.json';
import cluster from '../explorer/data/clusterReport.json';

/** K9 GET /api/v1/models/usage (hand-typed like the other post-AUTH-03 endpoints). */
export interface ModelUsage {
  model_id: string;
  model_version: string;
  task: 'classification' | 'segmentation' | 'what_if';
  algorithm: string;
  artifact_sha256: string | null;
  registered_at: string;
  runs_total: number;
  runs_completed: number;
  runs_by_type: { single: number; batch: number; csv: number; scenario: number };
  results_saved: number;
  customers: number;
  last_used_at: string | null;
}
export interface UsageResponse {
  generated_at: string;
  models: ModelUsage[];
  scope: string;
}

const count = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

export function checkedUsage(value: unknown): UsageResponse {
  const v = value as UsageResponse;
  if (
    typeof value !== 'object' ||
    value === null ||
    !Array.isArray(v.models) ||
    v.models.some(
      (m) =>
        typeof m?.model_id !== 'string' ||
        typeof m.model_version !== 'string' ||
        !count(m.runs_total) ||
        !count(m.runs_completed) ||
        !count(m.results_saved) ||
        !count(m.customers) ||
        typeof m.runs_by_type !== 'object' ||
        m.runs_completed > m.runs_total,
    )
  )
    throw new ApiError('protocol');
  return v;
}

export const usageFor = (usage: ModelUsage[] | undefined, id: string, version: string) =>
  usage?.find((u) => u.model_id === id && u.model_version === version);

export const taskLabel: Record<string, string> = {
  classification: 'Dự đoán mức mua',
  segmentation: 'Phân khúc khách hàng',
  churn: 'Dự báo rời bỏ',
};

export interface Evaluation {
  clean: boolean;
  lines: string[];
  link: { to: string; label: string };
}

const t4 = research.holdout.conservative12;
const t5 = cluster.k_diagnostics.find((row) => row.K === cluster.k);
const ari = Math.min(...cluster.stability.results.map((r) => r.ari ?? 1));
const vn = (value: number, digits: number) =>
  value.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Evaluation shown for each catalog version. Only clean-protocol results are quoted with numbers. */
export function evaluationFor(task: string, version: string): Evaluation {
  if (task === 'classification' && version === '2.0.0-snapshot-conservative12')
    return {
      clean: true,
      lines: [
        `Macro F1 ${vn(t4.metrics.macro_f1, 3)} (KTC 95%: ${vn(t4.ci95.macro_f1.low, 3)}–${vn(t4.ci95.macro_f1.high, 3)}) trên ${research.holdout.rows.toLocaleString('vi-VN')} bản ghi kiểm tra, chấm một lần`,
        `Accuracy ${vn(100 * t4.metrics.accuracy, 1)}% · ROC-AUC ${vn(t4.metrics.macro_roc_auc_ovr, 3)} · ECE ${vn(100 * t4.metrics.top_label_ece_10_bins, 1)}%`,
      ],
      link: { to: '/model-report', label: 'Xem kết quả mô hình' },
    };
  if (task === 'segmentation' && version === '2.0.0-snapshot-k3' && t5)
    return {
      clean: true,
      lines: [
        `K = ${cluster.k} cố định trước khi tính chỉ số · silhouette ${vn(t5.silhouette_sample, 3)} · Davies–Bouldin ${vn(t5.davies_bouldin, 3)}`,
        `Ổn định qua ${cluster.stability.results.length} lần chạy lại: ARI thấp nhất ${vn(ari, 3)}`,
      ],
      link: { to: '/cluster-report', label: 'Xem đánh giá phân cụm' },
    };
  return {
    clean: false,
    lines: [
      task === 'classification'
        ? 'Chưa có đánh giá theo quy trình sạch: bản đầu dùng 24 thuộc tính, gồm Lifetime_Value và Churned có nguy cơ rò rỉ nhãn.'
        : 'Chưa có đánh giá theo quy trình sạch: bản đầu được huấn luyện trước khi khóa quy trình đánh giá.',
      'Giữ làm phiên bản mặc định để tương thích với kết quả đã lưu.',
    ],
    link:
      task === 'classification'
        ? { to: '/model-report', label: 'Xem phần rò rỉ dữ liệu' }
        : { to: '/cluster-report', label: 'Xem đánh giá phân cụm' },
  };
}

/** Features present in one version only (comparison table). */
export function featureDiff(a: string[], b: string[]) {
  const sa = new Set(a);
  const sb = new Set(b);
  return {
    onlyA: a.filter((f) => !sb.has(f)),
    onlyB: b.filter((f) => !sa.has(f)),
    shared: a.filter((f) => sb.has(f)),
  };
}
