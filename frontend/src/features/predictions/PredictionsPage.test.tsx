import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import fixture from '../../test/fixtures/t14_predictions.json';
import { createQueryClient } from '../../api/query';
import { WorkspaceContext } from '../../app/context';
import { WorkspaceSession } from '../auth/session';
import PredictionsPage from './PredictionsPage';

const id = '14000000-0000-4000-8000-000000000001',
  snapshotId = '14000000-0000-4000-8000-000000000002';
const snapshot = {
  ...fixture.rows[0]!.customer,
  Total_Purchases: 9,
  Churned: false,
  id: snapshotId,
  customer_id: id,
  source: 'SYNTHETIC-TEST',
  captured_at: '2026-10-25T00:00:00Z',
};
const ok = (data: unknown, headers = {}) =>
  new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...headers },
  });
async function setup(
  options: {
    role?: 'viewer' | 'operator';
    disconnected?: boolean;
    route?: string;
    catalog?: typeof fixture.catalog;
    respond?: (url: string, init?: RequestInit) => Promise<Response>;
  } = {},
) {
  const query = createQueryClient();
  const headers = options.role
    ? { 'X-Security-Profile': 'secured', 'X-Workspace-Role': options.role }
    : {};
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith('/model-info')) return ok(options.catalog ?? fixture.catalog, headers);
    if (options.respond) return options.respond(url, init);
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
    const body = JSON.parse(String(init?.body));
    const result = fixture.rows.find((row) => row.version === body.model_version)!.result;
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
        <MemoryRouter initialEntries={[options.route ?? '/predictions']}>
          <PredictionsPage />
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
  if (!options.disconnected) await screen.findByLabelText('Mô hình phân loại');
  return { session, fetcher };
}
const requests = (fetcher: ReturnType<typeof vi.fn<typeof fetch>>) =>
  fetcher.mock.calls.filter(([, init]) => init?.method === 'POST');
function fill(index = 0) {
  for (const [name, value] of Object.entries(fixture.rows[index]!.customer)) {
    const input = document.getElementById(`feature-${name}`);
    if (input) fireEvent.change(input, { target: { value: String(value) } });
  }
}
const changeModel = () =>
  fireEvent.change(screen.getByLabelText('Mô hình phân loại'), {
    target: { value: '2.0.0-snapshot-conservative12' },
  });

it('R1-03 verifies deep-linked customer/snapshot without prediction, SHAP or save requests', async () => {
  const { fetcher } = await setup({
    route: `/predictions?customer_id=${id}&snapshot_id=${snapshotId}`,
  });
  expect(await screen.findByRole('link', { name: 'Về hồ sơ phân tích' })).toHaveAttribute(
    'href',
    `/customers/${id}/analysis?snapshot_id=${snapshotId}`,
  );
  await screen.findByText(/Đã nhập snapshot/);
  expect(document.getElementById('feature-Login_Frequency')).toHaveValue(
    String(snapshot.Login_Frequency),
  );
  expect(screen.getByLabelText('Mô hình phân loại')).toHaveValue('1.0.0');
  expect(requests(fetcher)).toHaveLength(0);
});

