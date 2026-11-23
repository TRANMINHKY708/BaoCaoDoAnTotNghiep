import { ApiError } from '../../api/errors';
import type { Snapshot } from '../customers/customers';
import type { RiskLevel } from './churn';
import {
  MAX_CHURN_BATCH,
  checkedBatch,
  churnInput,
  recordedChurn,
  type ChurnPrediction,
} from './churnApi';

/** The watchlist scores at most this many active customers (latest snapshot each). */
export const MAX_CUSTOMERS = 500;
const CONCURRENCY = 6;

export interface WatchCustomer {
  id: string;
  external_id: string;
}
export type WatchRow =
  | {
      kind: 'scored';
      customer: WatchCustomer;
      snapshot: Snapshot;
      prediction: ChurnPrediction;
      missing: number;
    }
  | { kind: 'recorded'; customer: WatchCustomer; snapshot: Snapshot }
  | { kind: 'no-snapshot'; customer: WatchCustomer };

export interface Watchlist {
  rows: WatchRow[];
  totalCustomers: number;
  truncated: boolean;
}

/** Run `task` over `items` with a small fixed concurrency, keeping input order. */
export async function pooled<T, R>(
  items: T[],
  task: (item: T) => Promise<R>,
  limit = CONCURRENCY,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Score the latest snapshot of each customer with the batch endpoint (chunks of 100) and sort by
 * churn probability, highest first. Snapshots that already record churn are kept apart and never
 * re-predicted; customers without a snapshot are listed last.
 */
export async function scoreLatest(
  latest: { customer: WatchCustomer; snapshot: Snapshot | null }[],
  batch: (customers: unknown[]) => Promise<unknown>,
): Promise<WatchRow[]> {
  const rows: WatchRow[] = [];
  const pending: {
    customer: WatchCustomer;
    snapshot: Snapshot;
    missing: number;
    input: unknown;
  }[] = [];
  for (const { customer, snapshot } of latest) {
    if (!snapshot) rows.push({ kind: 'no-snapshot', customer });
    else if (snapshot.customer_id !== customer.id) throw new ApiError('protocol');
    else if (recordedChurn(snapshot)) rows.push({ kind: 'recorded', customer, snapshot });
    else {
      const { customer: input, missing } = churnInput(snapshot);
      if (missing.length === 21) rows.push({ kind: 'no-snapshot', customer });
      else pending.push({ customer, snapshot, missing: missing.length, input });
    }
  }
  for (let start = 0; start < pending.length; start += MAX_CHURN_BATCH) {
    const chunk = pending.slice(start, start + MAX_CHURN_BATCH);
    const predictions = checkedBatch(await batch(chunk.map((item) => item.input)), chunk.length);
    chunk.forEach((item, i) =>
      rows.push({
        kind: 'scored',
        customer: item.customer,
        snapshot: item.snapshot,
        prediction: predictions[i]!,
        missing: item.missing,
      }),
    );
  }
  const order = { scored: 0, recorded: 1, 'no-snapshot': 2 } as const;
  return rows.sort((a, b) => {
    if (a.kind !== b.kind) return order[a.kind] - order[b.kind];
    if (a.kind === 'scored' && b.kind === 'scored')
      return b.prediction.churn_probability - a.prediction.churn_probability;
    return a.customer.external_id.localeCompare(b.customer.external_id);
  });
}

export function profileLink(customerId: string, snapshotId?: string) {
  const base = `/customers/${encodeURIComponent(customerId)}/analysis`;
  return snapshotId ? `${base}?snapshot_id=${encodeURIComponent(snapshotId)}` : base;
}

export function counts(rows: WatchRow[]) {
  const result: Record<RiskLevel | 'recorded' | 'no-snapshot', number> = {
    low: 0,
    medium: 0,
    high: 0,
    recorded: 0,
    'no-snapshot': 0,
  };
  for (const row of rows) result[row.kind === 'scored' ? row.prediction.risk_level : row.kind] += 1;
  return result;
}
