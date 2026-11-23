import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { InsightPanel } from './InsightPanel';
import { checkedInsights } from './insights';
import { ApiError } from '../../api/errors';
import { filterRequest, initialDraft } from './filters';
import type { BatchView } from './types';
import type { InsightEnvelope } from './insights';

const batchAnalyticsInsights = vi.fn();
let revision = 1;
vi.mock('../../app/context', () => ({
  useWorkspace: () => ({ revision, session: { client: { batchAnalyticsInsights } } }),
}));
const data: BatchView = {
  source: 'postgresql_f09_f10_saved_history',
  as_of: '2026-11-06T01:00:00Z',
  timezone: 'Asia/Ho_Chi_Minh',
  filters: filterRequest(initialDraft),
  fingerprint: 'a'.repeat(64),
  models: [],
  kpis: {},
  definitions: {},
  data_origins: [],
  cluster_distribution: [],
  purchase_distribution: [],
  cluster_profiles: [],
  overall_means: {},
  trend: [],
  trend_available: false,
  warnings: [],
  rows: [],
  total_rows: 0,
  offset: 0,
  limit: 50,
};
function response(
  view = data,
  feature: 'Login_Frequency' | 'Pages_Per_Session' = 'Login_Frequency',
): InsightEnvelope {
  return {
    contract_version: '1.0.0',
    rule_set_version: '1.0.0',
    precision_policy: 'significant-digits-12-v1',
    source: view.source,
    as_of: view.as_of,
    aggregate_fingerprint: view.fingerprint,
    filter_scope: view.filters,
    resolved_models: view.models,
    status: 'ready',
    evaluations: [],
    insights: [
      {
        insight_id: 'b'.repeat(64),
        rule_id: 'MEAN_PAIR',
        rule_version: '1.0.0',
        insight_type: 'derived_comparison',
        title: 'Tần suất đăng nhập',
        description: 'Nhóm 0: 10 lượt; nhóm 1: 20 lượt.',
        model_identity: null,
        feature_key: feature,
        unit: {
          kind: 'raw_source',
          label: 'lượt đăng nhập',
          verification_status: 'source_period_unknown',
        },
        observed_values: [],
        derived_values: [],
        sample_counts: [],
        evidence: [],
        limitations: [
          { code: 'DESCRIPTIVE_ONLY', description: 'Không chứng minh quan hệ nhân quả.' },
        ],
        navigation_target: {
          section: 'comparison',
          feature_key: feature,
          scope: 'same_applied_filters',
        },
      },
    ],
  };
}
const clients: QueryClient[] = [];
function open(view = data, selected: 'Login_Frequency' | 'Pages_Per_Session' = 'Login_Frequency') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const evidence = vi.fn();
  const tree = (v = view, f = selected) => (
    <QueryClientProvider client={client}>
      <InsightPanel data={v} applied={initialDraft} feature={f} onEvidence={evidence} />
    </QueryClientProvider>
  );
  return { ...render(tree()), tree, evidence };
}
afterEach(() => {
  cleanup();
  clients.forEach((c) => c.clear());
  clients.length = 0;
  vi.resetAllMocks();
  revision = 1;
});

it('uses applied scope and fingerprint; evidence does not mutate cluster or trigger writes', async () => {
  batchAnalyticsInsights.mockResolvedValue(response());
  const { evidence } = open();
  await screen.findByText('Nhóm 0: 10 lượt; nhóm 1: 20 lượt.');
  const args = batchAnalyticsInsights.mock.calls[0]!;
  expect(args.slice(0, 3)).toEqual([
    filterRequest(initialDraft),
    data.fingerprint,
    'Login_Frequency',
  ]);
  expect(args[3]).toBeInstanceOf(AbortSignal);
  fireEvent.click(screen.getByRole('button', { name: 'Xem bằng chứng' }));
  expect(evidence).toHaveBeenCalledWith({
    section: 'comparison',
    feature_key: 'Login_Frequency',
    scope: 'same_applied_filters',
  });
  expect(screen.getByText('Về nhận xét')).toBeInTheDocument();
  expect(batchAnalyticsInsights).toHaveBeenCalledTimes(1);
});
it('hides old insight while a new feature loads and aborts obsolete request', async () => {
  let finish!: (v: InsightEnvelope) => void;
  batchAnalyticsInsights
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce(response(data, 'Pages_Per_Session'));
  const { rerender, tree } = open();
  expect(screen.getByRole('status')).toBeInTheDocument();
  const signal = batchAnalyticsInsights.mock.calls[0]![3] as AbortSignal;
  rerender(tree(data, 'Pages_Per_Session'));
  await waitFor(() => expect(batchAnalyticsInsights).toHaveBeenCalledTimes(2));
  expect(signal.aborted).toBe(true);
  await act(async () => finish(response()));
  await screen.findByText('Nhóm 0: 10 lượt; nhóm 1: 20 lượt.');
  expect(batchAnalyticsInsights.mock.calls[1]![2]).toBe('Pages_Per_Session');
});
it('409 requests overview reload and does not reuse cached facts', async () => {
  batchAnalyticsInsights.mockRejectedValue(new ApiError('http', 409));
  open();
  await screen.findByText(/Dữ liệu đã thay đổi hoặc chưa nhất quán/);
  expect(screen.queryByRole('button', { name: 'Xem bằng chứng' })).not.toBeInTheDocument();
});
it('handles empty and network error separately', async () => {
  batchAnalyticsInsights.mockResolvedValue({
    ...response(),
    status: 'no_eligible_facts',
    insights: [],
  });
  const { rerender, tree } = open();
  await screen.findByText('Chưa có đủ dữ liệu để nhận xét.');
  batchAnalyticsInsights.mockRejectedValue(new ApiError('network'));
  revision++;
  rerender(tree());
  await screen.findByRole('alert');
  expect(screen.queryByText('Chưa có đủ dữ liệu để nhận xét.')).not.toBeInTheDocument();
});
it('invalidates on session/fingerprint and rejects mixed context responses', async () => {
  batchAnalyticsInsights.mockResolvedValue(response());
  const { rerender, tree } = open();
  await screen.findByText('Nhóm 0: 10 lượt; nhóm 1: 20 lượt.');
  revision++;
  const changed = { ...data, fingerprint: 'c'.repeat(64) };
  rerender(tree(changed));
  await screen.findByRole('alert');
  expect(screen.queryByText('Nhóm 0: 10 lượt; nhóm 1: 20 lượt.')).not.toBeInTheDocument();
  expect(() =>
    checkedInsights(
      { ...response(), filter_scope: { ...data.filters, cluster: 1 } },
      data,
      'Login_Frequency',
    ),
  ).toThrow();
  expect(() => checkedInsights(response(), data, 'Pages_Per_Session')).toThrow();
});
