import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import fixture from '../../test/fixtures/t16_what_if.json';
import { createQueryClient } from '../../api/query';
import { WorkspaceContext } from '../../app/context';
import { WorkspaceSession } from '../auth/session';
import type { Snapshot } from '../customers/customers';
import ChurnWatchPage from './ChurnWatchPage';
import { ChurnModelCard } from './ChurnModelCard';
import { checkedBatch, checkedPrediction, churnInput, recordedChurn } from './churnApi';
import { counts, pooled, profileLink, scoreLatest } from './watchlist';

const base = fixture.snapshot as unknown as Snapshot;
const prediction = (p: number) => ({
  task: 'churn',
  model_id: 'customer-churn-xgboost',
  model_version: '1.0.0-snapshot-churn',
  generated_at: '2026-11-13T00:00:00Z',
  churn_probability: p,
  risk_level: p >= 0.58 ? 'high' : p >= 0.13 ? 'medium' : 'low',
  predicted_churn: p >= 0.37,
  decision_threshold: 0.37,
  risk_thresholds: { low_below: 0.13, high_from: 0.58 },
  scope: 'snapshot_churn_status_not_time_to_churn',
});
const ids = ['a', 'b', 'c', 'd'].map((c) => `14000000-0000-4000-8000-00000000000${c}`);
const customers = ids.map((id, i) => ({ id, external_id: `KH-00${i + 1}` }));
const snap = (customerId: string, changes: Record<string, unknown> = {}) =>
  ({ ...base, id: `snap-${customerId}`, customer_id: customerId, ...changes }) as Snapshot;

describe('churn API helpers (K6)', () => {
  it('sends exactly the 21 model inputs and never the target or excluded fields', () => {
    const { customer, missing } = churnInput({ ...base, Age: null } as unknown as Snapshot);
    expect(Object.keys(customer)).toHaveLength(21);
    for (const field of [
      'Churned',
      'Lifetime_Value',
      'Total_Purchases',
      'Days_Since_Last_Purchase',
    ])
      expect(customer).not.toHaveProperty(field);
    expect(customer.Age).toBeNull();
    expect(missing).toEqual(['Age']);
    expect(recordedChurn({ ...base, Churned: true } as unknown as Snapshot)).toBe(true);
  });
  it('rejects responses that break the churn contract', () => {
    expect(checkedPrediction(prediction(0.4)).risk_level).toBe('medium');
    expect(() => checkedPrediction({ ...prediction(0.4), churn_probability: 1.4 })).toThrow();
    expect(() => checkedPrediction({ ...prediction(0.4), risk_level: 'severe' })).toThrow();
    expect(() => checkedBatch({ total: 2, results: [prediction(0.1)] }, 2)).toThrow();
  });
  it('ranks by probability, keeps recorded churn apart and batches at most 100', async () => {
    const latest = [
      { customer: customers[0]!, snapshot: snap(ids[0]!) },
      { customer: customers[1]!, snapshot: null },
      { customer: customers[2]!, snapshot: snap(ids[2]!, { Churned: true }) },
      { customer: customers[3]!, snapshot: snap(ids[3]!) },
    ];
    const batch = vi.fn(async (items: unknown[]) => ({
      total: items.length,
      results: [prediction(0.2), prediction(0.9)],
    }));
    const rows = await scoreLatest(latest, batch);
    expect(batch).toHaveBeenCalledTimes(1);
    expect(rows.map((r) => r.kind)).toEqual(['scored', 'scored', 'recorded', 'no-snapshot']);
    expect(rows[0]!.customer.id).toBe(ids[3]);
    expect(counts(rows)).toEqual({ low: 0, medium: 1, high: 1, recorded: 1, 'no-snapshot': 1 });
    const many = Array.from({ length: 230 }, () => ({
      customer: customers[0]!,
      snapshot: snap(ids[0]!),
    }));
    const sizes: number[] = [];
    await scoreLatest(many, async (items) => {
      sizes.push(items.length);
      return { total: items.length, results: items.map(() => prediction(0.5)) };
    });
    expect(sizes).toEqual([100, 100, 30]);
    await expect(
      scoreLatest([{ customer: customers[0]!, snapshot: snap(ids[1]!) }], batch),
    ).rejects.toThrow();
  });
  it('keeps order with bounded concurrency and links to the analysis profile', async () => {
    let active = 0;
    let peak = 0;
    const result = await pooled(
      [1, 2, 3, 4, 5, 6, 7, 8],
      async (n) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 1));
        active -= 1;
        return n * 2;
      },
      3,
    );
    expect(result).toEqual([2, 4, 6, 8, 10, 12, 14, 16]);
    expect(peak).toBeLessThanOrEqual(3);
    expect(profileLink('x', 's')).toBe('/customers/x/analysis?snapshot_id=s');
  });
});

