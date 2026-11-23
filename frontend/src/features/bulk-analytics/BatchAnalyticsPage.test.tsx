import { act, fireEvent, render, screen, waitFor, cleanup, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Link,
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import BatchAnalyticsPage from './BatchAnalyticsPage';
import { filterRequest, initialDraft } from './filters';
import type { BatchOptions, BatchView } from './types';
import { ApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import { safeDestination } from '../auth/accounts';
import { filterLocation, returnToBatch } from './navigation';

const batchAnalytics = vi.fn(),
  batchAnalyticsInsights = vi.fn(),
  batchAnalyticsOptions = vi.fn(),
  batchAnalyticsNarrative = vi.fn(),
  requestReport = vi.fn(),
  downloadBlob = vi.fn();
let allowed = true,
  revision = 1;
vi.mock('../../app/context', () => ({
  useWorkspace: () => ({
    status: 'connected',
    revision,
    hasCapability: () => allowed,
    session: {
      accountMode: true,
      client: {
        batchAnalytics,
        batchAnalyticsOptions,
        batchAnalyticsNarrative,
        batchAnalyticsInsights,
        requestReport,
        listImports: async () => ({ items: [] }),
      },
    },
  }),
}));
vi.mock('../predictions/csv', () => ({
  downloadBlob: (...args: unknown[]) => downloadBlob(...args),
}));

const cls = {
  task: 'classification',
  model_version: '1.0.0',
  artifact_sha256: 'a'.repeat(64),
  metadata_sha256: 'b'.repeat(64),
};
const source = '11111111-1111-4111-8111-111111111111';
const seg = { ...cls, task: 'segmentation' };
const options: BatchOptions = {
  scope: 'shared_workspace_read_only',
  imports: [{ job_id: source, created_at: '2026-11-05T00:00:00Z', filename: 'store.csv' }],
  analyses: [],
  models: [
    cls,
    { ...cls, task: 'segmentation' },
    { ...cls, model_version: '2.0.0-snapshot-conservative12', artifact_sha256: 'c'.repeat(64) },
  ],
  truncated: { imports: false, analyses: false, models: false },
  limit: 100,
};
const data: BatchView = {
  source: 'postgresql_f09_f10_saved_history',
  as_of: '2026-11-05T00:00:00Z',
  timezone: 'Asia/Ho_Chi_Minh',
  filters: filterRequest(initialDraft),
  fingerprint: 'a'.repeat(64),
  kpis: {
    customers: 3,
    snapshots: 3,
    import_jobs: 2,
    analysis_jobs: 4,
    analyzed_customers: 3,
    stored_results: 6,
    successful_items: 12,
    preview_success_items: 0,
    failed_items: 0,
    skipped_items: 0,
    queued_items: 0,
    failed_jobs: 0,
  },
  definitions: { customers: 'Khách hàng duy nhất trong phạm vi lọc.' },
  models: [cls, seg],
  data_origins: ['store-fixture'],
  purchase_distribution: [{ label: 'Low', count: 3, share_percent: 100 }],
  cluster_distribution: [
    { cluster: 1, segment_name: 'Tên theo mô hình', count: 3, share_percent: 100 },
  ],
  cluster_profiles: [
    { cluster: 1, records: 3, status: 'available', means: { Login_Frequency: 47.25 } },
  ],
  overall_means: { Login_Frequency: 47.25 },
  trend: [],
  trend_available: false,
  warnings: ['Không chứng minh nhân quả hoặc dự báo giao dịch tương lai.'],
  total_rows: 6,
  offset: 0,
  limit: 50,
  rows: [
    {
      ...cls,
      item_id: 'row-1',
      customer_id: source,
      snapshot_id: '22222222-2222-4222-8222-222222222222',
      external_id: 'bulk:' + 'a'.repeat(64),
      captured_at: '2026-11-04T00:00:00Z',
      analysis_job_id: source,
      import_job_id: source,
      analysis_created_at: '2026-11-05T00:00:00Z',
      result_created_at: '2026-11-05T00:00:00Z',
      item_status: 'success',
      error_code: null,
      purchase_level: 'Low',
      cluster: null,
      segment_name: null,
      distance_to_centroid: null,
      reference_count: 2,
      saved: true,
      probabilities: { Low: 0.8, Medium: 0.15, High: 0.05 },
    },
  ],
};
const clients: QueryClient[] = [];
function Controls() {
  const navigate = useNavigate(),
    location = useLocation();
  return (
    <>
      <button onClick={() => navigate(-1)}>Back kiểm thử</button>
      <button onClick={() => navigate(1)}>Forward kiểm thử</button>
      <output aria-label="URL hiện tại">{location.pathname + location.search}</output>
    </>
  );
}
function ProfileReturn() {
  const [params] = useSearchParams(),
    location = useLocation();
  const back = returnToBatch(params, location.state);
  return (
    <>
      <h1>Hồ sơ kiểm thử</h1>
      <p>{params.get('snapshot_id')}</p>
      {back && (
        <Link to={back.to} state={back.state}>
          Về phân tích hàng loạt
        </Link>
      )}
    </>
  );
}
function open(route = '/batch-analytics', state?: unknown) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[
          {
            pathname: route.split('?')[0],
            search: route.includes('?') ? '?' + route.split('?').slice(1).join('?') : '',
            state,
          },
        ]}
      >
        <Controls />
        <Routes>
          <Route path="batch-analytics" element={<BatchAnalyticsPage />} />
          <Route path="customers/:customerId/analysis" element={<ProfileReturn />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  allowed = true;
  revision = 1;
  batchAnalyticsOptions.mockResolvedValue(options);
  batchAnalytics.mockImplementation(async (filters, offset) => ({ ...data, filters, offset }));
  batchAnalyticsInsights.mockImplementation(async (filters, fingerprint) => ({
    contract_version: '1.0.0',
    rule_set_version: '1.0.0',
    precision_policy: 'significant-digits-12-v1',
    source: data.source,
    as_of: data.as_of,
    aggregate_fingerprint: fingerprint,
    filter_scope: filters,
    resolved_models: data.models,
    status: 'no_eligible_facts',
    insights: [],
    evaluations: [],
  }));
  requestReport.mockResolvedValue({
    blob: new Blob(['file']),
    filename: 'MK-eAI-phan-tich-lo-20261105.xlsx',
  });
  batchAnalyticsNarrative.mockResolvedValue({
    source: 'verified_batch_aggregates',
    result_fingerprint: data.fingerprint,
    generated_at: data.as_of,
    history_persisted: false,
    narrative: {
      overview: 'Nhận xét tổng hợp đã xác minh.',
      notable_factors: [],
      interpretation: 'Mô tả snapshot.',
      limitations: ['Không nhân quả.'],
      reference_suggestions: [],
    },
  });
});
afterEach(() => {
  cleanup();
  clients.forEach((c) => c.clear());
  clients.length = 0;
});

