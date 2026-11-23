import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { createQueryClient } from '../../api/query';
import { WorkspaceContext } from '../../app/context';
import { WorkspaceSession } from '../auth/session';
import CustomersPage from './CustomersPage';
import CustomerDetailPage from './CustomerDetailPage';
import {
  detailFilters,
  externalIdError,
  isStrongEtag,
  listFilters,
  probability,
  type Customer,
  type Snapshot,
} from './customers';

// Synthetic fixtures only. Not demo seeds or application customer records.
const id = '13000000-0000-4000-8000-000000000001';
const initial: Customer = {
  id,
  external_id: 'QA-ONLY-CUSTOMER',
  is_active: true,
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
  deactivated_at: null,
};
const snapshot: Snapshot = {
  id: '13000000-0000-4000-8000-000000000002',
  customer_id: id,
  captured_at: initial.created_at,
  source: 'SYNTHETIC_TEST',
  Age: 29,
  Gender: 'Other',
  Country: 'QA',
  City: 'Fixture',
  Membership_Years: 2,
  Login_Frequency: 10.4,
  Session_Duration_Avg: 20,
  Pages_Per_Session: 3.2,
  Cart_Abandonment_Rate: 10,
  Wishlist_Items: 3,
  Total_Purchases: 10.4,
  Average_Order_Value: 50,
  Days_Since_Last_Purchase: 5,
  Discount_Usage_Rate: 20,
  Returns_Rate: 5,
  Email_Open_Rate: 62,
  Customer_Service_Calls: 1,
  Product_Reviews_Written: 2,
  Social_Media_Engagement_Score: 6,
  Mobile_App_Usage: 4,
  Payment_Method_Diversity: 2,
  Lifetime_Value: 500,
  Credit_Balance: 0,
  Churned: false,
  Signup_Quarter: 'Q1',
};
const provenance = {
  id: '13000000-0000-4000-8000-000000000003',
  customer_id: id,
  behavior_snapshot_id: snapshot.id,
  run_id: '13000000-0000-4000-8000-000000000004',
  model_registry_id: '13000000-0000-4000-8000-000000000005',
  model_name: 'Synthetic test model',
  model_version: '1.0.0',
  created_at: initial.created_at,
};
const purchase = {
  ...provenance,
  model_id: 'purchase-level-xgboost',
  predicted_class: 1,
  purchase_level: 'Medium',
  probability_low: 0.1,
  probability_medium: 0.875,
  probability_high: 0.025,
};
const segment = {
  ...provenance,
  model_id: 'customer-segmentation-kmeans',
  cluster: 2,
  segment_name: 'Tên phân nhóm từ API',
  segment_id: 'legacy:1.0.0:cluster:2',
  distance_to_centroid: 2.125,
};
const ok = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
const page = (items: unknown[], url: string, total = items.length) => ({
  items,
  total,
  offset: Number(new URL(url).searchParams.get('offset') ?? 0),
  limit: Number(new URL(url).searchParams.get('limit') ?? 20),
});
const safeError = (status: number) =>
  ok({ error: { code: 'SYNTHETIC', message: 'DO_NOT_RENDER_PRIVATE_ERROR' } }, status, {
    'Retry-After': '1',
  });
function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Đường dẫn hiện tại">{location.pathname + location.search}</output>;
}

