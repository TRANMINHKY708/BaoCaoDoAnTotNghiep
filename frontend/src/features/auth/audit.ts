import { ApiError } from '../../api/errors';

/** K8 audit log (GET /api/v1/admin/audit-events, Admin only). Hand-typed like other post-AUTH-03 endpoints. */
export type AuditCategory = 'auth' | 'users' | 'business';
export type AuditOutcome = 'success' | 'denied' | 'failure';
export interface AuditPerson {
  id: string;
  username: string;
  display_name: string;
  role: 'VIEWER' | 'OPERATOR' | 'ADMIN';
}
export interface AuditEvent {
  id: string;
  occurred_at: string;
  event_code: string;
  category: AuditCategory;
  outcome: AuditOutcome;
  actor: AuditPerson | null;
  subject: AuditPerson | null;
  resource_type: string | null;
  resource_id: string | null;
  request_id: string;
}
export interface AuditPage {
  items: AuditEvent[];
  limit: number;
  next_cursor: string | null;
  timezone: 'UTC' | 'Asia/Ho_Chi_Minh';
}
export interface AuditFilters {
  user_id?: string;
  category?: AuditCategory;
  outcome?: AuditOutcome;
  date_from?: string;
  date_to?: string;
}

export const eventLabel: Record<string, string> = {
  'auth.login': 'Đăng nhập',
  'auth.logout': 'Đăng xuất',
  'auth.password_changed': 'Đổi mật khẩu',
  'auth.password_reset': 'Đặt lại mật khẩu',
  'auth.sessions_revoked': 'Thu hồi phiên đăng nhập',
  'auth.bootstrap': 'Khởi tạo quản trị viên đầu tiên',
  'user.created': 'Tạo tài khoản',
  'user.updated': 'Cập nhật tài khoản',
  'user.locked': 'Khóa tài khoản',
  'user.unlocked': 'Mở khóa tài khoản',
  'user.role_changed': 'Đổi vai trò',
  'business.created': 'Tạo dữ liệu nghiệp vụ',
  'business.updated': 'Cập nhật dữ liệu nghiệp vụ',
  'business.replayed': 'Gửi lại yêu cầu đã xử lý',
};
export const categoryLabel: Record<AuditCategory, string> = {
  auth: 'Đăng nhập và phiên',
  users: 'Quản lý người dùng',
  business: 'Dữ liệu nghiệp vụ',
};
export const outcomeLabel: Record<AuditOutcome, string> = {
  success: 'Thành công',
  denied: 'Bị từ chối',
  failure: 'Lỗi',
};
export const resourceLabel: Record<string, string> = {
  users: 'Tài khoản',
  customer: 'Khách hàng',
  snapshot: 'Snapshot hành vi',
  prediction_run: 'Lượt dự đoán',
  scenario: 'Kịch bản What-if',
};

const CATEGORIES = new Set(['auth', 'users', 'business']);
const OUTCOMES = new Set(['success', 'denied', 'failure']);
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const person = (v: unknown) =>
  v === null ||
  (isObject(v) &&
    typeof v.id === 'string' &&
    typeof v.username === 'string' &&
    typeof v.display_name === 'string');

/** Reject anything outside the audit contract, including fields that should never be sent. */
export function checkedAuditPage(value: unknown): AuditPage {
  if (
    !isObject(value) ||
    !Array.isArray(value.items) ||
    !(value.next_cursor === null || typeof value.next_cursor === 'string')
  )
    throw new ApiError('protocol');
  for (const item of value.items) {
    if (
      !isObject(item) ||
      typeof item.id !== 'string' ||
      !Number.isFinite(Date.parse(String(item.occurred_at))) ||
      typeof item.event_code !== 'string' ||
      !CATEGORIES.has(String(item.category)) ||
      !OUTCOMES.has(String(item.outcome)) ||
      !person(item.actor) ||
      !person(item.subject) ||
      'session_id' in item ||
      'details' in item
    )
      throw new ApiError('protocol');
  }
  return value as unknown as AuditPage;
}

/** Filters from the URL; invalid values are dropped rather than sent. */
export function filtersFrom(params: URLSearchParams): AuditFilters {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const day = /^\d{4}-\d{2}-\d{2}$/;
  const result: AuditFilters = {};
  const user = params.get('user_id');
  if (user && uuid.test(user)) result.user_id = user;
  const category = params.get('category');
  if (category && CATEGORIES.has(category)) result.category = category as AuditCategory;
  const outcome = params.get('outcome');
  if (outcome && OUTCOMES.has(outcome)) result.outcome = outcome as AuditOutcome;
  for (const key of ['date_from', 'date_to'] as const) {
    const value = params.get(key);
    if (value && day.test(value)) result[key] = value;
  }
  return result;
}

export const personName = (p: AuditPerson | null) =>
  p
    ? p.display_name && p.display_name !== p.username
      ? `${p.display_name} (${p.username})`
      : p.username
    : '—';
