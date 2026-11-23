import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import fixture from '../../test/fixtures/t16_what_if.json';
import { createQueryClient } from '../../api/query';
import { WorkspaceContext } from '../../app/context';
import { WorkspaceSession } from '../auth/session';
import { allPages, timeline, analysisLink, type Scenario } from './analysis';
import type { PurchaseHistory, SegmentHistory } from '../customers/customers';
import CustomerAnalysisPage from './CustomerAnalysisPage';
import { filterLocation } from '../bulk-analytics/navigation';
import { initialDraft } from '../bulk-analytics/filters';
const customer = fixture.customer,
  id = customer.id;
const provenance = {
  id: '13000000-0000-4000-8000-000000000003',
  customer_id: id,
  behavior_snapshot_id: fixture.saved.original_snapshot_id,
  run_id: '13000000-0000-4000-8000-000000000004',
  model_registry_id: '13000000-0000-4000-8000-000000000005',
  model_name: 'TEST_ONLY',
  model_version: '1.0.0',
  created_at: '2026-10-01T00:00:00Z',
};
const purchase: PurchaseHistory = {
  ...provenance,
  model_id: 'purchase-level-xgboost',
  predicted_class: 1,
  purchase_level: 'Medium',
  probability_low: 0.1,
  probability_medium: 0.8,
  probability_high: 0.1,
};
const segment: SegmentHistory = {
  ...provenance,
  id: '13000000-0000-4000-8000-000000000006',
  model_id: 'customer-segmentation-kmeans',
  cluster: 2,
  segment_name: 'Tên nhóm từ API',
  segment_id: 'legacy:1.0.0:cluster:2',
  distance_to_centroid: 1.2,
  created_at: '2026-10-02T00:00:00Z',
};
const scenarios = fixture.history.items as Scenario[];
it('sorts and filters all persisted types with no mixed versions assumption', () => {
  expect(timeline([purchase], [segment], scenarios, 'all', 'desc')[0]!.kind).toBe('what-if');
  expect(timeline([purchase], [segment], scenarios, 'predictions', 'asc')).toEqual([
    { kind: 'predictions', item: purchase },
  ]);
  expect(timeline([purchase], [segment], scenarios, 'all', 'asc')[0]!.kind).toBe('predictions');
  expect(analysisLink('/what-if', id)).toBe('/what-if?customer_id=' + id);
});
it('paginates to completion, validates owner/duplicates and refuses silently truncated totals', async () => {
  const load = vi.fn(async (offset: number) => ({
    items: [{ id: String(offset), customer_id: id }],
    total: 2,
    offset,
  }));
  expect(
    await allPages(
      load,
      (row) => row.customer_id === id,
      (row) => row.id,
    ),
  ).toHaveLength(2);
  expect(load.mock.calls.map((c) => c[0])).toEqual([0, 1]);
  await expect(
    allPages(
      async () => ({ items: [{ id: 'x', customer_id: 'OTHER' }], total: 1, offset: 0 }),
      (r) => r.customer_id === id,
      (r) => r.id,
    ),
  ).rejects.toThrow();
  await expect(
    allPages(
      async () => ({ items: [], total: 1001, offset: 0 }),
      () => true,
      () => '',
    ),
  ).rejects.toThrow('1.000');
  await expect(
    allPages(
      async (offset) => ({ items: [{ id: 'same' }], total: 2, offset }),
      () => true,
      (r) => r.id,
    ),
  ).rejects.toThrow();
});
const churnPrediction = {
  task: 'churn',
  model_id: 'customer-churn-xgboost',
  model_version: '1.0.0-snapshot-churn',
  generated_at: '2026-11-13T00:00:00Z',
  churn_probability: 0.72,
  risk_level: 'high',
  predicted_churn: true,
  decision_threshold: 0.37,
  risk_thresholds: { low_below: 0.13, high_from: 0.58 },
  scope: 'snapshot_churn_status_not_time_to_churn',
  explanation: {
    base_value: -0.9,
    model_output: 0.94,
    additivity_error: 0,
    disclaimer: 'TEST',
    factors: [
      { feature: 'Customer_Service_Calls', value: 9, shap_value: 1.2, direction: 'increases_risk' },
      { feature: 'Email_Open_Rate', value: 12, shap_value: 0.5, direction: 'increases_risk' },
      { feature: 'Age', value: 30, shap_value: -0.2, direction: 'decreases_risk' },
    ],
  },
};
/** Only GET reads, plus churn inference (POST, never persisted). */
const readOnly = (fetcher: { mock: { calls: [RequestInfo | URL, RequestInit?][] } }) =>
  fetcher.mock.calls.every(
    ([url, init]) =>
      (init?.method ?? 'GET') === 'GET' ||
      (init?.method === 'POST' && String(url).endsWith('/api/v1/churn/predict')),
  );