const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

async function renderWith(node: React.ReactNode, unavailable = false) {
  const query = createQueryClient();
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://test.local');
    const path = url.pathname.replace('/backend', '');
    if (path === '/api/v1/model-info') return ok({ models: [], contract_version: '1.0.0' });
    if (path === '/api/v1/customers')
      return ok({ items: customers, total: customers.length, offset: 0, limit: 100 });
    const owner = /\/api\/v1\/customers\/([^/]+)\/behaviors/.exec(path)?.[1];
    if (owner) {
      const items =
        owner === ids[1] ? [] : [snap(owner, owner === ids[2] ? { Churned: true } : {})];
      return ok({ items, total: items.length, offset: 0, limit: 1 });
    }
    if (path === '/api/v1/churn/predict/batch') {
      if (unavailable)
        return ok(
          {
            error: {
              code: 'CHURN_MODEL_UNAVAILABLE',
              message: 'x',
              details: [],
              request_id: '00000000-0000-4000-8000-000000000000',
            },
          },
          503,
        );
      expect(init?.method).toBe('POST');
      const body = JSON.parse(String(init?.body)) as { customers: unknown[] };
      return ok({
        total: body.customers.length,
        results: body.customers.map((_, i) => prediction(i === 0 ? 0.08 : 0.81)),
      });
    }
    if (path === '/api/v1/churn/model')
      return ok({
        model_id: 'customer-churn-xgboost',
        model_version: '1.0.0-snapshot-churn',
        feature_policy: 'x',
        algorithm: 'XGBoost',
        available: true,
        unavailable_code: null,
        artifact_sha256: 'f'.repeat(64),
        feature_count: 21,
        features: [],
        excluded_features: ['Churned', 'Lifetime_Value', 'Total_Purchases'],
        decision_threshold: 0.37,
        risk_thresholds: { low_below: 0.13, high_from: 0.58 },
        holdout: {
          rows: 9992,
          churn_rate: 0.29,
          roc_auc: 0.8858,
          pr_auc: 0.82,
          f1: 0.7309,
          precision: 0.72,
          recall: 0.74,
          brier: 0.1,
          ece: 0.012,
          scored_at: '2026-11-13T00:00:00Z',
        },
        persistence_supported: false,
        max_batch_size: 100,
        limitations: [],
      });
    return ok({}, 404);
  });
  const session = new WorkspaceSession('/backend', () => query.clear(), fetcher);
  await session.connect('local', '');
  render(
    <QueryClientProvider client={query}>
      <WorkspaceContext.Provider value={session}>
        <MemoryRouter>{node}</MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
  return fetcher;
}

describe('ChurnWatchPage (K6)', () => {
  it('lists customers by churn risk with filters and profile links', async () => {
    const fetcher = await renderWith(<ChurnWatchPage />);
    const table = await screen.findByRole('region', { name: 'Khách hàng theo nguy cơ rời bỏ' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(2); // header + 1 high (medium filter on, low hidden)
    expect(within(rows[1]!).getByText('81%')).toBeInTheDocument();
    expect(within(rows[1]!).getByRole('link', { name: 'Xem hồ sơ' })).toHaveAttribute(
      'href',
      `/customers/${ids[3]}/analysis?snapshot_id=snap-${ids[3]}`,
    );
    const chips = screen.getByRole('group', { name: 'Lọc theo mức rủi ro' });
    fireEvent.click(within(chips).getByRole('button', { name: /Rủi ro Thấp/ }));
    fireEvent.click(within(chips).getByRole('button', { name: /Đã ghi nhận rời bỏ/ }));
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(within(table).getByText('Đã rời bỏ (ghi nhận)')).toBeInTheDocument();
    const batchCalls = fetcher.mock.calls.filter(([u]) => String(u).includes('/churn/'));
    expect(batchCalls).toHaveLength(1);
    expect(
      fetcher.mock.calls.every(
        ([u, init]) =>
          (init?.method ?? 'GET') === 'GET' || String(u).endsWith('/api/v1/churn/predict/batch'),
      ),
    ).toBe(true);
  });
  it('isolates an unavailable churn model', async () => {
    await renderWith(<ChurnWatchPage />, true);
    expect(await screen.findByText('Mô hình rời bỏ chưa sẵn sàng')).toBeInTheDocument();
  });
  it('shows the churn model card for the system page', async () => {
    await renderWith(<ChurnModelCard />);
    const card = await screen.findByRole('article', { name: 'Mô hình dự báo rời bỏ' });
    expect(await within(card).findByText(/ROC-AUC 0,886/)).toBeInTheDocument();
    expect(within(card).getByText('Khả dụng')).toBeInTheDocument();
  });
});