async function setup({
  path = '/customers',
  role = 'viewer',
  respond,
  connected = true,
}: {
  path?: string;
  role?: 'operator' | 'viewer' | 'local';
  connected?: boolean;
  respond?: (url: string, init?: RequestInit) => Promise<Response>;
} = {}) {
  const queries = createQueryClient();
  let row = structuredClone(initial);
  let etag = '"revision-one"';
  const requests: Array<{
    url: string;
    method: string;
    body?: Record<string, unknown>;
    headers: Headers;
  }> = [];
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://fixture.test').toString();
    const method = init?.method ?? 'GET';
    if (url.endsWith('/model-info'))
      return ok(
        { models: [], contract_version: '1.0.0' },
        200,
        role === 'local' ? {} : { 'X-Security-Profile': 'secured', 'X-Workspace-Role': role },
      );
    requests.push({
      url,
      method,
      body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined,
      headers: new Headers(init?.headers),
    });
    if (respond) return respond(url, init);
    const endpoint = new URL(url).pathname;
    if (endpoint.endsWith('/customers')) {
      if (method === 'POST') {
        row = { ...row, external_id: JSON.parse(String(init?.body)).external_id };
        return ok(row, 201);
      }
      return ok(page([row], url));
    }
    if (endpoint.endsWith('/behaviors')) return ok(page([snapshot], url));
    if (endpoint.endsWith('/predictions')) return ok(page([purchase], url));
    if (endpoint.endsWith('/segments')) return ok(page([segment], url));
    if (method === 'PATCH') {
      row = { ...row, ...JSON.parse(String(init?.body)) };
      etag = '"revision-two"';
    }
    if (method === 'DELETE') {
      row = { ...row, is_active: false, deactivated_at: '2026-10-24T00:00:00Z' };
      etag = '"revision-three"';
      return ok(null, 204);
    }
    return ok(row, 200, { ETag: etag });
  });
  const session = new WorkspaceSession('/backend', () => queries.clear(), fetcher);
  if (connected)
    await session.connect(
      role === 'local' ? 'local' : 'secured',
      role === 'local' ? '' : 'SYNTHETIC_TEST_CREDENTIAL_NOT_REAL_' + 'x'.repeat(32),
    );
  render(
    <QueryClientProvider client={queries}>
      <WorkspaceContext.Provider value={session}>
        <MemoryRouter initialEntries={[path]}>
          <LocationProbe />
          <Link to="/customers">Danh sách kiểm thử</Link>
          <Routes>
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
            <Route path="/customers/:customerId/prediction" element={<CustomerDetailPage />} />
            <Route path="/what-if" element={<p>What-if chưa triển khai</p>} />
          </Routes>
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
  return { session, requests, fetcher, queries, user: userEvent.setup() };
}

it('list uses server total and makes no per-customer fan-out', async () => {
  const { requests } = await setup({ respond: async (url) => ok(page([initial], url, 254)) });
  expect(await screen.findByText('254 khách hàng')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Xem hồ sơ QA-ONLY-CUSTOMER' })).toHaveAttribute(
    'href',
    `/customers/${id}`,
  );
  expect(requests).toHaveLength(1);
  expect(screen.queryByText('Low')).not.toBeInTheDocument();
});

it('deep link preserves server offset/limit/search/sort and include_inactive', async () => {
  const { requests } = await setup({
    path: '/customers?q=ABC&offset=20&limit=10&sort=external_id&direction=asc&include_inactive=true',
    respond: async (url) => ok(page([initial], url, 40)),
  });
  await screen.findByText('40 khách hàng');
  const url = new URL(requests[0]!.url);
  expect(Object.fromEntries(url.searchParams)).toEqual({
    q: 'ABC',
    offset: '20',
    limit: '10',
    sort: 'external_id',
    direction: 'asc',
    include_inactive: 'true',
  });
  expect(screen.getByRole('searchbox')).toHaveValue('ABC');
  expect(screen.getByText('Trang 3')).toBeInTheDocument();
});

it('debounces search, keeps focus, resets page and never client-filters a fetched page', async () => {
  const { requests, user } = await setup({
    path: '/customers?offset=20',
    respond: async (url) => ok(page([initial], url, 100)),
  });
  await screen.findByText('100 khách hàng');
  const search = screen.getByRole('searchbox');
  await user.type(search, 'literal_%');
  expect(requests).toHaveLength(1);
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(new URL(requests[1]!.url).searchParams.get('q')).toBe('literal_%');
  expect(new URL(requests[1]!.url).searchParams.get('offset')).toBe('0');
  expect(search).toHaveFocus();
  expect(screen.getByText('100 khách hàng')).toBeInTheDocument();
});

it('pagination and filters call supported API query params, and URL can reproduce state', async () => {
  const { requests, user } = await setup({ respond: async (url) => ok(page([initial], url, 45)) });
  await screen.findByText('45 khách hàng');
  await user.click(screen.getByRole('button', { name: /Trang sau/ }));
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(new URL(requests[1]!.url).searchParams.get('offset')).toBe('20');
  await screen.findByRole('button', { name: /Trang trước/ });
  await user.selectOptions(screen.getByLabelText('Hiển thị'), 'all');
  await waitFor(() => expect(requests).toHaveLength(3));
  expect(screen.getByLabelText('Đường dẫn hiện tại')).toHaveTextContent('offset=0');
  expect(new URL(requests[2]!.url).searchParams.get('include_inactive')).toBe('true');
  expect(screen.queryByRole('option', { name: 'Chỉ ngưng hoạt động' })).not.toBeInTheDocument();
});

