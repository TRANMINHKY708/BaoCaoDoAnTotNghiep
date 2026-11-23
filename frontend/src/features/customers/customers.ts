import { vietnamDateTime } from '../../utils/time';
import type { components } from '../../api/generated';

export type Customer = components['schemas']['CustomerRead'];
export type CustomerPage = components['schemas']['CustomerPage'];
export type Snapshot = components['schemas']['BehaviorSnapshotRead'];
export type PurchaseHistory = components['schemas']['PredictionHistoryV1'];
export type SegmentHistory = components['schemas']['SegmentHistoryV1'];
export type CustomerTab = 'behaviors' | 'predictions' | 'segments';

export function listFilters(params: URLSearchParams) {
  const integer = (key: string, fallback: number, max: number) => {
    const raw = params.get(key);
    return raw && /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) && Number(raw) <= max
      ? Number(raw)
      : fallback;
  };
  return {
    q: (params.get('q') ?? '').slice(0, 100),
    offset: integer('offset', 0, 1_000_000_000),
    limit: Math.max(1, integer('limit', 20, 100)),
    include_inactive: params.get('include_inactive') === 'true',
    sort: params.get('sort') === 'external_id' ? ('external_id' as const) : ('created_at' as const),
    direction: params.get('direction') === 'asc' ? ('asc' as const) : ('desc' as const),
  };
}

export function detailFilters(params: URLSearchParams, predictionPath = false) {
  const tab: CustomerTab =
    (predictionPath && !params.has('tab')) || params.get('tab') === 'predictions'
      ? 'predictions'
      : params.get('tab') === 'segments'
        ? 'segments'
        : 'behaviors';
  return {
    tab,
    offset: listFilters(params).offset,
    limit: listFilters(params).limit,
    model_version: (params.get('model_version') ?? '').slice(0, 50),
  };
}

export const isCustomerId = (id: string) =>
  /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);
// Strong validators are opaque: never build an ETag from timestamps or use '*'.
export const isStrongEtag = (tag: string | null): tag is string =>
  tag !== null && /^"[\x21\x23-\x7e\x80-\xff]+"$/.test(tag) && tag.length <= 2048;
export const dateTime = vietnamDateTime;
export const number = (n: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 10 }).format(n);
export const probability = (n: number) =>
  Number.isFinite(n) && n >= 0 && n <= 1
    ? new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 2 }).format(n)
    : 'Giá trị không hợp lệ';
export const externalIdError = (value: string) =>
  !value.trim()
    ? 'Nhập mã khách hàng, không chỉ gồm khoảng trắng.'
    : [...value].length > 100
      ? 'Mã khách hàng tối đa 100 ký tự.'
      : '';
