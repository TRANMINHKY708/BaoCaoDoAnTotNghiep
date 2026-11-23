import { ApiError } from '../../api/errors';
import type { AuditPerson } from './audit';

/** K13 GET /api/v1/admin/overview (Admin only, read-only). Hand-typed like other post-AUTH-03 endpoints. */
export interface OverviewEvent {
  id: string;
  occurred_at: string;
  event_code: string;
  outcome: 'success' | 'denied' | 'failure';
  actor: AuditPerson | null;
  subject: AuditPerson | null;
}
export interface AttentionItem {
  user: AuditPerson;
  reasons: ('locked' | 'must_change_password')[];
  locked_until: string | null;
}
export interface AdminOverview {
  generated_at: string;
  window_hours: number;
  users: {
    total: number;
    active: number;
    inactive: number;
    by_role: { ADMIN: number; OPERATOR: number; VIEWER: number };
    locked: number;
    must_change_password: number;
    never_logged_in: number;
  };
  sessions: { active: number; users_online: number };
  last_24h: {
    logins_succeeded: number;
    logins_failed: number;
    user_changes: number;
    business_writes: number;
    denied: number;
  };
  attention: AttentionItem[];
  recent_admin_actions: OverviewEvent[];
  recent_failed_logins: OverviewEvent[];
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const counts = (v: unknown, keys: string[]) =>
  isObject(v) && Object.keys(v).length === keys.length && keys.every((k) => count(v[k]));
const person = (v: unknown) =>
  isObject(v) &&
  typeof v.id === 'string' &&
  typeof v.username === 'string' &&
  typeof v.display_name === 'string' &&
  ['ADMIN', 'OPERATOR', 'VIEWER'].includes(String(v.role));
const OUTCOMES = new Set(['success', 'denied', 'failure']);
const REASONS = new Set(['locked', 'must_change_password']);
// Key names that must never appear anywhere in the response (secrets or raw audit payloads).
const FORBIDDEN = /token|hash|csrf|session_id|details/i;
const USER_KEYS = [
  'total',
  'active',
  'inactive',
  'locked',
  'must_change_password',
  'never_logged_in',
];

function event(v: unknown) {
  return (
    isObject(v) &&
    typeof v.id === 'string' &&
    Number.isFinite(Date.parse(String(v.occurred_at))) &&
    typeof v.event_code === 'string' &&
    OUTCOMES.has(String(v.outcome)) &&
    (v.actor === null || person(v.actor)) &&
    (v.subject === null || person(v.subject))
  );
}

/** Reject anything outside the overview contract, including keys that should never be sent. */
export function checkedOverview(value: unknown): AdminOverview {
  const v = value as Record<string, unknown>;
  const users = isObject(v) && isObject(v.users) ? v.users : null;
  const { by_role: byRole, ...flat } = users ?? {};
  if (
    !isObject(v) ||
    !Number.isFinite(Date.parse(String(v.generated_at))) ||
    !count(v.window_hours) ||
    !users ||
    !counts(flat, USER_KEYS) ||
    !counts(byRole, ['ADMIN', 'OPERATOR', 'VIEWER']) ||
    !counts(v.sessions, ['active', 'users_online']) ||
    !counts(v.last_24h, [
      'logins_succeeded',
      'logins_failed',
      'user_changes',
      'business_writes',
      'denied',
    ]) ||
    !Array.isArray(v.attention) ||
    !Array.isArray(v.recent_admin_actions) ||
    !Array.isArray(v.recent_failed_logins) ||
    !v.recent_admin_actions.every(event) ||
    !v.recent_failed_logins.every(event) ||
    !v.attention.every(
      (a) =>
        isObject(a) &&
        person(a.user) &&
        Array.isArray(a.reasons) &&
        a.reasons.length > 0 &&
        a.reasons.every((r) => REASONS.has(String(r))) &&
        (a.locked_until === null || Number.isFinite(Date.parse(String(a.locked_until)))),
    ) ||
    Object.keys(flatKeys(v)).some((key) => FORBIDDEN.test(key))
  )
    throw new ApiError('protocol');
  return v as unknown as AdminOverview;
}

function flatKeys(value: unknown, out: Record<string, true> = {}): Record<string, true> {
  if (Array.isArray(value)) value.forEach((item) => flatKeys(item, out));
  else if (isObject(value))
    for (const [key, item] of Object.entries(value)) {
      out[key] = true;
      flatKeys(item, out);
    }
  return out;
}

export const reasonLabel: Record<AttentionItem['reasons'][number], string> = {
  locked: 'Đang bị khóa tạm',
  must_change_password: 'Chưa đổi mật khẩu lần đầu',
};
