import type { components } from '../../api/generated';
import { ApiError } from '../../api/errors';
import { normalizeBaseUrl } from '../../api/client';

export type AccountUser = components['schemas']['Auth01User'];
export type Capability = components['schemas']['Auth01Capability'];
export type AccountReply = components['schemas']['Auth01Me'];
export type AuthState =
  | 'anonymous'
  | 'bootstrapping'
  | 'authenticating'
  | 'restoring'
  | 'password_change_required'
  | 'authenticated'
  | 'signing_out'
  | 'session_unknown';
export type AccountsOptions = { profile: 'accounts'; trustedApiOrigin?: string };

export function accountCredentials(
  base: string,
  trustedOrigin?: string,
): 'same-origin' | 'include' {
  const target = new URL(normalizeBaseUrl(base), window.location.origin);
  if (target.origin === window.location.origin) return 'same-origin';
  const here = new URL(window.location.origin);
  if (
    target.origin !== trustedOrigin ||
    target.hostname !== here.hostname ||
    target.protocol !== here.protocol
  )
    throw new ApiError('configuration');
  return 'include';
}

export function validateIdentity(value: AccountReply): AccountReply {
  const user = value?.user;
  if (
    !user ||
    !/^[0-9a-f-]{36}$/i.test(user.id) ||
    !['ADMIN', 'OPERATOR', 'VIEWER'].includes(user.role) ||
    !user.is_active ||
    typeof user.must_change_password !== 'boolean' ||
    !Array.isArray(value.capabilities) ||
    value.capabilities.some((cap) => typeof cap !== 'string') ||
    (user.must_change_password && value.capabilities.length !== 0) ||
    !Number.isFinite(Date.parse(value.session?.expires_at)) ||
    !Number.isFinite(Date.parse(value.session?.idle_expires_at))
  )
    throw new ApiError('protocol');
  return value;
}

export const PASSWORD_MIN = 8,
  PASSWORD_MAX = 128;
/** Length the backend checks: Unicode code points after NFC. */
export const passwordLength = (value: string) => [...value.normalize('NFC')].length;

export function passwordIssue(value: string) {
  const normalized = value.normalize('NFC');
  const size = passwordLength(value);
  if ([...value].length > 512 || size > PASSWORD_MAX)
    return `Mật khẩu dài quá ${PASSWORD_MAX} ký tự.`;
  if (!normalized.trim()) return 'Mật khẩu không được chỉ có khoảng trắng.';
  if (size < PASSWORD_MIN)
    return `Mật khẩu cần ít nhất ${PASSWORD_MIN} ký tự (bạn mới nhập ${size} ký tự).`;
  return '';
}

const LOCKOUT = 'Nhập sai 5 lần liên tiếp, tài khoản bị khóa tạm 15 phút.';

/**
 * K18: plain-language messages for password failures the server reports. Returns '' when the error is
 * not a password problem, so the caller falls back to the generic error panel.
 */
export function passwordFailure(error: unknown, form: 'login' | 'change' | 'admin'): string {
  if (!(error instanceof ApiError) || error.kind !== 'http') return '';
  if (form === 'login') {
    if (error.status === 401 || error.status === 422)
      return `Tên đăng nhập hoặc mật khẩu chưa đúng, hoặc tài khoản đang bị khóa. ${LOCKOUT}`;
    if (error.status === 429)
      return 'Bạn đã đăng nhập sai quá nhiều lần. Vui lòng đợi rồi thử lại.';
    return '';
  }
  if (error.code === 'REAUTH_FAILED')
    return form === 'change'
      ? `Mật khẩu hiện tại chưa đúng. ${LOCKOUT}`
      : `Mật khẩu quản trị của bạn chưa đúng. ${LOCKOUT}`;
  if (error.code === 'PASSWORD_UNCHANGED') return 'Mật khẩu mới phải khác mật khẩu hiện tại.';
  if (error.status === 422)
    return form === 'change'
      ? 'Mật khẩu mới quá phổ biến (ví dụ 12345678, password). Hãy chọn mật khẩu khó đoán hơn.'
      : 'Mật khẩu ban đầu quá phổ biến (ví dụ 12345678, password) hoặc thông tin chưa hợp lệ. Hãy kiểm tra lại.';
  return '';
}

export function safeDestination(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 2048 ||
    value.includes('\\') ||
    !value.startsWith('/') ||
    value.startsWith('//')
  )
    return '/dashboard';
  const url = new URL(value, window.location.origin);
  if (
    url.origin !== window.location.origin ||
    !/^\/(dashboard|batch-analytics|customers|predictions|segmentation|what-if|history|system|admin\/users)(\/|$)/.test(
      url.pathname,
    )
  )
    return '/dashboard';
  return url.pathname + url.search;
}

export const roleLabel = (role?: string) =>
  ({ ADMIN: 'Quản trị viên', OPERATOR: 'Vận hành', VIEWER: 'Chỉ xem' })[role ?? ''] ??
  'Chưa đăng nhập';
