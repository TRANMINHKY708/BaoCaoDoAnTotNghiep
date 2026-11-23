import type { BatchView } from './types';

// Units follow the current data contract; do not infer a window, currency or duration unit.
export const comparisonFeatures = {
  Login_Frequency: {
    label: 'Tần suất đăng nhập',
    unit: 'lượt đăng nhập',
  },
  Session_Duration_Avg: {
    label: 'Thời lượng phiên trung bình',
    unit: 'đơn vị thời lượng của nguồn, chưa xác minh',
  },
  Pages_Per_Session: { label: 'Số trang mỗi phiên', unit: 'trang/phiên' },
  Cart_Abandonment_Rate: { label: 'Tỷ lệ bỏ giỏ hàng', unit: '%' },
  Wishlist_Items: { label: 'Sản phẩm yêu thích', unit: 'sản phẩm' },
  Total_Purchases: { label: 'Số lượt mua ghi nhận', unit: 'lượt mua' },
  Average_Order_Value: {
    label: 'Giá trị đơn trung bình',
    unit: 'đơn vị tiền tệ của nguồn, chưa xác minh',
  },
  Days_Since_Last_Purchase: { label: 'Thời gian từ lần mua gần nhất', unit: 'ngày' },
  Discount_Usage_Rate: { label: 'Tỷ lệ dùng giảm giá', unit: '%' },
  Mobile_App_Usage: { label: 'Mức sử dụng ứng dụng', unit: 'đơn vị của nguồn, chưa xác minh' },
} as const;
export type ComparisonFeature = keyof typeof comparisonFeatures;
export const finiteMean = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
export function supportedFeatures(profiles: BatchView['cluster_profiles']): ComparisonFeature[] {
  return (Object.keys(comparisonFeatures) as ComparisonFeature[]).filter((key) =>
    profiles.some(
      (profile) =>
        Object.hasOwn(profile.means, key) &&
        (profile.means[key] === null || finiteMean(profile.means[key])),
    ),
  );
}
export function valueScale(values: number[]) {
  const low = Math.min(0, ...values),
    high = Math.max(0, ...values);
  // Normalize coordinates only (not displayed measurements), avoiding overflow for large finite means.
  const magnitude = Math.max(Math.abs(low), Math.abs(high)) || 1;
  const from = low / magnitude,
    to = high / magnitude;
  return {
    low,
    high: high === low ? 1 : high,
    x: (value: number) => 16 + ((value / magnitude - from) / (to - from || 1)) * 568,
  };
}
export const formatMean = (value: number) =>
  new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: 12 }).format(value);