it.each(['viewer', 'local'] as const)(
  '%s can read but cannot create/edit/deactivate',
  async (role) => {
    const { user, requests } = await setup({ role });
    await screen.findByText('1 khách hàng');
    expect(screen.getByRole('button', { name: 'Thêm khách hàng' })).toBeDisabled();
    await user.click(screen.getByRole('link', { name: 'Xem hồ sơ QA-ONLY-CUSTOMER' }));
    expect(await screen.findByRole('button', { name: 'Chỉnh sửa' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ngưng hoạt động' })).toBeDisabled();
    expect(requests.every((r) => r.method === 'GET')).toBe(true);
  },
);

it('operator creates only a customer; client validates blank and >100 codepoints', async () => {
  const { user, requests } = await setup({ role: 'operator' });
  await screen.findByText('1 khách hàng');
  await user.click(screen.getByRole('button', { name: 'Thêm khách hàng' }));
  const dialog = screen.getByRole('dialog');
  await user.type(within(dialog).getByLabelText('Mã khách hàng'), '   ');
  await user.click(within(dialog).getByRole('button', { name: 'Tạo khách hàng' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('khoảng trắng');
  fireEvent.change(within(dialog).getByLabelText('Mã khách hàng'), {
    target: { value: 'Q'.repeat(101) },
  });
  await user.click(within(dialog).getByRole('button', { name: 'Tạo khách hàng' }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent('100 ký tự');
  fireEvent.change(within(dialog).getByLabelText('Mã khách hàng'), {
    target: { value: ' QA-NEW ' },
  });
  await user.click(within(dialog).getByRole('button', { name: 'Tạo khách hàng' }));
  expect(await screen.findByRole('heading', { name: 'QA-NEW' })).toBeInTheDocument();
  expect(requests.filter((r) => r.method === 'POST').map((r) => r.body)).toEqual([
    { external_id: ' QA-NEW ' },
  ]);
  expect(requests.filter((r) => r.method !== 'GET')).toHaveLength(1);
});

it('edit uses exact fetched ETag; omits unchanged fields and never sends null', async () => {
  const { user, requests } = await setup({ role: 'operator', path: `/customers/${id}` });
  await user.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }));
  expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled();
  const input = screen.getByLabelText('Mã khách hàng');
  await user.clear(input);
  await user.type(input, 'QA-UPDATED');
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  expect(await screen.findByText('Đã lưu thay đổi khách hàng.')).toBeInTheDocument();
  const request = requests.find((r) => r.method === 'PATCH')!;
  expect(request.headers.get('If-Match')).toBe('"revision-one"');
  expect(request.body).toEqual({ external_id: 'QA-UPDATED' });
});

it('412 keeps draft, blocks resubmit, explicit reload discards it without auto-overwrite', async () => {
  let version = 1;
  const { user, requests } = await setup({
    role: 'operator',
    path: `/customers/${id}`,
    respond: async (url, init) => {
      if (init?.method === 'PATCH') {
        version = 2;
        return safeError(412);
      }
      return url.includes('/behaviors')
        ? ok(page([], url))
        : ok(
            { ...initial, external_id: version === 1 ? 'QA-ONLY-CUSTOMER' : 'QA-OTHER-WRITER' },
            200,
            { ETag: version === 1 ? '"revision-one"' : '"revision-two"' },
          );
    },
  });
  await user.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }));
  const input = screen.getByLabelText('Mã khách hàng');
  await user.clear(input);
  await user.type(input, 'MY-DRAFT');
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  expect(await screen.findByText('Có người đã cập nhật hồ sơ này.')).toBeInTheDocument();
  expect(input).toHaveValue('MY-DRAFT');
  expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled();
  expect(requests.filter((r) => r.method === 'PATCH')).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Đóng và tải bản mới' }));
  expect(await screen.findByRole('heading', { name: 'QA-OTHER-WRITER' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(requests.filter((r) => r.method === 'PATCH')).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Chỉnh sửa' }));
  expect(screen.getByLabelText('Mã khách hàng')).toHaveValue('QA-OTHER-WRITER');
});

it.each([null, 'W/"weak"', '*'])(
  'missing/weak/wildcard ETag %s never permits a write',
  async (etag) => {
    const { requests } = await setup({
      role: 'operator',
      path: `/customers/${id}`,
      respond: async (url) =>
        url.includes('/behaviors')
          ? ok(page([], url))
          : ok(initial, 200, etag ? { ETag: etag } : {}),
    });
    expect(await screen.findByRole('button', { name: 'Chỉnh sửa' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ngưng hoạt động' })).toBeDisabled();
    expect(requests.every((r) => r.method === 'GET')).toBe(true);
  },
);

it('deactivation requires confirmation + If-Match, preserves visible history and can reactivate', async () => {
  const { user, requests } = await setup({ role: 'operator', path: `/customers/${id}` });
  await user.click(await screen.findByRole('button', { name: 'Ngưng hoạt động' }));
  expect(screen.getByRole('dialog')).toHaveTextContent(
    'Hồ sơ và lịch sử được giữ lại. Bạn có thể kích hoạt lại khách hàng.',
  );
  expect(requests.filter((r) => r.method === 'DELETE')).toHaveLength(0);
  await user.click(screen.getByRole('button', { name: 'Hủy' }));
  expect(requests.filter((r) => r.method === 'DELETE')).toHaveLength(0);
  await user.click(screen.getByRole('button', { name: 'Ngưng hoạt động' }));
  await user.click(screen.getByRole('button', { name: 'Xác nhận ngưng hoạt động' }));
  await screen.findByText('Đã ngưng hoạt động. Snapshot và lịch sử được giữ nguyên.');
  expect(requests.find((r) => r.method === 'DELETE')!.headers.get('If-Match')).toBe(
    '"revision-one"',
  );
  expect(await screen.findByText('Bản ghi hành vi', { selector: 'strong' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Chỉnh sửa' }));
  await user.selectOptions(screen.getByLabelText('Trạng thái'), 'true');
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  await screen.findByText('Đã lưu thay đổi khách hàng.');
  expect(requests.find((r) => r.method === 'PATCH')!.body).toEqual({ is_active: true });
});

it.each([403, 409, 422, 429])('write HTTP %s is safe and never auto-retried', async (status) => {
  const { user, requests } = await setup({
    role: 'operator',
    respond: async (url, init) =>
      init?.method === 'POST' ? safeError(status) : ok(page([initial], url)),
  });
  await screen.findByText('1 khách hàng');
  await user.click(screen.getByRole('button', { name: 'Thêm khách hàng' }));
  await user.type(screen.getByLabelText('Mã khách hàng'), 'QA-NEW');
  await user.click(screen.getByRole('button', { name: 'Tạo khách hàng' }));
  expect(await screen.findByRole('alert')).not.toHaveTextContent('DO_NOT_RENDER_PRIVATE_ERROR');
  expect(requests.filter((r) => r.method === 'POST')).toHaveLength(1);
});

it.each([401, 403, 409, 412, 422, 429])('read HTTP %s is not a fake empty list', async (status) => {
  const { session, requests } = await setup({ respond: async () => safeError(status) });
  if (status === 401) {
    await waitFor(() => expect(session.getSnapshot().status).toBe('disconnected'));
    expect(await screen.findByText('Kết nối để xem khách hàng')).toBeInTheDocument();
  } else
    expect(await screen.findByRole('alert')).not.toHaveTextContent('DO_NOT_RENDER_PRIVATE_ERROR');
  expect(screen.queryByText('0 khách hàng')).not.toBeInTheDocument();
  expect(requests).toHaveLength(1);
});

it('uncertain create network failure blocks retry until explicit reconciliation', async () => {
  const { user, requests } = await setup({
    role: 'operator',
    respond: async (url, init) => {
      if (init?.method === 'POST') throw new TypeError('private-error');
      return ok(page([initial], url));
    },
  });
  await screen.findByText('1 khách hàng');
  await user.click(screen.getByRole('button', { name: 'Thêm khách hàng' }));
  await user.type(screen.getByLabelText('Mã khách hàng'), 'QA-NEW');
  await user.click(screen.getByRole('button', { name: 'Tạo khách hàng' }));
  await screen.findByText('Chưa xác định được kết quả thao tác.');
  expect(screen.getByRole('button', { name: 'Tạo khách hàng' })).toBeDisabled();
  expect(requests.filter((r) => r.method === 'POST')).toHaveLength(1);
});

it('empty page is explicit and resetting out-of-range offset is user driven', async () => {
  const { requests, user } = await setup({
    path: '/customers?offset=100',
    respond: async (url) => ok(page([], url, 3)),
  });
  await screen.findByText('Trang này không còn bản ghi');
  expect(requests).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Về trang đầu' }));
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(new URL(requests[1]!.url).searchParams.get('offset')).toBe('0');
});

it('detail displays recorded values without input rounding and links context without invoking What-if', async () => {
  const { requests } = await setup({ path: `/customers/${id}` });
  expect(await screen.findAllByText('10,4', { selector: 'dd' })).toHaveLength(2);
  expect(screen.getByRole('link', { name: /Mô phỏng hành vi/ })).toHaveAttribute(
    'href',
    `/what-if?customer_id=${id}`,
  );
  expect(requests.some((r) => r.url.includes('/what-if'))).toBe(false);
});

it('purchase history probability scale/target/model provenance are correct', async () => {
  const { user, requests } = await setup({
    path: `/customers/${id}?tab=predictions&model_version=1.0.0&limit=10&offset=20`,
  });
  expect(await screen.findByText('87,5%')).toBeInTheDocument();
  expect(screen.getByText('2,5%')).toBeInTheDocument();
  expect(screen.getByText(/10 < Medium ≤ 15/)).toBeInTheDocument();
  const request = requests.find((r) => r.url.includes('/predictions'))!;
  expect(Object.fromEntries(new URL(request.url).searchParams)).toEqual({
    offset: '20',
    limit: '10',
    model_version: '1.0.0',
  });
  await user.click(
    screen.getByText('Thông tin kỹ thuật', { selector: '.customer-provenance > summary' }),
  );
  expect(screen.getByText(provenance.model_registry_id)).toBeInTheDocument();
});

it('segment label and namespace come from API, distance is not a probability', async () => {
  await setup({ path: `/customers/${id}?tab=segments` });
  expect(await screen.findByRole('heading', { name: 'Tên phân nhóm từ API' })).toBeInTheDocument();
  expect(screen.getByText('legacy:1.0.0:cluster:2')).toBeInTheDocument();
  expect(screen.getByText('2,125', { selector: 'dd' })).toBeInTheDocument();
  expect(screen.queryByText('212,5%')).not.toBeInTheDocument();
  expect(screen.getByText(/không phải xác suất/)).toBeInTheDocument();
});

it('legacy prediction deep link defaults to history, but permits switching tabs', async () => {
  const { user, requests } = await setup({ path: `/customers/${id}/prediction` });
  await screen.findByText('87,5%');
  await user.click(screen.getByRole('button', { name: 'Bản ghi hành vi' }));
  await screen.findByText('Bản ghi hành vi', { selector: 'strong' });
  expect(requests.some((r) => r.url.includes('/behaviors'))).toBe(true);
});

it.each(['sample', '13000000-0000-4000-8000-000000000099'])(
  'invalid/not-found detail %s does not fetch unrelated histories',
  async (customerId) => {
    const { requests } = await setup({
      path: `/customers/${customerId}`,
      respond: async () => safeError(404),
    });
    await screen.findByText(
      customerId === 'sample' ? 'Đường dẫn khách hàng không hợp lệ' : 'Không tìm thấy khách hàng',
    );
    expect(requests).toHaveLength(customerId === 'sample' ? 0 : 1);
  },
);

it('disconnect aborts in-flight query, clears data and does not adopt late results', async () => {
  let signal: AbortSignal | null | undefined;
  let finish: ((response: Response) => void) | undefined;
  const { session } = await setup({
    respond: async (_url, init) => {
      signal = init?.signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  await screen.findByText('Đang tải danh sách khách hàng…');
  act(() => session.disconnect());
  await waitFor(() => expect(signal?.aborted).toBe(true));
  await act(async () => {
    finish?.(ok(page([initial], 'http://fixture.test')));
  });
  expect(screen.queryByText(initial.external_id)).not.toBeInTheDocument();
});

it('dialog supports Escape, restores focus and clears draft across a session change', async () => {
  const { user, session } = await setup({ role: 'operator' });
  const opener = await screen.findByRole('button', { name: 'Thêm khách hàng' });
  await user.click(opener);
  await user.type(screen.getByLabelText('Mã khách hàng'), 'UNSAVED');
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
  await user.click(opener);
  expect(screen.getByLabelText('Mã khách hàng')).toHaveValue('');
  act(() => session.disconnect());
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await act(async () => {
    await session.connect('secured', 'SYNTHETIC_TEST_CREDENTIAL_NOT_REAL_' + 'x'.repeat(32));
  });
  await screen.findByText('1 khách hàng');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('URL parsers bound unsafe values, probability and strong ETag helpers fail closed', () => {
  expect(
    listFilters(new URLSearchParams('offset=-1&limit=999&sort=evil&direction=bad')),
  ).toMatchObject({ offset: 0, limit: 20, sort: 'created_at', direction: 'desc' });
  expect(detailFilters(new URLSearchParams('tab=segments'), true).tab).toBe('segments');
  expect(probability(0)).toBe('0%');
  expect(probability(1)).toBe('100%');
  expect(probability(Number.NaN)).toBe('Giá trị không hợp lệ');
  expect(isStrongEtag('W/"weak"')).toBe(false);
  expect(isStrongEtag('"opaque-value"')).toBe(true);
  expect(externalIdError('😀'.repeat(100))).toBe('');
});