it('R1-06B shares the comparison feature, keeps primary evidence scope and uses only applied filters', async () => {
  batchAnalytics.mockImplementation(async (filters, offset) => ({
    ...data,
    filters,
    offset,
    cluster_profiles: data.cluster_profiles.map((p) => ({
      ...p,
      means: { ...p.means, Pages_Per_Session: 3 },
    })),
    overall_means: { ...data.overall_means, Pages_Per_Session: 3 },
  }));
  batchAnalyticsInsights.mockImplementation(async (filters, fingerprint, feature) => ({
    contract_version: '1.0.0',
    rule_set_version: '1.0.0',
    precision_policy: 'significant-digits-12-v1',
    source: data.source,
    as_of: data.as_of,
    aggregate_fingerprint: fingerprint,
    filter_scope: filters,
    resolved_models: data.models,
    status: 'ready',
    evaluations: [],
    insights: [
      {
        insight_id: 'test',
        rule_id: 'MEAN_PAIR',
        rule_version: '1.0.0',
        insight_type: 'derived_comparison',
        title: 'So sánh',
        description: `Bằng chứng cho ${feature}`,
        model_identity: seg,
        feature_key: feature,
        unit: null,
        observed_values: [],
        derived_values: [],
        sample_counts: [],
        evidence: [],
        limitations: [],
        navigation_target: {
          section: 'comparison',
          feature_key: feature,
          scope: 'same_applied_filters',
        },
      },
    ],
  }));
  const scroll = vi.fn();
  const previous = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = scroll;
  try {
    open();
    await screen.findByText('Bằng chứng cho Login_Frequency');
    const url = screen.getByLabelText('URL hiện tại').textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Xem bằng chứng' }));
    expect(document.activeElement?.id).toBe('batch-evidence-comparison');
    expect(scroll).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('URL hiện tại').textContent).toBe(url);
    expect(batchAnalyticsInsights.mock.lastCall?.[0].cluster).toBeNull();
    fireEvent.change(screen.getByLabelText('Đặc điểm cần xem'), {
      target: { value: 'Pages_Per_Session' },
    });
    await screen.findByText('Bằng chứng cho Pages_Per_Session');
    const count = batchAnalyticsInsights.mock.calls.length;
    fireEvent.change(screen.getByLabelText('Mức mua'), { target: { value: 'Low' } });
    expect(screen.queryByText('Bằng chứng cho Pages_Per_Session')).not.toBeInTheDocument();
    expect(batchAnalyticsInsights).toHaveBeenCalledTimes(count);
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng bộ lọc' }));
    await waitFor(() =>
      expect(batchAnalyticsInsights.mock.lastCall?.[0].purchase_level).toBe('Low'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back kiểm thử' }));
    await waitFor(() =>
      expect(batchAnalyticsInsights.mock.lastCall?.[0].purchase_level).toBeNull(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Forward kiểm thử' }));
    await waitFor(() =>
      expect(batchAnalyticsInsights.mock.lastCall?.[0].purchase_level).toBe('Low'),
    );
    expect(batchAnalyticsNarrative).not.toHaveBeenCalled();
    expect(requestReport).not.toHaveBeenCalled();
  } finally {
    HTMLElement.prototype.scrollIntoView = previous;
  }
});

it('renders real response counts, distributions, source and F03 link without auto Gemini/export', async () => {
  open();
  await screen.findByText('Kết quả có thể truy vết');
  expect(screen.getByText('Khách hàng duy nhất').closest('article')).toHaveTextContent('3');
  expect(screen.getByRole('progressbar', { name: 'Low' })).toHaveAttribute('value', '100');
  expect(
    screen.getByText('Tần suất đăng nhập', { selector: 'td' }).closest('tr'),
  ).toHaveTextContent('47,25');
  expect(screen.getByText(/Nguồn khai báo khi nhập:/)).toHaveTextContent('store-fixture');
  expect(screen.getByRole('link', { name: /^KH-/ })).toHaveAttribute(
    'href',
    `/customers/${source}/analysis?snapshot_id=${data.rows[0]!.snapshot_id}&batch_filters=`,
  );
  expect(batchAnalyticsNarrative).not.toHaveBeenCalled();
  expect(requestReport).not.toHaveBeenCalled();
});
it('applies one backend filter set and exports all matching rows rather than current page', async () => {
  open();
  await screen.findByText('Kết quả có thể truy vết');
  fireEvent.change(screen.getByLabelText('Mức mua'), { target: { value: 'Low' } });
  fireEvent.change(screen.getByLabelText('Nhóm khách hàng'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Áp dụng bộ lọc' }));
  await waitFor(() => expect(batchAnalytics.mock.lastCall?.[0].cluster).toBe(1));
  await screen.findByText('Kết quả có thể truy vết');
  fireEvent.click(screen.getByRole('button', { name: 'Xuất Excel' }));
  await waitFor(() => expect(requestReport).toHaveBeenCalledOnce());
  expect(requestReport.mock.calls[0]![0]).toEqual({
    source: 'batch_analytics',
    format: 'xlsx',
    filters: expect.objectContaining({ purchase_level: 'Low', cluster: 1 }),
    fingerprint: data.fingerprint,
  });
  expect(requestReport.mock.calls[0]![0]).not.toHaveProperty('offset');
  expect(downloadBlob).toHaveBeenCalledOnce();
});
it('clears AI on draft/model changes and locks stale exports until filters are applied', async () => {
  open();
  await screen.findByText('Kết quả có thể truy vết');
  fireEvent.click(screen.getByRole('button', { name: 'AI nhận xét tổng hợp' }));
  await screen.findByText('Nhận xét tổng hợp đã xác minh.');
  fireEvent.change(screen.getByLabelText('Mô hình mức mua'), {
    target: { value: `2.0.0-snapshot-conservative12|${'c'.repeat(64)}|${'b'.repeat(64)}` },
  });
  expect(screen.queryByText('Nhận xét tổng hợp đã xác minh.')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Xuất PDF' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'AI nhận xét tổng hợp' })).toBeDisabled();
  expect(batchAnalyticsNarrative).toHaveBeenCalledOnce();
});
it('paginates in the API instead of slicing a downloaded customer dataset', async () => {
  batchAnalytics.mockImplementation(async (filters, offset) => ({
    ...data,
    filters,
    offset,
    total_rows: 100,
  }));
  open();
  await screen.findByText('Kết quả có thể truy vết');
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  await waitFor(() => expect(batchAnalytics.mock.lastCall?.[1]).toBe(50));
});
it('shows genuine empty history and keeps AI disabled when there are no saved results', async () => {
  batchAnalytics.mockResolvedValue({
    ...data,
    kpis: { ...data.kpis, analysis_jobs: 0, stored_results: 0 },
    rows: [],
    total_rows: 0,
  });
  open();
  await screen.findByText('Chưa có dữ liệu trong phạm vi này');
  expect(screen.getByRole('button', { name: 'AI nhận xét tổng hợp' })).toBeDisabled();
});
it('does not replace a query error with zero KPI cards', async () => {
  batchAnalytics.mockRejectedValue(new ApiError('network'));
  open();
  await screen.findByRole('alert');
  expect(screen.queryByText('Khách hàng duy nhất')).not.toBeInTheDocument();
});
it('shows loading and does not call any action while awaiting data', async () => {
  batchAnalytics.mockImplementation(() => new Promise(() => {}));
  open();
  await screen.findByText('Đang tổng hợp dữ liệu theo bộ lọc…');
  expect(screen.queryByRole('button', { name: 'Xuất PDF' })).not.toBeInTheDocument();
  expect(batchAnalyticsNarrative).not.toHaveBeenCalled();
});
it('requires accounts read capabilities before querying workspace data', () => {
  allowed = false;
  open();
  expect(screen.getByText('Cần đăng nhập workspace')).toBeInTheDocument();
  expect(batchAnalytics).not.toHaveBeenCalled();
});
it('handles a changed-data conflict without retrying export automatically', async () => {
  requestReport.mockRejectedValue(new ApiError('http', 409, { code: 'BATCH_ANALYTICS_CHANGED' }));
  open();
  await screen.findByText('Kết quả có thể truy vết');
  fireEvent.click(screen.getByRole('button', { name: 'Xuất PDF' }));
  await screen.findByText(/Dữ liệu có thể đã thay đổi/);
  expect(requestReport).toHaveBeenCalledOnce();
  expect(downloadBlob).not.toHaveBeenCalled();
});
it('cancels in-flight AI when session changes', async () => {
  batchAnalyticsNarrative.mockImplementation(() => new Promise(() => {}));
  const view = open();
  await screen.findByText('Kết quả có thể truy vết');
  fireEvent.click(screen.getByRole('button', { name: 'AI nhận xét tổng hợp' }));
  await waitFor(() => expect(batchAnalyticsNarrative).toHaveBeenCalled());
  const signal = batchAnalyticsNarrative.mock.calls[0]![1] as AbortSignal;
  revision = 2;
  view.rerender(
    <QueryClientProvider client={clients[0]!}>
      <MemoryRouter>
        <BatchAnalyticsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(signal.aborted).toBe(true);
});
it('converts whole Vietnamese calendar days to an exclusive UTC interval', () => {
  const filters = filterRequest({
    ...initialDraft,
    date_from: '2026-11-05',
    date_to: '2026-11-05',
  });
  expect(filters.date_from).toBe('2026-11-04T17:00:00.000Z');
  expect(filters.date_to).toBe('2026-11-05T17:00:00.000Z');
  expect(() => filterRequest({ ...initialDraft, date_from: '2026-11-05' })).toThrow();
  expect(safeDestination('/batch-analytics')).toBe('/batch-analytics');
});
it('reuses the authenticated download transport while preserving the F06 endpoint', async () => {
  const fetcher = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(new Blob(['file']), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="MK-eAI-phan-tich-lo-20261105.pdf"',
          'X-Security-Profile': 'accounts',
        },
      }),
    ),
  );
  const client = new ApiClient(
    'http://127.0.0.1:8000',
    () => null,
    () => {},
    fetcher,
    { credentials: 'include', getNonce: () => 'c'.repeat(43), getRevision: () => 1 },
  );
  await client.requestReport({
    source: 'batch_analytics',
    format: 'pdf',
    filters: data.filters,
    fingerprint: data.fingerprint,
  });
  expect(fetcher.mock.calls[0]![0]).toBe('http://127.0.0.1:8000/api/v1/bulk/analytics/export');
  expect(new Headers(fetcher.mock.calls[0]![1].headers).get('X-CSRF-Token')).toBe('c'.repeat(43));
  await client.requestReport({ source: 'customer', customer_id: source, format: 'pdf' });
  expect(fetcher.mock.calls[1]![0]).toBe('http://127.0.0.1:8000/api/v1/reports/export');
});

it('drills into the exact response model while retaining jobs, dates, customer and purchase level', async () => {
  const draft = {
    ...initialDraft,
    import_job_id: source,
    analysis_job_id: source,
    purchase_level: 'Low',
    customer_query: source,
    date_from: '2026-11-01',
    date_to: '2026-11-05',
  };
  const location = filterLocation(draft, 50);
  open('/batch-analytics?' + location.search);
  await screen.findByText('Kết quả có thể truy vết');
  fireEvent.click(screen.getByRole('button', { name: 'Xem danh sách' }));
  await waitFor(() =>
    expect(batchAnalytics.mock.lastCall?.[0]).toMatchObject({
      import_job_id: source,
      analysis_job_id: source,
      customer_query: source,
      purchase_level: 'Low',
      date_from: '2026-10-31T17:00:00.000Z',
      date_to: '2026-11-05T17:00:00.000Z',
      segmentation_version: '1.0.0',
      segmentation_artifact: seg.artifact_sha256,
      segmentation_metadata: seg.metadata_sha256,
      cluster: 1,
    }),
  );
  expect(batchAnalytics.mock.lastCall?.[1]).toBe(0);
  expect(await screen.findByRole('button', { name: 'Xem danh sách' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ lọc nhóm' }));
  await waitFor(() => expect(batchAnalytics.mock.lastCall?.[0].cluster).toBeNull());
  expect(batchAnalytics.mock.lastCall?.[0].purchase_level).toBe('Low');
  expect(requestReport).not.toHaveBeenCalled();
  expect(batchAnalyticsNarrative).not.toHaveBeenCalled();
});
it.each([
  { models: [] },
  { models: [seg, { ...seg, artifact_sha256: 'c'.repeat(64) }] },
  { models: [{ ...seg, model_version: '2.0.0-snapshot-k3' }] },
])(
  'does not expose a combined cluster or drill-down for missing/incompatible model scope: %j',
  async ({ models }) => {
    batchAnalytics.mockImplementation(async (filters, offset) => ({
      ...data,
      filters,
      offset,
      models,
    }));
    open();
    await screen.findByText(
      'Thiếu hoặc không tương thích danh tính mô hình phân nhóm; chưa thể mở chi tiết cluster an toàn.',
    );
    expect(screen.queryByRole('button', { name: 'Xem danh sách' })).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { name: /Nhóm 1/ })).not.toBeInTheDocument();
  },
);
it('restores valid URL filters and pagination, then supports back/forward without resetting the model', async () => {
  const draft = {
    ...initialDraft,
    cluster: '1',
    purchase_level: 'Medium',
    segmentation_model: `1.0.0|${seg.artifact_sha256}|${seg.metadata_sha256}`,
  };
  batchAnalytics.mockImplementation(async (filters, offset) => ({
    ...data,
    filters,
    offset,
    total_rows: 200,
  }));
  open('/batch-analytics?' + filterLocation(draft, 50).search);
  await screen.findByText('Kết quả có thể truy vết');
  expect(screen.getByLabelText('Nhóm khách hàng')).toHaveValue('1');
  expect(batchAnalytics.mock.lastCall?.[1]).toBe(50);
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  await waitFor(() => expect(batchAnalytics.mock.lastCall?.[1]).toBe(100));
  fireEvent.click(screen.getByRole('button', { name: 'Back kiểm thử' }));
  await waitFor(() => expect(batchAnalytics.mock.lastCall?.[1]).toBe(50));
  fireEvent.click(screen.getByRole('button', { name: 'Forward kiểm thử' }));
  await waitFor(() => expect(batchAnalytics.mock.lastCall?.[1]).toBe(100));
  fireEvent.change(screen.getByLabelText('Mức mua'), { target: { value: 'Low' } });
  fireEvent.click(screen.getByRole('button', { name: 'Áp dụng bộ lọc' }));
  await waitFor(() => expect(batchAnalytics.mock.lastCall?.[0].purchase_level).toBe('Low'));
  expect(batchAnalytics.mock.lastCall?.[1]).toBe(0);
});
it.each(['cluster=9', 'cluster=1&cluster=2', 'sort=anything', 'customer_id=private@example.com'])(
  'blocks invalid URLs before any data query: %s',
  async (search) => {
    open('/batch-analytics?' + search);
    await screen.findByText('Bộ lọc đường dẫn chưa hợp lệ');
    expect(batchAnalytics).not.toHaveBeenCalled();
    expect(batchAnalyticsOptions).not.toHaveBeenCalled();
  },
);
it('returns from a customer profile with snapshot, filters, exact model and server page intact', async () => {
  const target = filterLocation(
    {
      ...initialDraft,
      cluster: '1',
      purchase_level: 'Low',
      customer_query: 'STORE-CUSTOMER-PRIVATE',
    },
    50,
  );
  open('/batch-analytics?' + target.search, target.state);
  await screen.findByText('Kết quả có thể truy vết');
  expect(screen.getByLabelText('URL hiện tại')).not.toHaveTextContent('STORE-CUSTOMER-PRIVATE');
  fireEvent.click(screen.getByRole('link', { name: /^KH-/ }));
  await screen.findByText('Hồ sơ kiểm thử');
  expect(screen.getByText(data.rows[0]!.snapshot_id)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Về phân tích hàng loạt' }));
  await screen.findByText('Kết quả có thể truy vết');
  expect(screen.getByLabelText('Nhóm khách hàng')).toHaveValue('1');
  expect(screen.getByLabelText('Tìm mã khách hàng')).toHaveValue('STORE-CUSTOMER-PRIVATE');
  expect(batchAnalytics.mock.lastCall?.[1]).toBe(50);
});
it('does not show late results for an old filter or silently filter only the loaded page', async () => {
  let release: ((value: BatchView) => void) | undefined;
  batchAnalytics.mockImplementation((filters, offset) =>
    filters.cluster == null
      ? new Promise<BatchView>((resolve) => {
          release = resolve;
        })
      : Promise.resolve({
          ...data,
          filters,
          offset,
          total_rows: 0,
          rows: [],
          kpis: { ...data.kpis, analysis_jobs: 0 },
        }),
  );
  open();
  await screen.findByText('Đang tổng hợp dữ liệu theo bộ lọc…');
  fireEvent.change(screen.getByLabelText('Nhóm khách hàng'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Áp dụng bộ lọc' }));
  await screen.findByText('Chưa có dữ liệu trong phạm vi này');
  await act(async () => release?.({ ...data, kpis: { ...data.kpis, customers: 999 } }));
  expect(screen.queryByText('999')).not.toBeInTheDocument();
  expect(screen.queryByText('Kết quả có thể truy vết')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Nhóm khách hàng')).toHaveValue('2');
});
it('offers an explicit first page when totals shrink and does not silently alter the URL', async () => {
  batchAnalytics.mockImplementation(async (filters, offset) => ({
    ...data,
    filters,
    offset,
    rows: offset > 0 ? [] : data.rows,
  }));
  open('/batch-analytics?offset=500');
  await screen.findByText('Trang này không còn dòng; hãy quay về trang đầu.');
  expect(batchAnalytics.mock.lastCall?.[1]).toBe(500);
  fireEvent.click(screen.getByRole('button', { name: 'Về trang đầu' }));
  await waitFor(() => expect(batchAnalytics.mock.lastCall?.[1]).toBe(0));
});
it('rejects a response from another filter/page instead of rendering it as current data', async () => {
  batchAnalytics.mockResolvedValue({ ...data, filters: { ...data.filters, cluster: 2 } });
  open();
  await screen.findByText('Chưa thể hoàn thành yêu cầu');
  expect(screen.queryByText('Khách hàng duy nhất')).not.toBeInTheDocument();
});
it('drops a late previous-session read and only renders the new session query', async () => {
  let release: ((value: BatchView) => void) | undefined;
  batchAnalytics.mockImplementation(async (filters, offset) =>
    revision === 1
      ? new Promise<BatchView>((resolve) => {
          release = resolve;
        })
      : { ...data, filters, offset, kpis: { ...data.kpis, customers: 7 } },
  );
  const view = open();
  await screen.findByText('Đang tổng hợp dữ liệu theo bộ lọc…');
  revision = 2;
  view.rerender(
    <QueryClientProvider client={clients[0]!}>
      <MemoryRouter initialEntries={['/batch-analytics']}>
        <BatchAnalyticsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByText('Kết quả có thể truy vết');
  await act(async () => release?.({ ...data, kpis: { ...data.kpis, customers: 999 } }));
  expect(screen.getByText('Khách hàng duy nhất').closest('article')).toHaveTextContent('7');
  expect(screen.queryByText('999')).not.toBeInTheDocument();
  expect(batchAnalyticsNarrative).not.toHaveBeenCalled();
  expect(requestReport).not.toHaveBeenCalled();
});
it('R1-05 feature selection uses the applied cohort, never the draft, and makes no additional requests', async () => {
  batchAnalytics.mockImplementation(async (filters, offset) => ({
    ...data,
    filters,
    offset,
    cluster_profiles: [
      {
        cluster: 1,
        records: 3,
        status: 'available',
        means: { Login_Frequency: 47.25, Cart_Abandonment_Rate: 20.5 },
      },
    ],
  }));
  open('/batch-analytics?cluster=1');
  const chart = within(
    await screen.findByRole('region', { name: 'So sánh đặc điểm giữa các nhóm' }),
  );
  await chart.findByRole('img', { name: /47.25/ });
  const calls = batchAnalytics.mock.calls.length;
  fireEvent.change(screen.getByLabelText('Nhóm khách hàng'), { target: { value: '2' } });
  fireEvent.change(chart.getByLabelText('Đặc điểm cần xem'), {
    target: { value: 'Cart_Abandonment_Rate' },
  });
  expect(chart.getByRole('img', { name: /20.5 %/ })).toBeInTheDocument();
  expect(chart.getByText(/Đang lọc nhóm khách hàng 1/)).toBeInTheDocument();
  expect(screen.getByLabelText('URL hiện tại')).toHaveTextContent('cluster=1');
  expect(batchAnalytics.mock.calls.length).toBe(calls);
  expect(batchAnalyticsNarrative).not.toHaveBeenCalled();
  expect(requestReport).not.toHaveBeenCalled();
});
it('R1-05 hides old comparison while a new filter loads, then preserves the backend error', async () => {
  let fail: ((cause: unknown) => void) | undefined;
  batchAnalytics.mockImplementation(async (filters, offset) => {
    if (filters.cluster === 2)
      return new Promise<BatchView>((_, reject) => {
        fail = reject;
      });
    return { ...data, filters, offset };
  });
  open();
  await screen.findByRole('region', { name: 'So sánh đặc điểm giữa các nhóm' });
  fireEvent.change(screen.getByLabelText('Nhóm khách hàng'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Áp dụng bộ lọc' }));
  await screen.findByText('Đang tổng hợp dữ liệu theo bộ lọc…');
  expect(
    screen.queryByRole('region', { name: 'So sánh đặc điểm giữa các nhóm' }),
  ).not.toBeInTheDocument();
  await act(async () => fail?.(new ApiError('http', 503)));
  await screen.findByText('Chưa thể hoàn thành yêu cầu');
  expect(
    screen.queryByRole('region', { name: 'So sánh đặc điểm giữa các nhóm' }),
  ).not.toBeInTheDocument();
});