it('disconnected page is honest empty state, never fetches model or business data', async () => {
  const { fetcher } = await setup({ disconnected: true });
  expect(screen.getByRole('heading', { name: 'Dự đoán mức độ mua hàng' })).toBeInTheDocument();
  expect(screen.getByText('Kết nối để chạy dự đoán')).toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
});
it('single exact 24-feature request, no defaults/save; result UI matches server class/probabilities/version', async () => {
  const { fetcher } = await setup();
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Chạy dự đoán' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Kiểm tra dữ liệu');
  expect(requests(fetcher)).toHaveLength(0);
  fill();
  await user.click(screen.getByRole('button', { name: 'Chạy dự đoán' }));
  const region = await screen.findByRole('region', { name: 'Kết quả dự đoán mới' }),
    result = fixture.rows[0]!.result;
  expect(JSON.parse(String(requests(fetcher)[0]?.[1]?.body))).toEqual({
    model_version: '1.0.0',
    customer: fixture.rows[0]!.customer,
    save_result: false,
  });
  expect(
    within(region).getByText(result.purchase_level, { selector: 'strong.prediction-level' }),
  ).toBeInTheDocument();
  expect(within(region).getByRole('progressbar', { name: 'Xác suất Medium' })).toHaveAttribute(
    'value',
    String(result.probabilities.Medium),
  );
  expect(region).toHaveTextContent('chưa được lưu vào lịch sử');
  expect(region).toHaveTextContent('1.0.0');
  fireEvent.change(document.getElementById('feature-Age')!, { target: { value: '44' } });
  expect(screen.queryByRole('region', { name: 'Kết quả dự đoán mới' })).not.toBeInTheDocument();
});
it('model switch resets input and results, T4 12 keys/null explicit, never sends LTV/Churned or saves', async () => {
  const { fetcher } = await setup({ role: 'operator' });
  fill();
  changeModel();
  expect(document.getElementById('feature-Lifetime_Value')).toBeNull();
  expect(document.getElementById('feature-Churned')).toBeNull();
  expect(document.getElementById('feature-Age')).toHaveValue('');
  expect(screen.getByLabelText('Lưu kết quả vào lịch sử')).toBeDisabled();
  fill(1);
  fireEvent.click(screen.getByLabelText('Không có dữ liệu (null) cho Age'));
  await userEvent.click(screen.getByRole('button', { name: 'Chạy dự đoán' }));
  await screen.findByRole('region', { name: 'Kết quả dự đoán mới' });
  const body = JSON.parse(String(requests(fetcher)[0]?.[1]?.body));
  expect(Object.keys(body.customer)).toHaveLength(12);
  expect(body.customer.Age).toBeNull();
  expect(body.save_result).toBe(false);
  expect(body.model_version).toBe('2.0.0-snapshot-conservative12');
});
it.each(['viewer', 'operator'] as const)(
  '%s save rights require explicit opt-in, never implicit persistence',
  async (role) => {
    const { fetcher } = await setup({ role });
    fill();
    const checkbox = screen.getByLabelText('Lưu kết quả vào lịch sử');
    if (role === 'viewer') expect(checkbox).toBeDisabled();
    else fireEvent.click(checkbox);
    await userEvent.click(
      screen.getByRole('button', {
        name: role === 'operator' ? 'Chạy dự đoán và lưu' : 'Chạy dự đoán',
      }),
    );
    const result = await screen.findByRole('region', { name: 'Kết quả dự đoán mới' });
    expect(JSON.parse(String(requests(fetcher)[0]?.[1]?.body)).save_result).toBe(
      role === 'operator',
    );
    expect(result).toHaveTextContent(
      role === 'operator' ? 'Yêu cầu lưu đã hoàn tất' : 'chưa được lưu vào lịch sử',
    );
  },
);
it('snapshot flow strips metadata/target, boolean→0, explicit legacy save links original snapshot; edits drop snapshot link', async () => {
  const { fetcher } = await setup({ role: 'operator', route: `/predictions?customer_id=${id}` });
  await userEvent.click(await screen.findByRole('button', { name: 'Dùng bản ghi này' }));
  const listUrl = fetcher.mock.calls
    .map(([url]) => new URL(String(url), 'http://test.local'))
    .find((url) => url.pathname.endsWith('/customers'))!;
  expect(listUrl.searchParams.has('q')).toBe(false);
  expect(document.getElementById('feature-Churned')).toHaveValue('0');
  fireEvent.click(screen.getByLabelText('Lưu kết quả vào lịch sử'));
  await userEvent.click(screen.getByRole('button', { name: 'Chạy dự đoán và lưu' }));
  await screen.findByRole('region', { name: 'Kết quả dự đoán mới' });
  let body = JSON.parse(String(requests(fetcher)[0]?.[1]?.body));
  expect(body).toMatchObject({ customer_id: id, behavior_snapshot_id: snapshotId });
  expect(body.customer).not.toHaveProperty('Total_Purchases');
  fireEvent.change(document.getElementById('feature-Login_Frequency')!, {
    target: { value: '10.456' },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Chạy dự đoán và lưu' }));
  await screen.findByRole('region', { name: 'Kết quả dự đoán mới' });
  body = JSON.parse(String(requests(fetcher)[1]?.[1]?.body));
  expect(body.customer_id).toBe(id);
  expect(body).not.toHaveProperty('behavior_snapshot_id');
  expect(body.customer.Login_Frequency).toBe(10.456);
});
it('batch ordered response displayed, rejects forbidden/duplicate JSON locally before sending', async () => {
  const { fetcher } = await setup();
  await userEvent.click(screen.getByRole('button', { name: 'Danh sách JSON' }));
  fireEvent.change(screen.getByLabelText('Dữ liệu JSON'), {
    target: { value: '[{"Age":1,"Age":2}]' },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Chạy dự đoán' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('key trùng');
  expect(requests(fetcher)).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('Dữ liệu JSON'), {
    target: { value: JSON.stringify([fixture.rows[0]!.customer, fixture.rows[0]!.customer]) },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Chạy dự đoán' }));
  const region = await screen.findByRole('region', { name: 'Kết quả dự đoán mới' });
  expect(region).toHaveTextContent('2 thành công · 0 thất bại');
  expect(within(region).getAllByRole('row')).toHaveLength(3);
  expect(JSON.parse(String(requests(fetcher)[0]?.[1]?.body)).save_results).toBe(false);
});
it.each([403, 409, 422, 429])(
  'HTTP %s safely preserves input, reports no returned results, no retry',
  async (status) => {
    const { fetcher } = await setup({
      respond: async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'MODEL_PERSISTENCE_UNSUPPORTED',
              message: 'PRIVATE',
              details: [{ location: ['body', 'customer', 'Age'], input: 'PRIVATE' }],
            },
          }),
          { status, headers: { 'Content-Type': 'application/json', 'Retry-After': '3' } },
        ),
    });
    fill();
    await userEvent.click(screen.getByRole('button', { name: 'Chạy dự đoán' }));
    expect(await screen.findByRole('alert')).not.toHaveTextContent('PRIVATE');
    expect(requests(fetcher)).toHaveLength(1);
    expect(document.getElementById('feature-Age')).toHaveValue('43');
    expect(screen.queryByRole('region', { name: 'Kết quả dự đoán mới' })).not.toBeInTheDocument();
  },
);
it('401 clears session and discards input/results; no automatic replay', async () => {
  const { session, fetcher } = await setup({
    respond: async () => new Response('{}', { status: 401 }),
  });
  fill();
  await userEvent.click(screen.getByRole('button', { name: 'Chạy dự đoán' }));
  await waitFor(() => expect(session.getSnapshot().status).toBe('disconnected'));
  expect(requests(fetcher)).toHaveLength(1);
  expect(screen.getByText('Kết nối để chạy dự đoán')).toBeInTheDocument();
});
it('network error after explicit save warns uncertain outcome and does not retry', async () => {
  const { fetcher } = await setup({
    role: 'operator',
    respond: async () => {
      throw new TypeError('PRIVATE-TRANSPORT');
    },
  });
  fill();
  fireEvent.click(screen.getByLabelText('Lưu kết quả vào lịch sử'));
  await userEvent.click(screen.getByRole('button', { name: 'Chạy dự đoán và lưu' }));
  expect(await screen.findByText(/Chưa xác định trạng thái ghi PostgreSQL/)).toBeInTheDocument();
  expect(requests(fetcher)).toHaveLength(1);
  expect(screen.queryByText('PRIVATE-TRANSPORT')).not.toBeInTheDocument();
});
it('explicit cancel aborts waiting once, unlocks controls and warns about possible server write', async () => {
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
  fireEvent.click(screen.getByLabelText('Lưu kết quả vào lịch sử'));
  await userEvent.click(screen.getByRole('button', { name: 'Chạy dự đoán và lưu' }));
  await userEvent.click(screen.getByRole('button', { name: 'Hủy chờ kết quả' }));
  expect(await screen.findByText(/Chưa xác định trạng thái ghi PostgreSQL/)).toBeInTheDocument();
  expect(screen.getByLabelText('Mô hình phân loại')).not.toBeDisabled();
  expect(requests(fetcher)).toHaveLength(1);
});
it('pending locks model/input, cancellation and disconnect discard late responses', async () => {
  let finish: ((value: Response) => void) | undefined, signal: AbortSignal | null | undefined;
  const { session } = await setup({
    respond: async (_url, init) => {
      signal = init?.signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  fill();
  await userEvent.click(screen.getByRole('button', { name: 'Chạy dự đoán' }));
  expect(screen.getByLabelText('Mô hình phân loại')).toBeDisabled();
  expect(document.getElementById('feature-Age')).toBeDisabled();
  act(() => session.disconnect());
  await waitFor(() => expect(signal?.aborted).toBe(true));
  await act(async () => {
    finish?.(ok(fixture.rows[0]!.result));
  });
  expect(screen.queryByRole('region', { name: 'Kết quả dự đoán mới' })).not.toBeInTheDocument();
});
it('CSV blocked for local, no implicit operator privilege', async () => {
  await setup();
  await userEvent.click(screen.getByRole('button', { name: 'Nhập tệp CSV' }));
  expect(screen.getByRole('button', { name: 'Chạy dự đoán' })).toBeDisabled();
  expect(screen.getByText(/CSV cần kết nối secured với quyền operator/)).toBeInTheDocument();
});

it('CSV viewer remains forbidden; model unavailable does not fall back or run', async () => {
  const catalog = structuredClone(fixture.catalog);
  catalog.models[0]!.available = false;
  const { fetcher } = await setup({ role: 'viewer', catalog });
  expect(screen.getByText('Mô hình hiện không khả dụng')).toBeInTheDocument();
  expect(requests(fetcher)).toHaveLength(0);
  changeModel();
  await userEvent.click(screen.getByRole('button', { name: 'Nhập tệp CSV' }));
  expect(screen.getByRole('button', { name: 'Chạy dự đoán' })).toBeDisabled();
});

it('response from different model version is rejected with no fallback or fabricated result', async () => {
  const { fetcher } = await setup({ respond: async () => ok(fixture.rows[1]!.result) });
  fill();
  await userEvent.click(screen.getByRole('button', { name: 'Chạy dự đoán' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('không đúng hợp đồng');
  expect(screen.queryByRole('region', { name: 'Kết quả dự đoán mới' })).not.toBeInTheDocument();
  expect(requests(fetcher)).toHaveLength(1);
});

it('operator CSV validates locally, sends multipart selected model without save and downloads original server blob', async () => {
  const input = fixture.rows[0]!.customer,
    result = fixture.rows[0]!.result;
  const csvRow = {
    ...input,
    Model_ID: result.model_id,
    Model_Version: result.model_version,
    Generated_At: result.generated_at,
    Prediction_Task: result.task,
    Predicted_Class: result.predicted_class,
    Purchase_Level_Predicted: result.purchase_level,
    Probability_Low: result.probabilities.Low,
    Probability_Medium: result.probabilities.Medium,
    Probability_High: result.probabilities.High,
  };
  const text = Object.keys(csvRow).join(',') + '\r\n' + Object.values(csvRow).join(',') + '\r\n';
  const { fetcher } = await setup({
    role: 'operator',
    respond: async () =>
      new Response('\uFEFF' + text, {
        headers: { 'Content-Type': 'text/csv;charset=utf-8', 'X-Model-Version': '1.0.0' },
      }),
  });
  await userEvent.click(screen.getByRole('button', { name: 'Nhập tệp CSV' }));
  const bytes = new TextEncoder().encode(
    Object.keys(input).join(',') + '\n' + Object.values(input).join(','),
  );
  const file = new File([bytes], 'synthetic.csv', { type: 'text/csv' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });
  fireEvent.change(screen.getByLabelText('Chọn file CSV'), { target: { files: [file] } });
  await userEvent.click(screen.getByRole('button', { name: 'Chạy dự đoán' }));
  const region = await screen.findByRole('region', { name: 'Kết quả dự đoán mới' });
  expect(region).toHaveTextContent('1 thành công');
  const sent = requests(fetcher)[0]?.[1]?.body as FormData;
  expect(sent.get('model_version')).toBe('1.0.0');
  expect(sent.get('save_results')).toBe('false');
  const create = vi.fn<(blob: Blob) => string>(() => 'blob:test-only'),
    revoke = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const original = URL;
  vi.stubGlobal(
    'URL',
    class extends original {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    },
  );
  try {
    await userEvent.click(screen.getByRole('button', { name: 'Tải CSV kết quả' }));
    expect(create).toHaveBeenCalledOnce();
    const blob = create.mock.calls[0]?.[0] as unknown as Blob;
    expect(await blob.text()).toContain(text);
    expect(click).toHaveBeenCalledOnce();
  } finally {
    vi.unstubAllGlobals();
    click.mockRestore();
  }
});

it('explanation is opt-in, sends only for single and clears old results when toggled', async () => {
  const { fetcher } = await setup();
  fill();
  await userEvent.click(screen.getByLabelText('Giải thích dự đoán'));
  await userEvent.click(screen.getByRole('button', { name: 'Chạy dự đoán' }));
  await screen.findByRole('region', { name: 'Kết quả dự đoán mới' });
  expect(JSON.parse(String(requests(fetcher)[0]?.[1]?.body))).toMatchObject({
    explain: true,
    save_result: false,
  });
  expect(screen.getByText(/Giải thích dự đoán hiện không khả dụng/)).toBeInTheDocument();
  await userEvent.click(screen.getByLabelText('Giải thích dự đoán'));
  expect(screen.queryByRole('region', { name: 'Kết quả dự đoán mới' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Chạy dự đoán' }));
  await screen.findByRole('region', { name: 'Kết quả dự đoán mới' });
  expect(JSON.parse(String(requests(fetcher)[1]?.[1]?.body))).not.toHaveProperty('explain');
  expect(screen.queryByText(/Giải thích dự đoán hiện không khả dụng/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Danh sách JSON' }));
  expect(screen.queryByLabelText('Giải thích dự đoán')).not.toBeInTheDocument();
});

it.each([0, 1])(
  'renders explanation from the selected model response, including T4 (row %i)',
  async (index) => {
    const row = fixture.rows[index]!;
    const model = fixture.catalog.models.find(
      (m) => m.task === 'classification' && m.model_version === row.version,
    )!;
    await setup({
      role: 'viewer',
      respond: async () =>
        ok({
          ...row.result,
          explanation: {
            method: 'xgboost_native_exact_treeshap',
            explanation_scope: 'local',
            model_id: row.result.model_id,
            model_version: row.version,
            artifact_sha256: model.artifact_sha256,
            input_source: 'request_payload',
            feature_space: 'preprocessed',
            predicted_class: row.result.predicted_class,
            purchase_level: row.result.purchase_level,
            output_space: 'raw_margin',
            base_value: 0.5,
            model_output: 0.7,
            additivity_error: 0,
            features: [
              { feature_name: 'num__Login_Frequency', feature_value: 0.8, shap_value: 0.4 },
              { feature_name: 'num__Pages_Per_Session', feature_value: -0.2, shap_value: -0.2 },
            ],
          },
        }),
    });
    if (index === 1) changeModel();
    fill(index);
    await userEvent.click(screen.getByLabelText('Giải thích dự đoán'));
    await userEvent.click(screen.getByRole('button', { name: 'Chạy dự đoán' }));
    const chart = await screen.findByRole('region', { name: 'Giải thích dự đoán TreeSHAP' });
    expect(chart).toHaveTextContent(row.version);
    expect(chart).toHaveTextContent(row.result.purchase_level);
    expect(chart).toHaveTextContent('num__Login_Frequency');
    expect(chart).toHaveTextContent('+0.4');
    expect(screen.getByRole('region', { name: 'Kết quả dự đoán mới' })).toHaveTextContent(
      'chưa được lưu vào lịch sử',
    );
  },
);

it('reports unsupported explanation safely without silently retrying or showing old charts', async () => {
  const { fetcher } = await setup({
    respond: async () =>
      new Response(
        JSON.stringify({
          error: { code: 'EXPLANATION_UNAVAILABLE', message: 'safe', details: [] },
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ),
  });
  fill();
  await userEvent.click(screen.getByLabelText('Giải thích dự đoán'));
  await userEvent.click(screen.getByRole('button', { name: 'Chạy dự đoán' }));
  expect(
    await screen.findByText(/Mô hình hiện chưa cung cấp được giải thích tương thích/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('region', { name: 'Giải thích dự đoán TreeSHAP' }),
  ).not.toBeInTheDocument();
  expect(requests(fetcher)).toHaveLength(1);
});
