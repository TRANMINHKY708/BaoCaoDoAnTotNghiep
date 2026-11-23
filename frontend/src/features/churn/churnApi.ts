import { ApiError } from '../../api/errors';
import type { Snapshot } from '../customers/customers';
import { RISK_ORDER, type RiskLevel } from './churn';

/** K5 churn API (GET /api/v1/churn/model, POST /api/v1/churn/predict[/batch]). Hand-typed:
 * generated.ts is frozen at the AUTH-03 contract, like the other F01–F11 endpoints. */
export const CHURN_FEATURES = [
  'Age',
  'Gender',
  'Country',
  'City',
  'Membership_Years',
  'Login_Frequency',
  'Session_Duration_Avg',
  'Pages_Per_Session',
  'Cart_Abandonment_Rate',
  'Wishlist_Items',
  'Average_Order_Value',
  'Discount_Usage_Rate',
  'Returns_Rate',
  'Email_Open_Rate',
  'Customer_Service_Calls',
  'Product_Reviews_Written',
  'Social_Media_Engagement_Score',
  'Mobile_App_Usage',
  'Payment_Method_Diversity',
  'Credit_Balance',
  'Signup_Quarter',
] as const;
export type ChurnFeature = (typeof CHURN_FEATURES)[number];
export type ChurnCustomer = Record<ChurnFeature, string | number | null>;
const TEXT_FEATURES = new Set<string>(['Gender', 'Country', 'City', 'Signup_Quarter']);
export const MAX_CHURN_BATCH = 100;

