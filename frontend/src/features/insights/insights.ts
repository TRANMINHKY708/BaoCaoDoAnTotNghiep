import data from './researchInsights.json';

/** Static research results exported by scripts/export_research_insights.py (reports/r2). */
export const research = data;
export type ResearchInsights = typeof data;

export const CLASS_ORDER = ['Low', 'Medium', 'High'] as const;
export type PurchaseClass = (typeof CLASS_ORDER)[number];
export const classLabel: Record<PurchaseClass, string> = {
  Low: 'Thấp',
  Medium: 'Trung bình',
  High: 'Cao',
};
export const classColor: Record<PurchaseClass, string> = {
  Low: 'var(--insight-low)',
  Medium: 'var(--insight-mid)',
  High: 'var(--insight-high)',
};

export const modelLabel: Record<string, string> = {
  LogisticRegression: 'Logistic Regression',
  RandomForest: 'Random Forest',
  MLP: 'MLP',
  XGBoost: 'XGBoost',
};

/** Behaviours that the T4 model uses and that a business can influence. */
export const ENGAGEMENT_FEATURES = [
  'Session_Duration_Avg',
  'Pages_Per_Session',
  'Mobile_App_Usage',
  'Login_Frequency',
  'Email_Open_Rate',
  'Wishlist_Items',
] as const;
export type EngagementFeature = (typeof ENGAGEMENT_FEATURES)[number];

export const units: Record<string, string> = {
  Session_Duration_Avg: 'phút',
  Pages_Per_Session: 'trang',
  Mobile_App_Usage: 'lần',
  Login_Frequency: 'lần',
  Email_Open_Rate: '%',
  Wishlist_Items: 'sản phẩm',
  Cart_Abandonment_Rate: '%',
  Discount_Usage_Rate: '%',
  Average_Order_Value: '',
  Days_Since_Last_Purchase: 'ngày',
  Membership_Years: 'năm',
  Age: 'tuổi',
};

export const advice: Record<EngagementFeature, string> = {
  Session_Duration_Avg:
    'Tăng độ hấp dẫn của phiên: bộ sưu tập theo chủ đề, nội dung so sánh và gợi ý sản phẩm liên quan.',
  Pages_Per_Session:
    'Khuyến khích khám phá thêm sản phẩm: gợi ý "thường mua cùng", điều hướng theo danh mục rõ ràng.',
  Mobile_App_Usage:
    'Mời cài và dùng ứng dụng: ưu đãi riêng trên app, thông báo đẩy cho sản phẩm quan tâm.',
  Login_Frequency:
    'Tạo lý do quay lại thường xuyên: điểm danh nhận thưởng, nhắc hàng mới về, ưu đãi theo tuần.',
  Email_Open_Rate:
    'Cá nhân hóa email: tiêu đề theo sở thích, gửi đúng khung giờ, giảm tần suất email chung chung.',
  Wishlist_Items:
    'Khuyến khích lưu sản phẩm yêu thích và nhắc khi sản phẩm trong danh sách giảm giá hoặc sắp hết.',
};

const formatter = (digits: number) =>
  new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: digits });

export function num(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : formatter(digits).format(value);
}

export function fixed(value: number | null | undefined, digits = 3): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : new Intl.NumberFormat('vi-VN', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value);
}

export function pct(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined ? '—' : `${num(value, digits)}%`;
}

export function pValue(p: number | null | undefined): string {
  if (p === null || p === undefined) return '—';
  if (p < 0.001) return 'p < 0,001';
  return `p = ${fixed(p, 3)}`;
}

export interface BehaviourGap {
  feature: EngagementFeature;
  value: number;
  threshold: number;
  targetMedian: number;
  gapPercent: number;
}

/**
 * Compare one snapshot with the research thresholds (where the T4 SHAP for the High class
 * turns positive). Missing values are skipped, never imputed. Sorted by relative gap, largest
 * first, weighted by the feature's global SHAP share so the strongest levers come first.
 */
export function behaviourGaps(values: Partial<Record<string, number | null | undefined>>): {
  below: BehaviourGap[];
  above: EngagementFeature[];
  missing: EngagementFeature[];
} {
  const thresholds = research.shap.thresholds as Record<
    EngagementFeature,
    { threshold: number | null; median_high_class: number | null }
  >;
  const share = Object.fromEntries(
    research.shap.ranking.map((row) => [row.feature, row.share_percent]),
  ) as Record<string, number>;
  const below: BehaviourGap[] = [];
  const above: EngagementFeature[] = [];
  const missing: EngagementFeature[] = [];
  for (const feature of ENGAGEMENT_FEATURES) {
    const value = values[feature];
    const item = thresholds[feature];
    if (value === null || value === undefined || !Number.isFinite(value)) {
      missing.push(feature);
    } else if (item.threshold !== null && value < item.threshold) {
      below.push({
        feature,
        value,
        threshold: item.threshold,
        targetMedian: item.median_high_class ?? item.threshold,
        gapPercent: (100 * (item.threshold - value)) / item.threshold,
      });
    } else {
      above.push(feature);
    }
  }
  below.sort(
    (a, b) => b.gapPercent * (share[b.feature] ?? 1) - a.gapPercent * (share[a.feature] ?? 1),
  );
  return { below, above, missing };
}
