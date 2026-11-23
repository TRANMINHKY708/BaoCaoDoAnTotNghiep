import { ApiError } from '../../api/errors';
import type { AuditPerson } from './audit';

/** K13 GET /api/v1/admin/sessions (Admin only). Hand-typed like other post-AUTH-03 endpoints. */
export interface ActiveSession {
  id: string;
  user: AuditPerson;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  current: boolean;
}
export interface ActiveSessions {
  items: ActiveSession[];
  truncated: boolean;
  generated_at: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const instant = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const SESSION_KEYS = ['id', 'user', 'created_at', 'last_seen_at', 'expires_at', 'current'];

/** Exactly the documented fields: anything extra (a token, a hash) is a protocol error. */
export function checkedSessions(value: unknown): ActiveSessions {
  if (
    !isObject(value) ||
    !Array.isArray(value.items) ||
    typeof value.truncated !== 'boolean' ||
    !instant(value.generated_at) ||
    Object.keys(value).length !== 3
  )
    throw new ApiError('protocol');
  let current = 0;
  for (const item of value.items) {
    const user = isObject(item) ? item.user : null;
    if (
      !isObject(item) ||
      Object.keys(item).length !== SESSION_KEYS.length ||
      !SESSION_KEYS.every((k) => k in item) ||
      typeof item.id !== 'string' ||
      !UUID.test(item.id) ||
      !isObject(user) ||
      typeof user.id !== 'string' ||
      typeof user.username !== 'string' ||
      typeof user.display_name !== 'string' ||
      !['ADMIN', 'OPERATOR', 'VIEWER'].includes(String(user.role)) ||
      !instant(item.created_at) ||
      !instant(item.last_seen_at) ||
      !instant(item.expires_at) ||
      typeof item.current !== 'boolean'
    )
      throw new ApiError('protocol');
    if (item.current) current += 1;
  }
  if (current > 1) throw new ApiError('protocol');
  return value as unknown as ActiveSessions;
}