export interface RiskThresholds {
  low_below: number;
  high_from: number;
}
export interface ChurnFactor {
  feature: string;
  value: string | number | null;
  shap_value: number;
  direction: 'increases_risk' | 'decreases_risk';
}
export interface ChurnPrediction {
  task: 'churn';
  model_id: 'customer-churn-xgboost';
  model_version: string;
  generated_at: string;
  churn_probability: number;
  risk_level: RiskLevel;
  predicted_churn: boolean;
  decision_threshold: number;
  risk_thresholds: RiskThresholds;
  scope: string;
  explanation?: {
    base_value: number;
    model_output: number;
    additivity_error: number;
    factors: ChurnFactor[];
    disclaimer: string;
  };
}
export interface ChurnModelInfo {
  model_id: 'customer-churn-xgboost';
  model_version: string;
  feature_policy: string;
  algorithm: string;
  available: boolean;
  unavailable_code: string | null;
  artifact_sha256: string;
  feature_count: number;
  features: string[];
  excluded_features: string[];
  decision_threshold: number;
  risk_thresholds: RiskThresholds;
  holdout: {
    rows: number;
    churn_rate: number;
    roc_auc: number;
    pr_auc: number;
    f1: number;
    precision: number;
    recall: number;
    brier: number;
    ece: number;
    scored_at: string;
  };
  persistence_supported: false;
  max_batch_size: number;
  limitations: string[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const unit = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/** Reject any response that does not match the churn contract instead of guessing. */
export function checkedPrediction(value: unknown): ChurnPrediction {
  if (
    !isObject(value) ||
    value.task !== 'churn' ||
    value.model_id !== 'customer-churn-xgboost' ||
    !unit(value.churn_probability) ||
    !RISK_ORDER.includes(value.risk_level as RiskLevel) ||
    typeof value.predicted_churn !== 'boolean' ||
    !unit(value.decision_threshold) ||
    !isObject(value.risk_thresholds) ||
    !unit(value.risk_thresholds.low_below) ||
    !unit(value.risk_thresholds.high_from)
  )
    throw new ApiError('protocol');
  if (value.explanation !== undefined) {
    const explanation = value.explanation;
    if (
      !isObject(explanation) ||
      !Array.isArray(explanation.factors) ||
      explanation.factors.some(
        (f) =>
          !isObject(f) ||
          typeof f.feature !== 'string' ||
          typeof f.shap_value !== 'number' ||
          !Number.isFinite(f.shap_value),
      )
    )
      throw new ApiError('protocol');
  }
  return value as unknown as ChurnPrediction;
}

export function checkedBatch(value: unknown, expected: number): ChurnPrediction[] {
  if (
    !isObject(value) ||
    !Array.isArray(value.results) ||
    value.total !== expected ||
    value.results.length !== expected
  )
    throw new ApiError('protocol');
  return value.results.map(checkedPrediction);
}

export function checkedModelInfo(value: unknown): ChurnModelInfo {
  if (
    !isObject(value) ||
    value.model_id !== 'customer-churn-xgboost' ||
    typeof value.available !== 'boolean' ||
    !Array.isArray(value.features) ||
    !isObject(value.holdout) ||
    !unit(value.holdout.roc_auc) ||
    !isObject(value.risk_thresholds)
  )
    throw new ApiError('protocol');
  return value as unknown as ChurnModelInfo;
}

/** The 21 churn inputs of a stored snapshot. Missing values stay null (the model imputes them);
 * Churned, Lifetime_Value, Total_Purchases and Days_Since_Last_Purchase are never sent. */
export function churnInput(snapshot: Snapshot | Record<string, unknown>): {
  customer: ChurnCustomer;
  missing: ChurnFeature[];
} {
  const source = snapshot as Record<string, unknown>;
  const missing: ChurnFeature[] = [];
  const customer = {} as ChurnCustomer;
  for (const feature of CHURN_FEATURES) {
    const value = source[feature];
    const valid = TEXT_FEATURES.has(feature)
      ? typeof value === 'string' && value.trim() !== ''
      : typeof value === 'number' && Number.isFinite(value);
    customer[feature] = valid ? (value as string | number) : null;
    if (!valid) missing.push(feature);
  }
  return { customer, missing };
}

/** A snapshot that already records churn is shown as observed, never re-predicted. */
export const recordedChurn = (snapshot: Snapshot | Record<string, unknown>) =>
  (snapshot as Record<string, unknown>).Churned === true;

/** Retention ideas for the factors that push risk up (associations, not causes). */
export const retentionAdvice: Partial<Record<string, string>> = {
  Customer_Service_Calls:
    'Liên hệ chủ động để xử lý dứt điểm vấn đề khách đang gặp; ưu tiên chuyển cho nhân viên chăm sóc có kinh nghiệm.',
  Cart_Abandonment_Rate:
    'Nhắc giỏ hàng bị bỏ dở, kiểm tra lại phí vận chuyển và bước thanh toán mà khách hay dừng.',
  Average_Order_Value:
    'Khách chi nhiều mỗi đơn: chăm sóc riêng theo hạng thành viên thay vì chỉ gửi khuyến mãi chung.',
  Returns_Rate:
    'Xem lại các sản phẩm khách thường trả; cải thiện mô tả, kích cỡ hoặc hỗ trợ đổi hàng.',
  Discount_Usage_Rate: 'Gửi ưu đãi cá nhân hóa có thời hạn để tạo lý do mua lại.',
  Email_Open_Rate:
    'Khách ít mở email: đổi kênh liên hệ (thông báo ứng dụng, tin nhắn) và cá nhân hóa nội dung.',
  Session_Duration_Avg: 'Gợi ý nội dung và sản phẩm liên quan để phiên truy cập có giá trị hơn.',
  Mobile_App_Usage: 'Mời dùng ứng dụng với ưu đãi riêng trên app.',
  Login_Frequency: 'Tạo lý do quay lại: nhắc hàng mới, điểm thưởng theo tuần.',
  Wishlist_Items: 'Nhắc khi sản phẩm trong danh sách yêu thích giảm giá hoặc sắp hết.',
  Pages_Per_Session: 'Cải thiện gợi ý "thường mua cùng" và điều hướng theo danh mục.',
  Product_Reviews_Written: 'Mời đánh giá sản phẩm đã mua để tăng gắn kết.',
};