const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
async function setup({
  empty = false,
  error = false,
  foreign = false,
  path = `/customers/${id}/analysis`,
  delay = false,
  limit = false,
  churned = false,
  navigationState = undefined as unknown,
} = {}) {
  const query = createQueryClient();
  let complete: ((r: Response) => void) | undefined;
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://test.local');
    if (url.pathname.endsWith('/model-info')) return ok({ models: [], contract_version: '1.0.0' });
    if (url.pathname === `/backend/api/v1/customers/${id}`) return ok(customer);
    if (
      url.pathname.includes('/what-if/scenarios/') &&
      url.pathname.endsWith(fixture.saved.scenario_id)
    )
      return ok(fixture.saved);
    if (url.pathname.endsWith('/api/v1/churn/predict')) {
      // K6: the only POST on this page is churn inference, which is never persisted.
      expect(init?.method).toBe('POST');
      const sent = JSON.parse(String(init?.body)) as { customer: Record<string, unknown> };
      for (const field of [
        'Churned',
        'Lifetime_Value',
        'Total_Purchases',
        'Days_Since_Last_Purchase',
      ])
        expect(sent.customer).not.toHaveProperty(field);
      return ok(churnPrediction);
    }
    if (error) return ok({}, 403);
    const params = url.searchParams;
    let items: unknown[] = [];
    if (!empty) {
      if (url.pathname.endsWith('/behaviors'))
        items = [
          {
            ...fixture.snapshot,
            id: fixture.saved.original_snapshot_id,
            customer_id: id,
            Churned: churned,
          },
        ];
      if (url.pathname.endsWith('/predictions'))
        items = [{ ...purchase, customer_id: foreign ? 'OTHER' : id }];
      if (url.pathname.endsWith('/segments')) items = [segment];
      if (url.pathname.endsWith('/what-if/scenarios')) {
        expect(params.get('customer_id')).toBe(id);
        items = scenarios;
      }
    }
    expect(init?.method ?? 'GET').toBe('GET');
    const page = {
      items,
      total: limit ? 1001 : items.length,
      offset: Number(params.get('offset') ?? 0),
      limit: 100,
      disclaimer: fixture.history.disclaimer,
    };
    if (delay && url.pathname.endsWith('/predictions'))
      return new Promise<Response>((r) => {
        complete = r;
      });
    return ok(page);
  });
  const session = new WorkspaceSession('/backend', () => query.clear(), fetcher);
  await session.connect('local', '');
  render(
    <QueryClientProvider client={query}>
      <WorkspaceContext.Provider value={session}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: path.split('?')[0],
              search: path.includes('?') ? '?' + path.split('?').slice(1).join('?') : '',
              state: navigationState,
            },
          ]}
        >
          <Routes>
            <Route path="customers/:customerId/analysis" element={<CustomerAnalysisPage />} />
          </Routes>
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
  return {
    fetcher,
    session,
    finish: () => complete!(ok({ items: [purchase], total: 1, offset: 0, limit: 100 })),
  };
}
it('renders separate profile, snapshots, each history type and links without analysis writes', async () => {
  const { fetcher } = await setup();
  await screen.findByText('Tổng quan dữ liệu đã lưu');
  expect(screen.getByText(/1 snapshot · 1 dự đoán · 1 phân nhóm/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Dự đoán khách hàng này' })).toHaveAttribute(
    'href',
    analysisLink('/predictions', id),
  );
  expect(screen.getByText('Tên nhóm từ API')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Loại phân tích'), { target: { value: 'predictions' } });
  expect(screen.queryByText('Tên nhóm từ API')).not.toBeInTheDocument();
  expect(screen.queryByText(/What-if ·/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Loại phân tích'), { target: { value: 'what-if' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết kịch bản' }));
  await screen.findByRole('region', { name: 'Bảng thay đổi feature' });
  expect(readOnly(fetcher)).toBe(true);
  const churn = within(screen.getByRole('region', { name: 'Nguy cơ rời bỏ' }));
  expect(await churn.findByText('72%')).toBeInTheDocument();
  expect(churn.getByText('Mức rủi ro Cao')).toBeInTheDocument();
  expect(churn.getByText('Cuộc gọi hỗ trợ')).toBeInTheDocument();
  expect(churn.getByText('Gợi ý giữ chân')).toBeInTheDocument();
});
it('K6 shows observed churn instead of predicting when the snapshot records Churned', async () => {
  const { fetcher } = await setup({ churned: true });
  const churn = within(await screen.findByRole('region', { name: 'Nguy cơ rời bỏ' }));
  expect(churn.getByText(/đã ghi nhận khách/)).toBeInTheDocument();
  expect(fetcher.mock.calls.some(([url]) => String(url).includes('/churn/'))).toBe(false);
});
it('renders empty snapshots/history honestly', async () => {
  await setup({ empty: true });
  await screen.findByText('Chưa có snapshot', { selector: 'h3' });
  expect(screen.getByText('Chưa có lịch sử theo bộ lọc')).toBeInTheDocument();
});
it('rejects cross-customer records without exposing them', async () => {
  await setup({ foreign: true });
  await screen.findByText('Chưa thể hoàn thành yêu cầu');
  expect(screen.queryByText('Tên nhóm từ API')).not.toBeInTheDocument();
});
it('shows errors rather than empty counts', async () => {
  await setup({ error: true });
  await screen.findByText('Chưa thể hoàn thành yêu cầu');
  expect(screen.queryByText('Tổng quan dữ liệu đã lưu')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Chọn snapshot hành vi')).not.toBeInTheDocument();
});
it('keeps loading until complete and refuses invalid customer ID without requests', async () => {
  const { finish } = await setup({ delay: true });
  await waitFor(() =>
    expect(screen.getByText('Đang tổng hợp lịch sử đã lưu…')).toBeInTheDocument(),
  );
  expect(screen.queryByLabelText('Chọn snapshot hành vi')).not.toBeInTheDocument();
  finish();
  await screen.findByText('Tổng quan dữ liệu đã lưu');
});
it('invalid IDs do not fetch customer/history', async () => {
  const { fetcher } = await setup({ path: '/customers/not-a-uuid/analysis' });
  expect(screen.getByText('Customer ID không hợp lệ')).toBeInTheDocument();
  expect(fetcher.mock.calls.filter(([url]) => String(url).includes('/customers/'))).toHaveLength(0);
});
it('snapshot context uses GET history only and leaves What-if in the overall timeline', async () => {
  const { fetcher, session } = await setup();
  const selector = await screen.findByLabelText('Chọn snapshot hành vi');
  fireEvent.change(selector, { target: { value: provenance.behavior_snapshot_id } });
  const scope = within(screen.getByRole('region', { name: 'Kết quả của snapshot đang chọn' }));
  expect(scope.getByText('Medium', { selector: '.customer-purchase' })).toBeInTheDocument();
  expect(scope.getByText('Tên nhóm từ API')).toBeInTheDocument();
  expect(scope.queryByText(/What-if ·/)).not.toBeInTheDocument();
  expect(screen.getByText(/What-if ·/)).toBeInTheDocument();
  expect(readOnly(fetcher)).toBe(true);
  await act(async () => session.disconnect());
  expect(screen.queryByLabelText('Chọn snapshot hành vi')).not.toBeInTheDocument();
  await act(async () => session.connect('local', ''));
  expect(await screen.findByLabelText('Chọn snapshot hành vi')).toHaveValue(
    provenance.behavior_snapshot_id,
  );
});
it('R1-03 links a verified selected snapshot to all three tools and restores it from URL', async () => {
  const { fetcher } = await setup({
    path: `/customers/${id}/analysis?snapshot_id=${provenance.behavior_snapshot_id}`,
  });
  expect(await screen.findByLabelText('Chọn snapshot hành vi')).toHaveValue(
    provenance.behavior_snapshot_id,
  );
  for (const [name, path] of [
    ['Dự đoán khách hàng này', '/predictions'],
    ['Phân nhóm khách hàng này', '/segmentation'],
    ['Phân tích What-if', '/what-if'],
  ]) {
    expect(screen.getByRole('link', { name })).toHaveAttribute(
      'href',
      analysisLink(path!, id, provenance.behavior_snapshot_id!),
    );
  }
  fireEvent.change(screen.getByLabelText('Chọn snapshot hành vi'), { target: { value: '' } });
  expect(screen.getByRole('link', { name: 'Dự đoán khách hàng này' })).toHaveAttribute(
    'href',
    analysisLink('/predictions', id),
  );
  expect(readOnly(fetcher)).toBe(true);
});
it('R1-03 invalid return snapshot stays in overview with a warning and customer-only links', async () => {
  await setup({ path: `/customers/${id}/analysis?snapshot_id=missing` });
  expect(await screen.findByLabelText('Chọn snapshot hành vi')).toHaveValue('');
  expect(
    screen.getAllByRole('status').some((el) => el.textContent?.includes('Đã trở về tổng quan')),
  ).toBe(true);
  expect(screen.getByRole('link', { name: 'Dự đoán khách hàng này' })).toHaveAttribute(
    'href',
    analysisLink('/predictions', id),
  );
});
it('R1-04 keeps a safe batch return context while the F03 snapshot selector changes', async () => {
  const target = filterLocation(
    { ...initialDraft, cluster: '1', customer_query: 'PRIVATE-CUSTOMER-SEARCH' },
    100,
  );
  await setup({
    path: `/customers/${id}/analysis?batch_filters=${encodeURIComponent(target.search)}`,
    navigationState: target.state,
  });
  await screen.findByLabelText('Chọn snapshot hành vi');
  const expected = '/batch-analytics?' + target.search;
  expect(screen.getByRole('link', { name: 'Về phân tích hàng loạt' })).toHaveAttribute(
    'href',
    expected,
  );
  fireEvent.change(screen.getByLabelText('Chọn snapshot hành vi'), {
    target: { value: provenance.behavior_snapshot_id },
  });
  expect(screen.getByRole('link', { name: 'Về phân tích hàng loạt' })).toHaveAttribute(
    'href',
    expected,
  );
  expect(expected).not.toContain('PRIVATE-CUSTOMER-SEARCH');
});
it('R1-04 refuses arbitrary external return destinations without affecting normal F03 history', async () => {
  await setup({
    path: `/customers/${id}/analysis?batch_filters=${encodeURIComponent('https://evil.example')}`,
  });
  await screen.findByText('Tổng quan dữ liệu đã lưu');
  expect(screen.queryByRole('link', { name: 'Về phân tích hàng loạt' })).not.toBeInTheDocument();
  expect(screen.getByText(/Ngữ cảnh quay lại dashboard không hợp lệ/)).toBeInTheDocument();
});
it('does not expose partial snapshot context when a history exceeds the safety limit', async () => {
  await setup({ limit: true });
  await screen.findByRole('alert');
  expect(screen.getByRole('alert')).toHaveTextContent('1.000');
  expect(screen.queryByLabelText('Chọn snapshot hành vi')).not.toBeInTheDocument();
});
