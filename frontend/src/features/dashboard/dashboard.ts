import { vietnamDateTime } from '../../utils/time';
import type { components } from '../../api/generated';

export type Overview = components['schemas']['DashboardOverview'];
export type DashboardFilters = {
  timezone: 'Asia/Ho_Chi_Minh';
  date_from?: string;
  date_to?: string;
  classification_model_version: '1.0.0' | '2.0.0-snapshot-conservative12';
  segmentation_model_version: '1.0.0' | '2.0.0-snapshot-k3';
  segment_id?: string;
  table_limit: number;
};
export const initialFilters: DashboardFilters = {
  timezone: 'Asia/Ho_Chi_Minh',
  classification_model_version: '1.0.0',
  segmentation_model_version: '1.0.0',
  table_limit: 10,
};
export const segmentsFor = (version: string) =>
  version === '1.0.0'
    ? [0, 1, 2].map((i) => `legacy:1.0.0:cluster:${i}`)
    : ['engagement_low', 'engagement_medium', 'engagement_high'];
export const number = (value: number) => new Intl.NumberFormat('vi-VN').format(value);
export const percent = (value: number | null) =>
  value === null
    ? 'Chưa có tỷ lệ'
    : `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value * 100)}%`;
export const localTime = (value: string | null) => vietnamDateTime(value, 'Chưa có kết quả');
export const warningLabels: Record<Overview['warnings'][number], string> = {
  PARTIAL_CURRENT_DAY: 'Ngày TP.HCM hiện tại chưa kết thúc; số liệu ngày này chỉ đến mốc dữ liệu.',
  UNLINKED_RESULTS_NOT_CUSTOMERS:
    'Có kết quả chưa liên kết khách hàng: chỉ tính lượt lưu, không tính khách hàng duy nhất.',
  UNLINKED_RESULTS_EXCLUDED_BY_SEGMENT_FILTER:
    'Kết quả không liên kết bị loại khỏi bộ lọc phân nhóm vì không thể xác định khách hàng.',
  UNLINKED_SCENARIOS_EXCLUDED_BY_SEGMENT_FILTER:
    'Kịch bản không liên kết bị loại khỏi cohort đã chọn.',
  RESEARCH_PERSISTENCE_UNSUPPORTED:
    'Phiên bản đã chọn chỉ hỗ trợ phân tích, chưa hỗ trợ lưu kết quả. Thống kê chỉ dùng lịch sử hệ thống.',
  SEGMENT_LABELS_UNAVAILABLE:
    'Thiếu từ điển tên phân nhóm hợp lệ. Giữ nguyên ID, không suy đoán nhãn.',
  INFERENCE_MODEL_UNAVAILABLE:
    'Có mô hình suy luận chưa sẵn sàng. Lịch sử hợp lệ vẫn được đọc, không đổi phiên bản ngầm.',
  CURRENT_CUSTOMERS_NOT_HISTORICAL_POPULATION:
    'Tập đang xem gồm khách hàng hiện có, kể cả ngưng hoạt động; không tái hiện đầy đủ tập khách hàng trong quá khứ.',
};
