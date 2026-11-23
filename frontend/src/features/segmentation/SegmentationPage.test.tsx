import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import fixture from '../../test/fixtures/t15_segmentation.json';
import { createQueryClient } from '../../api/query';
import { WorkspaceContext } from '../../app/context';
import { WorkspaceSession } from '../auth/session';
import SegmentationPage from './SegmentationPage';
import { segmentId } from './segmentation';
const id = '15000000-0000-4000-8000-000000000001',
  sid = '15000000-0000-4000-8000-000000000002';
const snapshot = {
  ...fixture.rows[0]!.customer,
  id: sid,
  customer_id: id,
  Age: 45,
  Churned: false,
  source: 'SYNTHETIC-TEST',
  captured_at: '2026-10-25T00:00:00Z',
};
const ok = (data: unknown, headers = {}) =>
  new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...headers },
  });
const posts = (fetcher: ReturnType<typeof vi.fn<typeof fetch>>) =>
  fetcher.mock.calls.filter(([, init]) => init?.method === 'POST');
async function setup(
  options: {
    role?: 'viewer' | 'operator';
    disconnected?: boolean;
    route?: string;
    summaryError?: boolean;
    respond?: (url: string, init?: RequestInit) => Promise<Response>;
  } = {},
) {
  const query = createQueryClient(),
    headers = options.role
      ? { 'X-Security-Profile': 'secured', 'X-Workspace-Role': options.role }
      : {};
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith('/model-info')) return ok(fixture.catalog, headers);
    if (url.includes('/api/v1/segments?')) {
      if (options.summaryError) return new Response('{}', { status: 503 });
      const version = new URL(url, 'http://test.local').searchParams.get('model_version')!,
        model = fixture.catalog.models.find((m) => m.model_version === version)!;
      const definitions = Object.fromEntries(
        [0, 1, 2].map((c) => [
          segmentId(version, c),
          {
            cluster: String(c),
            display_label: (model.labels as Record<string, string>)[String(c)],
          },
        ]),
      );
      return ok({
        model_version: version,
        definitions,
        stored_result_counts: Object.fromEntries(
          Object.keys(definitions).map((k, i) => [k, version === '1.0.0' && i === 2 ? 3 : 0]),
        ),
        count_unit: 'stored_segmentation_results_not_unique_customers',
        scope: 'descriptive_snapshot',
      });
    }
    if (url.includes('/behaviors')) return ok({ items: [snapshot], total: 1, offset: 0, limit: 5 });
    if (url.includes(`/customers/${id}`))
      return ok({ id, external_id: 'SYNTHETIC-CUSTOMER', is_active: true });
    if (url.includes('/customers'))
      return ok({
        items: [{ id, external_id: 'SYNTHETIC-CUSTOMER' }],
        total: 1,
        offset: 0,
        limit: 5,
      });
    if (options.respond) return options.respond(url, init);
    const body = JSON.parse(String(init?.body)),
      result = fixture.rows.find((row) => row.version === body.model_version)!.result;
    return ok(
      url.includes('/batch/')
        ? { total: body.customers.length, results: body.customers.map(() => result) }
        : result,
    );
  });
  const session = new WorkspaceSession('/backend', () => query.clear(), fetcher);
  if (!options.disconnected)
    await session.connect(options.role ? 'secured' : 'local', options.role ? 'x'.repeat(43) : '');
  render(
    <QueryClientProvider client={query}>
      <WorkspaceContext.Provider value={session}>
        <MemoryRouter initialEntries={[options.route ?? '/segmentation']}>
          <SegmentationPage />
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
  if (!options.disconnected) await screen.findByLabelText('Mô hình phân nhóm');
  return { session, fetcher };
}
function fill(index = 0) {
  Object.entries(fixture.rows[index]!.customer).forEach(([key, value]) =>
    fireEvent.change(document.getElementById(`segment-feature-${key}`)!, {
      target: { value: String(value) },
    }),
  );
}
const changeModel = () =>
  fireEvent.change(screen.getByLabelText('Mô hình phân nhóm'), {
    target: { value: '2.0.0-snapshot-k3' },
  });

