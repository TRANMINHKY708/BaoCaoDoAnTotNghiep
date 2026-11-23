import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { components } from '../../api/generated';
import { createQueryClient } from '../../api/query';
import { WorkspaceContext } from '../../app/context';
import { WorkspaceSession } from '../auth/session';
import ModelsPage from './ModelsPage';
import { checkedUsage, evaluationFor, featureDiff } from './models';

type Model = components['schemas']['ModelInfo'];
const base = (
  task: 'classification' | 'segmentation',
  version: string,
  def: boolean,
  features: string[],
): Model => ({
  task,
  model_id: task === 'classification' ? 'purchase-level-xgboost' : 'customer-segmentation-kmeans',
  model_version: version,
  is_default: def,
  serving_mode: def ? 'legacy_default' : 'explicit_research',
  available: true,
  persistence_supported: def,
  artifact_sha256: (def ? 'a' : 'b').repeat(64),
  feature_count: features.length,
  features,
  input_schema: {},
  label_namespace: 'purchase_level',
  labels: { '0': 'Low', '1': 'Medium', '2': 'High' },
  limitations: ['TEST limitation'],
});
const catalog = [
  base('classification', '1.0.0', true, ['Age', 'Lifetime_Value', 'Churned']),
  base('classification', '2.0.0-snapshot-conservative12', false, ['Age', 'Login_Frequency']),
  base('segmentation', '1.0.0', true, ['Login_Frequency', 'Total_Purchases']),
  base('segmentation', '2.0.0-snapshot-k3', false, ['Login_Frequency', 'Total_Purchases']),
];
const usage = (model_id: string, runs: number, results: number, sha = 'a'.repeat(64)) => ({
  model_id,
  model_version: '1.0.0',
  task: model_id.startsWith('purchase') ? 'classification' : 'segmentation',
  algorithm: 'X',
  artifact_sha256: sha,
  registered_at: '2026-10-13T00:00:00Z',
  runs_total: runs,
  runs_completed: runs,
  runs_by_type: { single: runs - 1, batch: 1, csv: 0, scenario: 0 },
  results_saved: results,
  customers: 13,
  last_used_at: '2026-11-05T06:38:02Z',
});
const churn = {
  model_id: 'customer-churn-xgboost',
  model_version: '1.0.0-snapshot-churn',
  feature_policy: 'x',
  algorithm: 'XGBoost',
  available: true,
  unavailable_code: null,
  artifact_sha256: 'c'.repeat(64),
  feature_count: 21,
  features: ['Age'],
  excluded_features: ['Churned'],
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
  limitations: ['TEST churn limitation'],
};
const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

async function setup({ usageStatus = 200, sha = 'a'.repeat(64) } = {}) {
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    const path = new URL(String(input), 'http://t').pathname;
    if (path.endsWith('/model-info')) return ok({ contract_version: '1.0.0', models: catalog });
    if (path.endsWith('/models/usage'))
      return usageStatus === 200
        ? ok({
            generated_at: '2026-11-14T00:00:00Z',
            models: [
              usage('purchase-level-xgboost', 6, 15, sha),
              usage('customer-segmentation-kmeans', 8, 17),
            ],
            scope: 'x',
          })
        : ok(
            {
              error: {
                code: 'DATABASE_UNAVAILABLE',
                message: 'x',
                details: [],
                request_id: '00000000-0000-4000-8000-000000000000',
              },
            },
            503,
          );
    if (path.endsWith('/churn/model')) return ok(churn);
    return ok({}, 404);
  });
  const query = createQueryClient();
  const session = new WorkspaceSession('/backend', () => query.clear(), fetcher);
  await session.connect('local', '');
  render(
    <QueryClientProvider client={query}>
      <WorkspaceContext.Provider value={session}>
        <MemoryRouter>
          <ModelsPage />
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
  return fetcher;
}

describe('model helpers (K9)', () => {
  it('quotes clean evaluations only for the locked research versions', () => {
    expect(evaluationFor('classification', '2.0.0-snapshot-conservative12').clean).toBe(true);
    expect(evaluationFor('classification', '2.0.0-snapshot-conservative12').lines[0]).toContain(
      '0,703',
    );
    expect(evaluationFor('segmentation', '2.0.0-snapshot-k3').lines[0]).toContain('K = 3');
    expect(evaluationFor('classification', '1.0.0').clean).toBe(false);
    expect(featureDiff(['a', 'b'], ['b', 'c'])).toEqual({
      onlyA: ['a'],
      onlyB: ['c'],
      shared: ['b'],
    });
    expect(() => checkedUsage({ models: [{ ...usage('x', 2, 1), runs_completed: 3 }] })).toThrow();
  });
});

describe('ModelsPage (K9)', () => {
  it('shows the four catalog models plus churn with usage, evaluation and comparison', async () => {
    const fetcher = await setup();
    const grid = await screen.findByRole('region', { name: 'Danh sách mô hình' });
    expect(within(grid).getAllByRole('article')).toHaveLength(5);
    const full = within(grid).getByRole('article', { name: 'Mức mua · bản đầy đủ' });
    expect(await within(full).findByText('15')).toBeInTheDocument();
    expect(within(full).getByText('Mặc định · có lưu kết quả')).toBeInTheDocument();
    expect(within(full).getByText('Chưa đánh giá sạch')).toBeInTheDocument();
    const selected = within(grid).getByRole('article', { name: 'Mức mua · bản chọn lọc' });
    expect(within(selected).getByText(/Macro F1 0,703/)).toBeInTheDocument();
    expect(within(selected).getByText(/Chỉ suy luận, không lưu/)).toBeInTheDocument();
    const churnCard = within(grid).getByRole('article', { name: 'Dự báo rời bỏ · XGBoost' });
    expect(await within(churnCard).findByText(/ROC-AUC 0,886/)).toBeInTheDocument();
    const compare = screen.getByRole('region', { name: 'So sánh phiên bản' });
    expect(within(compare).getAllByRole('row')).toHaveLength(3);
    expect(within(compare).getByText(/Lifetime_Value|Churned/)).toBeInTheDocument();
    expect(fetcher.mock.calls.every(([, init]) => (init?.method ?? 'GET') === 'GET')).toBe(true);
  });
  it('keeps the catalog when usage is unavailable and flags a checksum mismatch', async () => {
    await setup({ usageStatus: 503 });
    expect(await screen.findByText(/Chưa đọc được số liệu sử dụng/)).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(5);
  });
  it('warns when the registered checksum differs from the loaded artifact', async () => {
    await setup({ sha: 'f'.repeat(64) });
    const full = await screen.findByRole('article', { name: 'Mức mua · bản đầy đủ' });
    expect(await within(full).findByRole('alert')).toHaveTextContent(
      /Mã băm trong cơ sở dữ liệu khác/,
    );
  });
});
