import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import fixture from '../../test/fixtures/t16_what_if.json';
import { createQueryClient } from '../../api/query';
import { WorkspaceContext } from '../../app/context';
import { WorkspaceSession } from '../auth/session';
import WhatIfPage from './WhatIfPage';
import { DISCLAIMER, MUTABLE } from './whatIf';

const ok = (data: unknown, headers = {}) =>
  new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...headers },
  });
const posts = (fetcher: ReturnType<typeof vi.fn<typeof fetch>>) =>
  fetcher.mock.calls.filter(([, i]) => i?.method === 'POST');
async function setup(
  options: {
    role?: 'viewer' | 'operator';
    disconnected?: boolean;
    respond?: (url: string, init?: RequestInit) => Promise<Response>;
    history?: unknown;
    route?: string;
  } = {},
) {
  const query = createQueryClient(),
    headers = options.role
      ? { 'X-Security-Profile': 'secured', 'X-Workspace-Role': options.role }
      : {};
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith('/model-info')) return ok({ models: [] }, headers);
    if (url.endsWith('/what-if/schema')) return ok(fixture.schema);
    if (url.includes('/behaviors'))
      return ok({ items: [fixture.snapshot], total: 1, offset: 0, limit: 5 });
    if (url.includes(`/customers/${fixture.customer.id}`)) return ok(fixture.customer);
    if (url.includes('/customers'))
      return ok({ items: [fixture.customer], total: 1, offset: 0, limit: 5 });
    if (options.respond) {
      const answer = await options.respond(url, init);
      if (answer) return answer;
    }
    if (url.includes('/what-if/scenarios/') && init?.method === 'GET') return ok(fixture.saved);
    if (url.includes('/what-if/scenarios?')) return ok(options.history ?? fixture.history);
    const body = JSON.parse(String(init?.body));
    const row = fixture.rows.find(
      (r) =>
        r.request.models.classification === body.models.classification &&
        r.request.models.segmentation === (body.models.segmentation ?? null),
    )!;
    if (url.endsWith('/preview')) return ok(row.preview);
    if (url.endsWith('/scenarios'))
      return ok({ ...fixture.saved, name: body.name, description: body.description });
    return ok(Object.keys(body.changes).length ? row.comparison : row.no_op);
  });
  const session = new WorkspaceSession('/backend', () => query.clear(), fetcher);
  if (!options.disconnected)
    await session.connect(options.role ? 'secured' : 'local', options.role ? 'x'.repeat(43) : '');
  render(
    <QueryClientProvider client={query}>
      <WorkspaceContext.Provider value={session}>
        <MemoryRouter
          initialEntries={[options.route ?? '/what-if?customer_id=' + fixture.customer.id]}
        >
          <WhatIfPage />
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
  return { fetcher, session };
}
it('R1-03 restores a verified source only; never auto previews, compares or saves', async () => {
  const { fetcher } = await setup({
    route: `/what-if?customer_id=${fixture.customer.id}&snapshot_id=${fixture.snapshot.id}`,
  });
  expect(await screen.findByRole('link', { name: 'Về hồ sơ phân tích' })).toHaveAttribute(
    'href',
    `/customers/${fixture.customer.id}/analysis?snapshot_id=${fixture.snapshot.id}`,
  );
  await screen.findByText('Đã chọn bản ghi hành vi. Dữ liệu gốc được giữ nguyên.');
  expect(screen.queryByRole('region', { name: 'Điều chỉnh sáu biến' })).not.toBeInTheDocument();
  expect(posts(fetcher)).toHaveLength(0);
});
async function preview() {
  await userEvent.click(await screen.findByRole('button', { name: 'Dùng bản ghi này' }));
  await userEvent.click(screen.getByRole('button', { name: 'Phân tích ban đầu' }));
  await screen.findByRole('region', { name: 'Điều chỉnh sáu biến' });
}
async function compare() {
  await preview();
  for (const [name, value] of Object.entries(fixture.rows[0]!.intent.changes)) {
    await userEvent.click(screen.getByRole('checkbox', { name: 'Thay đổi ' + name }));
    fireEvent.change(screen.getByLabelText('Giá trị kịch bản ' + name), {
      target: { value: String(value) },
    });
  }
  await userEvent.click(screen.getByRole('button', { name: 'So sánh kịch bản' }));
  await screen.findByRole('region', { name: 'Lưu kịch bản' });
}
async function fillSave() {
  fireEvent.change(screen.getByLabelText('Tên kịch bản'), {
    target: { value: fixture.saved.name },
  });
  await userEvent.click(screen.getByLabelText(/Tôi đồng ý lưu bản sao/));
}
it('disconnected page does not call customer, schema or inference and always states limitation', async () => {
  const { fetcher } = await setup({ disconnected: true });
  expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
});
it('opening/selecting snapshot never infers or writes; preview sends explicit snapshot and model', async () => {
  const { fetcher } = await setup();
  await screen.findByRole('button', { name: 'Dùng bản ghi này' });
  expect(posts(fetcher)).toHaveLength(0);
  await preview();
  const body = JSON.parse(String(posts(fetcher)[0]![1]?.body));
  expect(body).toEqual(fixture.rows[0]!.request);
  expect(posts(fetcher)).toHaveLength(1);
  expect(
    screen.queryByRole('checkbox', { name: 'Thay đổi Lifetime_Value' }),
  ).not.toBeInTheDocument();
  expect(screen.getAllByRole('checkbox', { name: /Thay đổi / })).toHaveLength(6);
});
it('compare sends only selected mutable fields and the server baseline fingerprint', async () => {
  const { fetcher } = await setup();
  await compare();
  expect(JSON.parse(String(posts(fetcher)[1]![1]?.body))).toEqual(fixture.rows[0]!.intent);
  expect(posts(fetcher)).toHaveLength(2);
  expect(screen.getByText(/Chênh lệch tính bằng điểm phần trăm/)).toBeInTheDocument();
  for (const c of ['Low', 'Medium', 'High'])
    expect(screen.getByLabelText(`Kịch bản ${c}`)).toHaveAttribute(
      'value',
      String(fixture.rows[0]!.comparison.scenario_classification.probabilities[c as 'Low']),
    );
});
it.each(['-1', 'NaN', '100.1'])(
  'invalid Email_Open_Rate %s is rejected before compare',
  async (value) => {
    const { fetcher } = await setup();
    await preview();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Thay đổi Email_Open_Rate' }));
    fireEvent.change(screen.getByLabelText('Giá trị kịch bản Email_Open_Rate'), {
      target: { value },
    });
    await userEvent.click(screen.getByRole('button', { name: 'So sánh kịch bản' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Kiểm tra dữ liệu mô phỏng/);
    expect(posts(fetcher)).toHaveLength(1);
  },
);
it('reset restores baseline and no-op compare returns zero deltas from API', async () => {
  const { fetcher } = await setup();
  await compare();
  await userEvent.click(screen.getByRole('button', { name: 'Đặt lại thay đổi' }));
  expect(screen.queryByRole('region', { name: 'Lưu kịch bản' })).not.toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Thay đổi Login_Frequency' })).not.toBeChecked();
  await userEvent.click(screen.getByRole('button', { name: 'So sánh kịch bản' }));
  expect(
    await screen.findByText('Không có thay đổi đầu vào thực sự.', { selector: 'p' }),
  ).toBeInTheDocument();
  expect(JSON.parse(String(posts(fetcher)[2]![1]?.body)).changes).toEqual({});
});
it.each([undefined, 'viewer'] as const)(
  'role %s cannot save or automatically POST scenarios',
  async (role) => {
    const { fetcher } = await setup({ role });
    await compare();
    expect(screen.getByRole('button', { name: 'Lưu kịch bản' })).toBeDisabled();
    expect(posts(fetcher)).toHaveLength(2);
  },
);
it('operator save is opt-in with immutable request body, fingerprints and UUIDv4 key', async () => {
  const { fetcher } = await setup({ role: 'operator' });
  await compare();
  expect(screen.getByRole('button', { name: 'Lưu kịch bản' })).toBeDisabled();
  await fillSave();
  await userEvent.click(screen.getByRole('button', { name: 'Lưu kịch bản' }));
  expect(await screen.findByText(/Kịch bản đã lưu:/)).toBeInTheDocument();
  expect(
    screen.getByRole('region', { name: 'Kết quả mô phỏng đã lưu bản sao' }),
  ).toBeInTheDocument();
  const request = posts(fetcher)[2]!,
    body = JSON.parse(String(request[1]?.body));
  expect(body).toMatchObject({
    ...fixture.rows[0]!.intent,
    name: fixture.saved.name,
    description: null,
    acknowledge_sensitive_snapshot_storage: true,
    expected_comparison_fingerprint: fixture.rows[0]!.comparison.comparison_fingerprint,
  });
  expect(body).not.toHaveProperty('probabilities');
  expect(new Headers(request[1]?.headers).get('Idempotency-Key')).toMatch(
    /^[a-f0-9-]{14}4[a-f0-9-]{21}$/,
  );
});
it('T4 selection invalidates old preview and stays inference-only for operator', async () => {
  const { fetcher } = await setup({ role: 'operator' });
  await compare();
  await userEvent.selectOptions(
    screen.getByLabelText('Mô hình mức độ mua hàng'),
    '2.0.0-snapshot-conservative12',
  );
  expect(screen.queryByRole('region', { name: 'Điều chỉnh sáu biến' })).not.toBeInTheDocument();
  expect(posts(fetcher)).toHaveLength(2);
  await userEvent.click(screen.getByRole('button', { name: 'Phân tích ban đầu' }));
  await screen.findByRole('region', { name: 'Điều chỉnh sáu biến' });
  await userEvent.click(screen.getByRole('button', { name: 'So sánh kịch bản' }));
  expect(await screen.findByRole('region', { name: 'Lưu kịch bản' })).toHaveTextContent(
    'chưa hỗ trợ lưu',
  );
  expect(screen.getByRole('button', { name: 'Lưu kịch bản' })).toBeDisabled();
  expect(JSON.parse(String(posts(fetcher)[2]![1]?.body)).models.classification).toBe(
    '2.0.0-snapshot-conservative12',
  );
});
it('T5 optional segmentation retains task-specific labels and never grants persistence', async () => {
  const { fetcher } = await setup({ role: 'operator' });
  await screen.findByRole('button', { name: 'Dùng bản ghi này' });
  await userEvent.selectOptions(
    screen.getByLabelText('Mô hình mức độ mua hàng'),
    '2.0.0-snapshot-conservative12',
  );
  await userEvent.selectOptions(
    screen.getByLabelText('Kèm phân nhóm tương tác'),
    '2.0.0-snapshot-k3',
  );
  await preview();
  expect(screen.getByText(/Khoảng cách chuẩn hóa không phải xác suất/)).toBeInTheDocument();
  expect(JSON.parse(String(posts(fetcher)[0]![1]?.body)).models.segmentation).toBe(
    '2.0.0-snapshot-k3',
  );
});
it.each([403, 409, 412, 422, 429, 503])(
  'HTTP %s never becomes fake results or causes automatic retry',
  async (status) => {
    let calls = 0;
    const { fetcher } = await setup({
      respond: async (url) => {
        if (url.endsWith('/preview')) {
          calls++;
          return new Response(
            JSON.stringify({
              error: {
                code: status === 409 ? 'BASELINE_CHANGED' : 'TEST_ERROR',
                message: 'PRIVATE-SERVER-VALUE',
              },
            }),
            { status, headers: { 'Content-Type': 'application/json', 'Retry-After': '2' } },
          );
        }
        return undefined as never;
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Dùng bản ghi này' }));
    await userEvent.click(screen.getByRole('button', { name: 'Phân tích ban đầu' }));
    expect(await screen.findByRole('alert')).not.toHaveTextContent('PRIVATE-SERVER-VALUE');
    expect(screen.queryByRole('region', { name: 'Điều chỉnh sáu biến' })).not.toBeInTheDocument();
    expect(calls).toBe(1);
    expect(posts(fetcher)).toHaveLength(1);
  },
);
it('401 clears connection and current simulation state', async () => {
  const { session } = await setup({
    role: 'viewer',
    respond: async () =>
      new Response('{}', { status: 401, headers: { 'Content-Type': 'application/json' } }),
  });
  await userEvent.click(await screen.findByRole('button', { name: 'Dùng bản ghi này' }));
  await userEvent.click(screen.getByRole('button', { name: 'Phân tích ban đầu' }));
  expect(await screen.findByText('Kết nối để mô phỏng')).toBeInTheDocument();
  expect(session.getSnapshot().status).toBe('disconnected');
});
it('wrong checksum response is rejected before a comparison can be saved', async () => {
  const bad = structuredClone(fixture.rows[0]!.comparison);
  bad.scenario_classification.model.artifact_sha256 = 'a'.repeat(64);
  await setup({
    respond: async (url) => (url.endsWith('/what-if') ? ok(bad) : (undefined as never)),
  });
  await preview();
  for (const [n, v] of Object.entries(fixture.rows[0]!.intent.changes)) {
    fireEvent.click(screen.getByRole('checkbox', { name: 'Thay đổi ' + n }));
    fireEvent.change(screen.getByLabelText('Giá trị kịch bản ' + n), {
      target: { value: String(v) },
    });
  }
  await userEvent.click(screen.getByRole('button', { name: 'So sánh kịch bản' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('không đúng hợp đồng');
  expect(screen.queryByRole('region', { name: 'Lưu kịch bản' })).not.toBeInTheDocument();
});
it('unknown save outcome keeps key/body; explicit replay uses identical intent once', async () => {
  let saves = 0;
  const { fetcher } = await setup({
    role: 'operator',
    respond: async (url, init) => {
      if (url.endsWith('/scenarios') && init?.method === 'POST') {
        saves++;
        if (saves === 1) throw new TypeError('SYNTHETIC network failure');
        const body = JSON.parse(String(init.body));
        return ok({
          ...fixture.saved,
          name: body.name,
          description: body.description,
          idempotency_replayed: true,
        });
      }
      return undefined as never;
    },
  });
  await compare();
  await fillSave();
  await userEvent.click(screen.getByRole('button', { name: 'Lưu kịch bản' }));
  expect(await screen.findByText(/Chưa xác định trạng thái lưu/)).toBeInTheDocument();
  expect(saves).toBe(1);
  expect(screen.getByLabelText('Tên kịch bản')).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Gửi lại nguyên yêu cầu cùng mã' }));
  expect(await screen.findByText(/trả lại bản đã có/)).toBeInTheDocument();
  const all = posts(fetcher).filter(([u]) => String(u).endsWith('/scenarios'));
  expect(all).toHaveLength(2);
  expect(all[0]![1]?.body).toBe(all[1]![1]?.body);
  expect(new Headers(all[0]![1]?.headers).get('Idempotency-Key')).toBe(
    new Headers(all[1]![1]?.headers).get('Idempotency-Key'),
  );
});
it('cancel save aborts the wait, warns uncertain write and never retries', async () => {
  const { fetcher } = await setup({
    role: 'operator',
    respond: async (url, init) => {
      if (url.endsWith('/scenarios') && init?.method === 'POST')
        return new Promise((_r, reject) =>
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('abort', 'AbortError')),
          ),
        );
      return undefined as never;
    },
  });
  await compare();
  await fillSave();
  await userEvent.click(screen.getByRole('button', { name: 'Lưu kịch bản' }));
  await userEvent.click(screen.getByRole('button', { name: 'Hủy chờ kết quả' }));
  expect(await screen.findByText(/Chưa xác định trạng thái lưu/)).toBeInTheDocument();
  expect(posts(fetcher)).toHaveLength(3);
});
it('save timeout is uncertain and does not create another idempotency key', async () => {
  const { fetcher } = await setup({
    role: 'operator',
    respond: async (url, init) => {
      if (url.endsWith('/scenarios') && init?.method === 'POST')
        return new Promise((_r, reject) =>
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('abort', 'AbortError')),
          ),
        );
      return undefined as never;
    },
  });
  await compare();
  await fillSave();
  vi.useFakeTimers();
  try {
    fireEvent.click(screen.getByRole('button', { name: 'Lưu kịch bản' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60001);
    });
    expect(screen.getByText(/Chưa xác định trạng thái lưu/)).toBeInTheDocument();
    expect(posts(fetcher)).toHaveLength(3);
  } finally {
    vi.useRealTimers();
  }
});
it('disconnect during preview aborts and cannot populate a later session', async () => {
  const { session, fetcher } = await setup({
    respond: async (url, init) =>
      url.endsWith('/preview')
        ? new Promise((_r, reject) =>
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('abort', 'AbortError')),
            ),
          )
        : (undefined as never),
  });
  await userEvent.click(await screen.findByRole('button', { name: 'Dùng bản ghi này' }));
  await userEvent.click(screen.getByRole('button', { name: 'Phân tích ban đầu' }));
  await act(async () => session.disconnect());
  expect(await screen.findByText('Kết nối để mô phỏng')).toBeInTheDocument();
  expect(posts(fetcher)).toHaveLength(1);
});
it('history/detail are explicitly loaded GETs, display stored results and never infer', async () => {
  const { fetcher } = await setup();
  await userEvent.click(await screen.findByRole('button', { name: 'Tải lịch sử kịch bản' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Xem kịch bản' }));
  const region = await screen.findByRole('region', { name: 'Kết quả kịch bản đã lưu' });
  expect(within(region).getByText(/không chạy mô hình lại/)).toBeInTheDocument();
  expect(posts(fetcher)).toHaveLength(0);
});
it('history zero is empty and unverified entries never invent labels', async () => {
  const { fetcher } = await setup({ history: { ...fixture.history, items: [], total: 0 } });
  await userEvent.click(await screen.findByRole('button', { name: 'Tải lịch sử kịch bản' }));
  expect(await screen.findByText('Chưa có kịch bản theo bộ lọc')).toBeInTheDocument();
  expect(posts(fetcher)).toHaveLength(0);
});
it('unverified history never interprets stored labels', async () => {
  const history = structuredClone(fixture.history);
  Object.assign(history.items[0]!, {
    integrity_status: 'unverified',
    models: null,
    baseline_label: null,
    scenario_label: null,
    classification_label_changed: null,
  });
  await setup({ history });
  await userEvent.click(await screen.findByRole('button', { name: 'Tải lịch sử kịch bản' }));
  expect(
    await screen.findByText(/Chưa xác minh tính toàn vẹn; không diễn giải nhãn/),
  ).toBeInTheDocument();
});
it('history API error is an error rather than empty or zero records', async () => {
  await setup({
    respond: async (url) =>
      url.includes('/scenarios?')
        ? new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } })
        : (undefined as never),
  });
  await userEvent.click(await screen.findByRole('button', { name: 'Tải lịch sử kịch bản' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Dịch vụ tạm thời chưa sẵn sàng');
  expect(screen.queryByText('Chưa có kịch bản theo bộ lọc')).not.toBeInTheDocument();
});
it('preserves a maximum-length name through explicit save, history and detail without truncation', async () => {
  const name = 'T16-' + 'K'.repeat(196);
  const { fetcher } = await setup({
    role: 'operator',
    history: {
      ...fixture.history,
      items: [{ ...fixture.history.items[0]!, name }],
    },
    respond: async (url, init) =>
      url.includes('/what-if/scenarios/') && init?.method === 'GET'
        ? ok({ ...fixture.saved, name })
        : (undefined as never),
  });
  await compare();
  fireEvent.change(screen.getByLabelText('Tên kịch bản'), { target: { value: name } });
  await userEvent.click(screen.getByLabelText(/Tôi đồng ý lưu bản sao/));
  await userEvent.click(screen.getByRole('button', { name: 'Lưu kịch bản' }));
  expect(await screen.findByText(/Kịch bản đã lưu:/)).toHaveTextContent(name);
  const writes = posts(fetcher).filter(([url]) => String(url).endsWith('/scenarios'));
  expect(writes).toHaveLength(1);
  expect(JSON.parse(String(writes[0]![1]?.body)).name).toBe(name);
  await userEvent.click(screen.getByRole('button', { name: 'Tải lịch sử kịch bản' }));
  const history = screen.getByRole('region', { name: 'Lịch sử What-if' });
  expect(await within(history).findByText(name, { selector: 'strong' })).toBeVisible();
  await userEvent.click(within(history).getByRole('button', { name: 'Xem kịch bản' }));
  expect(await screen.findByRole('heading', { name, level: 3 })).toBeVisible();
  expect(posts(fetcher).filter(([url]) => String(url).endsWith('/scenarios'))).toHaveLength(1);
});
it('history server pagination and filter never simulate an entire cohort locally', async () => {
  const calls: string[] = [];
  await setup({
    respond: async (url, init) => {
      if (url.includes('/scenarios?') && init?.method === 'GET') {
        calls.push(url);
        const offset = Number(new URL(url, 'http://test.local').searchParams.get('offset'));
        return ok({
          ...fixture.history,
          offset,
          total: 21,
          limit: 20,
          items: Array.from({ length: offset === 0 ? 20 : 1 }, (_, i) => ({
            ...fixture.history.items[0]!,
            scenario_id: `16000000-0000-4000-8000-${String(offset + i).padStart(12, '0')}`,
          })),
        });
      }
      return undefined as never;
    },
  });
  await userEvent.click(await screen.findByRole('button', { name: 'Tải lịch sử kịch bản' }));
  const history = screen.getByRole('region', { name: 'Lịch sử What-if' });
  await waitFor(() =>
    expect(within(history).getByRole('button', { name: 'Trang sau' })).toBeEnabled(),
  );
  await userEvent.click(within(history).getByRole('button', { name: 'Trang sau' }));
  await waitFor(() => expect(calls.some((u) => u.includes('offset=20'))).toBe(true));
  expect(MUTABLE).toHaveLength(6);
});