it('R1-03 verifies deep-linked snapshot without K-Means inference or save', async () => {
  const { fetcher } = await setup({ route: `/segmentation?customer_id=${id}&snapshot_id=${sid}` });
  expect(await screen.findByRole('link', { name: 'Về hồ sơ phân tích' })).toHaveAttribute(
    'href',
    `/customers/${id}/analysis?snapshot_id=${sid}`,
  );
  await waitFor(() =>
    expect(document.getElementById('segment-feature-Login_Frequency')).toHaveValue(
      String(snapshot.Login_Frequency),
    ),
  );
  expect(screen.getByLabelText('Mô hình phân nhóm')).toHaveValue('1.0.0');
  expect(posts(fetcher)).toHaveLength(0);
});

it('disconnected page never fetches data or inference', async () => {
  const { fetcher } = await setup({ disconnected: true });
  expect(screen.getByRole('heading', { name: 'Phân nhóm khách hàng' })).toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
});
it('single uses exact ten raw features/selected version, no save/defaults; distance is not percentage', async () => {
  const { fetcher } = await setup();
  await userEvent.click(screen.getByRole('button', { name: 'Chạy phân nhóm' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Kiểm tra dữ liệu');
  expect(posts(fetcher)).toHaveLength(0);
  fill();
  await userEvent.click(screen.getByRole('button', { name: 'Chạy phân nhóm' }));
  const region = await screen.findByRole('region', { name: 'Kết quả phân nhóm mới' }),
    result = fixture.rows[0]!.result;
  expect(JSON.parse(String(posts(fetcher)[0]?.[1]?.body))).toEqual({
    model_version: '1.0.0',
    customer: fixture.rows[0]!.customer,
    save_result: false,
  });
  expect(region).toHaveTextContent(result.segment_name);
  expect(region).toHaveTextContent(result.segment_id);
  expect(region).toHaveTextContent(`Giá trị gốc: ${result.distance_to_centroid}`);
  expect(within(region).queryByRole('progressbar')).not.toBeInTheDocument();
});
it('T5 resets form, explicit null, inference-only, empty saved-results stays separate from new result', async () => {
  const { fetcher } = await setup({ role: 'operator' });
  fill();
  changeModel();
  expect(document.getElementById('segment-feature-Total_Purchases')).toHaveValue('');
  expect(screen.getByLabelText('Lưu kết quả phân nhóm vào lịch sử')).toBeDisabled();
  expect(await screen.findByText('Chưa có kết quả lưu cho phiên bản này')).toBeInTheDocument();
  fill(1);
  fireEvent.click(screen.getByLabelText('Không có dữ liệu (null) cho Login_Frequency'));
  await userEvent.click(screen.getByRole('button', { name: 'Chạy phân nhóm' }));
  await screen.findByRole('region', { name: 'Kết quả phân nhóm mới' });
  expect(JSON.parse(String(posts(fetcher)[0]?.[1]?.body))).toMatchObject({
    model_version: '2.0.0-snapshot-k3',
    customer: { Login_Frequency: null },
    save_result: false,
  });
  expect(screen.getByText('Chưa có kết quả lưu cho phiên bản này')).toBeInTheDocument();
});
it.each(['viewer', 'operator'] as const)(
  '%s save rights are explicit and server role based',
  async (role) => {
    const { fetcher } = await setup({ role });
    fill();
    const checkbox = screen.getByLabelText('Lưu kết quả phân nhóm vào lịch sử');
    if (role === 'operator') fireEvent.click(checkbox);
    else expect(checkbox).toBeDisabled();
    await userEvent.click(
      screen.getByRole('button', {
        name: role === 'operator' ? 'Chạy phân nhóm và lưu' : 'Chạy phân nhóm',
      }),
    );
    await screen.findByRole('region', { name: 'Kết quả phân nhóm mới' });
    expect(JSON.parse(String(posts(fetcher)[0]?.[1]?.body)).save_result).toBe(role === 'operator');
  },
);
it('snapshot is read only until submit, exact projection and edits unlink immutable snapshot', async () => {
  const { fetcher } = await setup({ role: 'operator', route: `/segmentation?customer_id=${id}` });
  await userEvent.click(await screen.findByRole('button', { name: 'Dùng bản ghi này' }));
  expect(posts(fetcher)).toHaveLength(0);
  fireEvent.click(screen.getByLabelText('Lưu kết quả phân nhóm vào lịch sử'));
  await userEvent.click(screen.getByRole('button', { name: 'Chạy phân nhóm và lưu' }));
  await screen.findByRole('region', { name: 'Kết quả phân nhóm mới' });
  expect(JSON.parse(String(posts(fetcher)[0]?.[1]?.body))).toMatchObject({
    customer_id: id,
    behavior_snapshot_id: sid,
  });
  fireEvent.change(document.getElementById('segment-feature-Total_Purchases')!, {
    target: { value: '15.6' },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Chạy phân nhóm và lưu' }));
  await screen.findByRole('region', { name: 'Kết quả phân nhóm mới' });
  const body = JSON.parse(String(posts(fetcher)[1]?.[1]?.body));
  expect(body.customer.Total_Purchases).toBe(15.6);
  expect(body).not.toHaveProperty('behavior_snapshot_id');
  expect(body.customer).not.toHaveProperty('Age');
});
it('batch validates locally and renders ordered segment results, no classifier semantics', async () => {
  const { fetcher } = await setup();
  await userEvent.click(screen.getByRole('button', { name: 'Danh sách JSON' }));
  fireEvent.change(screen.getByLabelText('Dữ liệu JSON phân nhóm'), {
    target: { value: JSON.stringify([fixture.rows[0]!.customer, fixture.rows[0]!.customer]) },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Chạy phân nhóm' }));
  const region = await screen.findByRole('region', { name: 'Kết quả phân nhóm mới' });
  expect(region).toHaveTextContent('2 thành công');
  expect(within(region).getAllByRole('row')).toHaveLength(3);
  expect(JSON.parse(String(posts(fetcher)[0]?.[1]?.body)).save_results).toBe(false);
});
it.each([403, 409, 412, 422, 429])('HTTP%s is safe and never retried', async (status) => {
  const { fetcher } = await setup({
    respond: async () =>
      new Response(
        JSON.stringify({
          error: {
            code: 'MODEL_PERSISTENCE_UNSUPPORTED',
            message: 'PRIVATE-INPUT',
            details: [
              { location: ['body', 'customer', 'Total_Purchases'], input: 'PRIVATE-INPUT' },
            ],
          },
        }),
        { status, headers: { 'Content-Type': 'application/json', 'Retry-After': '3' } },
      ),
  });
  fill();
  await userEvent.click(screen.getByRole('button', { name: 'Chạy phân nhóm' }));
  expect(await screen.findByRole('alert')).not.toHaveTextContent('PRIVATE-INPUT');
  expect(posts(fetcher)).toHaveLength(1);
  expect(screen.queryByRole('region', { name: 'Kết quả phân nhóm mới' })).not.toBeInTheDocument();
});
it('401 clears memory session and data; no replay', async () => {
  const { session, fetcher } = await setup({
    respond: async () => new Response('{}', { status: 401 }),
  });
  fill();
  await userEvent.click(screen.getByRole('button', { name: 'Chạy phân nhóm' }));
  await waitFor(() => expect(session.getSnapshot().status).toBe('disconnected'));
  expect(posts(fetcher)).toHaveLength(1);
  expect(screen.getByText('Kết nối để phân nhóm khách hàng')).toBeInTheDocument();
});
it('summary error is not zero or training data, inference can remain available', async () => {
  await setup({ summaryError: true });
  expect(await screen.findByRole('alert')).toHaveTextContent('chưa sẵn sàng');
  expect(screen.queryByText('Chưa có kết quả lưu cho phiên bản này')).not.toBeInTheDocument();
  fill();
  await userEvent.click(screen.getByRole('button', { name: 'Chạy phân nhóm' }));
  await screen.findByRole('region', { name: 'Kết quả phân nhóm mới' });
});
it('network error after explicit save is uncertain and never auto-retried', async () => {
  const { fetcher } = await setup({
    role: 'operator',
    respond: async () => {
      throw new TypeError('PRIVATE');
    },
  });
  fill();
  fireEvent.click(screen.getByLabelText('Lưu kết quả phân nhóm vào lịch sử'));
  await userEvent.click(screen.getByRole('button', { name: 'Chạy phân nhóm và lưu' }));
  expect(await screen.findByText(/Chưa xác định trạng thái ghi PostgreSQL/)).toBeInTheDocument();
  expect(posts(fetcher)).toHaveLength(1);
});
it('disconnect cancels pending and discards late result', async () => {
  let finish: ((response: Response) => void) | undefined, signal: AbortSignal | null | undefined;
  const { session } = await setup({
    respond: async (_url, init) => {
      signal = init?.signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  fill();
  await userEvent.click(screen.getByRole('button', { name: 'Chạy phân nhóm' }));
  expect(screen.getByLabelText('Mô hình phân nhóm')).toBeDisabled();
  act(() => session.disconnect());
  await waitFor(() => expect(signal?.aborted).toBe(true));
  await act(async () => {
    finish?.(ok(fixture.rows[0]!.result));
  });
  expect(screen.queryByRole('region', { name: 'Kết quả phân nhóm mới' })).not.toBeInTheDocument();
});
it('CSV operator uses correct route/version/raw file and exposes only server download', async () => {
  const row = fixture.rows[0]!.customer,
    r = fixture.rows[0]!.result,
    output = {
      ...row,
      Model_ID: r.model_id,
      Model_Version: r.model_version,
      Generated_At: r.generated_at,
      Prediction_Task: r.task,
      Cluster: r.cluster,
      Segment_ID: r.segment_id,
      Segment_Name: r.segment_name,
      Distance_To_Centroid: r.distance_to_centroid,
      Distance_Kind: r.distance_kind,
    };
  const text = Object.keys(output).join(',') + '\n' + Object.values(output).join(',');
  const { fetcher } = await setup({
    role: 'operator',
    respond: async () =>
      new Response(text, { headers: { 'Content-Type': 'text/csv', 'X-Model-Version': '1.0.0' } }),
  });
  await userEvent.click(screen.getByRole('button', { name: 'Nhập tệp CSV' }));
  const bytes = new TextEncoder().encode(
    Object.keys(row).join(',') + '\n' + Object.values(row).join(','),
  );
  const file = new File([bytes], 'test.csv', { type: 'text/csv' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });
  fireEvent.change(screen.getByLabelText('Chọn file CSV phân nhóm'), { target: { files: [file] } });
  await userEvent.click(screen.getByRole('button', { name: 'Chạy phân nhóm' }));
  await screen.findByRole('region', { name: 'Kết quả phân nhóm mới' });
  expect(String(posts(fetcher)[0]?.[0])).toContain('/predict/csv/segment');
  expect((posts(fetcher)[0]?.[1]?.body as FormData).get('save_results')).toBe('false');
  expect(screen.getByRole('button', { name: 'Tải CSV kết quả phân nhóm' })).toBeInTheDocument();
});
it.each([undefined, 'viewer'] as const)('CSV/save remain blocked for %s', async (role) => {
  await setup({ role });
  await userEvent.click(screen.getByRole('button', { name: 'Nhập tệp CSV' }));
  expect(screen.getByRole('button', { name: 'Chạy phân nhóm' })).toBeDisabled();
  expect(screen.getByLabelText('Lưu kết quả phân nhóm vào lịch sử')).toBeDisabled();
});
it('cancel after opt-in save warns about uncertain outcome, aborts once and unlocks', async () => {
  const { fetcher } = await setup({
    role: 'operator',
    respond: async (_url, init) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        ),
      ),
  });
  fill();
  fireEvent.click(screen.getByLabelText('Lưu kết quả phân nhóm vào lịch sử'));
  await userEvent.click(screen.getByRole('button', { name: 'Chạy phân nhóm và lưu' }));
  await userEvent.click(screen.getByRole('button', { name: 'Hủy chờ kết quả' }));
  expect(await screen.findByText(/Chưa xác định trạng thái ghi PostgreSQL/)).toBeInTheDocument();
  expect(posts(fetcher)).toHaveLength(1);
  expect(screen.getByLabelText('Mô hình phân nhóm')).not.toBeDisabled();
});
it('wrong-version response never becomes a result or triggers fallback', async () => {
  const { fetcher } = await setup({ respond: async () => ok(fixture.rows[1]!.result) });
  fill();
  await userEvent.click(screen.getByRole('button', { name: 'Chạy phân nhóm' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('không đúng hợp đồng');
  expect(screen.queryByRole('region', { name: 'Kết quả phân nhóm mới' })).not.toBeInTheDocument();
  expect(posts(fetcher)).toHaveLength(1);
});
