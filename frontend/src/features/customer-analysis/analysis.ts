import { ApiError } from '../../api/errors';
import type { PurchaseHistory, SegmentHistory, Snapshot } from '../customers/customers';
import type { components } from '../../api/generated';
export type Scenario = components['schemas']['WhatIfHistorySummary'];
export type Entry =
  | { kind: 'predictions'; item: PurchaseHistory }
  | { kind: 'segments'; item: SegmentHistory }
  | { kind: 'what-if'; item: Scenario };
export class HistoryLimitError extends Error {}
export async function allPages<T>(
  load: (offset: number) => Promise<{ items: T[]; total: number; offset: number }>,
  owner: (item: T) => boolean,
  id: (item: T) => string,
): Promise<T[]> {
  const result: T[] = [];
  const ids = new Set<string>();
  let total: number | undefined;
  do {
    const page = await load(result.length);
    if (
      !Number.isSafeInteger(page.total) ||
      page.total < 0 ||
      page.offset !== result.length ||
      !Array.isArray(page.items)
    )
      throw new ApiError('protocol');
    if (page.total > 1000)
      throw new HistoryLimitError(
        'Nguồn dữ liệu có hơn 1.000 bản ghi. Hãy dùng trang chi tiết khách hàng để xem phân trang từng nguồn; hồ sơ này chưa tổng hợp một phần thành toàn bộ.',
      );
    if (total !== undefined && page.total !== total)
      throw new HistoryLimitError(
        'Lịch sử thay đổi trong khi tải. Hãy tải lại để tổng hợp đầy đủ.',
      );
    total = page.total;
    for (const item of page.items) {
      const key = id(item);
      if (!owner(item) || !key || ids.has(key)) throw new ApiError('protocol');
      ids.add(key);
      result.push(item);
    }
    if (result.length > total || (!page.items.length && result.length < total))
      throw new ApiError('protocol');
  } while (result.length < total!);
  return result;
}
export function timeline(
  predictions: PurchaseHistory[],
  segments: SegmentHistory[],
  scenarios: Scenario[],
  kind: string,
  direction: 'asc' | 'desc',
): Entry[] {
  const rows: Entry[] = [
    ...predictions.map((item) => ({ kind: 'predictions' as const, item })),
    ...segments.map((item) => ({ kind: 'segments' as const, item })),
    ...scenarios.map((item) => ({ kind: 'what-if' as const, item })),
  ];
  if (rows.some((row) => !Number.isFinite(Date.parse(row.item.created_at))))
    throw new ApiError('protocol');
  return rows
    .filter((row) => kind === 'all' || row.kind === kind)
    .sort((a, b) => {
      const difference = Date.parse(a.item.created_at) - Date.parse(b.item.created_at);
      const aid = a.kind + ('id' in a.item ? a.item.id : a.item.scenario_id),
        bid = b.kind + ('id' in b.item ? b.item.id : b.item.scenario_id);
      return (difference || aid.localeCompare(bid)) * (direction === 'asc' ? 1 : -1);
    });
}
export function analysisLink(path: string, customerId: string, snapshotId?: string) {
  return `${path}?customer_id=${encodeURIComponent(customerId)}${snapshotId ? `&snapshot_id=${encodeURIComponent(snapshotId)}` : ''}`;
}
export type AnalysisData = {
  snapshots: Snapshot[];
  predictions: PurchaseHistory[];
  segments: SegmentHistory[];
  scenarios: Scenario[];
};
