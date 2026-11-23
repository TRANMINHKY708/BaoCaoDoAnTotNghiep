import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import BulkPage from './BulkPage';
import type { Inspection, Manifest, Preview } from './types';

let revision = 1,
  allowed = true,
  readable: string[] = [];
const requestBulk = vi.fn();
const listImports = vi.fn();
const importDetail = vi.fn();
vi.mock('../../app/context', () => ({
  useWorkspace: () => ({
    revision,
    status: 'connected',
    hasCapability: (cap: string) => allowed || readable.includes(cap),
    session: { accountMode: true, client: { requestBulk, listImports, importDetail } },
  }),
}));
const inspection: Inspection = {
  upload_reference: 'u'.repeat(43),
  filename: 'khach-hang.csv',
  file_fingerprint: 'a'.repeat(64),
  size: 1200,
  total_rows: 2,
  expires_at: '2099-01-01T00:00:00Z',
  headers: ['external_id', 'source', 'captured_at', 'Age'],
  contract: {
    contract_version: 'bulk-input-v1',
    behavior_required_metadata: ['external_id', 'source', 'captured_at'],
    behavior_optional_metadata: [],
    behavior_features: [{ name: 'Age' }],
    order_schema: { properties: { order_id: {}, source: {} } },
    models: [
      {
        task: 'classification',
        version: '2.0.0-snapshot-conservative12',
        features: Array(12).fill('Age'),
      },
    ],
  },
};
const preview: Preview = {
  preview_reference: 'p'.repeat(43),
  expires_at: inspection.expires_at,
  valid: false,
  mapping_valid: true,
  stats: {
    total: 2,
    valid: 1,
    error: 1,
    warning: 1,
    duplicate: 0,
    skipped: 0,
    snapshot_eligible: 0,
    snapshot_ineligible: 1,
  },
  rows: [
    {
      row: 2,
      status: 'warning',
      valid: true,
      error: false,
      warning: true,
      duplicate: false,
      skipped: false,
      identity: { source_system: 'shop-a', external_customer_id: '001' },
      snapshot_eligible: false,
      missing_features: ['Total_Purchases'],
      values: { Age: '43' },
    },
  ],
  issues: [
    {
      row: 3,
      source_column: 'Age',
      field: 'Age',
      code: 'INVALID_CELL_VALUE',
      severity: 'error',
      message: 'Giá trị sai kiểu.',
      value: 'bad',
    },
  ],
  page: 1,
  page_size: 25,
  filtered_rows: 2,
  database_written: false,
};
const manifest: Manifest = {
  state: 'prepared_not_imported',
  manifest_reference: 'm'.repeat(43),
  manifest_digest: 'b'.repeat(64),
  row_keys: ['c'.repeat(64)],
  expires_at: inspection.expires_at,
  stats: preview.stats,
  database_written: false,
};
beforeEach(() => {
  revision = 1;
  allowed = true;
  readable = [];
  listImports.mockReset();
  requestBulk
    .mockReset()
    .mockImplementation(async (step: string) =>
      step === 'inspect'
        ? structuredClone(inspection)
        : step === 'preview'
          ? structuredClone(preview)
          : structuredClone(manifest),
    );
});
afterEach(() => vi.useRealTimers());
function open() {
  return render(
    <MemoryRouter>
      <BulkPage />
    </MemoryRouter>,
  );
}
async function inspect() {
  fireEvent.change(screen.getByLabelText('Tệp CSV'), {
    target: { files: [new File(['Age\n43'], 'demo.csv', { type: 'text/csv' })] },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Đọc tệp CSV' }));
  await screen.findByRole('heading', { name: '2. Ánh xạ cột' });
}
async function validate() {
  await inspect();
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra dữ liệu' }));
  await screen.findByRole('heading', { name: '3. Xem trước và kiểm tra' });
}

it('reads CSV with selected dataset, shows exact backend mapping and partial counts', async () => {
  open();
  await validate();
  const form = requestBulk.mock.calls[0]![1] as FormData;
  expect(form.get('dataset_type')).toBe('behavior');
  expect(form.get('file')).toBeInstanceOf(File);
  expect(requestBulk.mock.calls[1]![1]).toMatchObject({
    mapping: {
      Age: 'Age',
      source: 'source',
      external_id: 'external_id',
      captured_at: 'captured_at',
    },
    page_size: 25,
  });
  expect(screen.getByText('shop-a / 001')).toBeInTheDocument();
  expect(screen.getByText(/Dòng 3 · Lỗi/)).toBeInTheDocument();
  const prepare = screen.getByRole('button', { name: 'Chuẩn bị xác nhận' });
  expect(prepare).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Tôi đã xem số lượng, lỗi và cảnh báo của lô.'));
  expect(prepare).toBeDisabled();
  fireEvent.click(screen.getByLabelText(/Tôi xác nhận chỉ chuyển 1 dòng hợp lệ/));
  fireEvent.click(prepare);
  await screen.findByRole('heading', { name: 'Đã chuẩn bị dữ liệu cho bước tiếp theo' });
  expect(requestBulk.mock.calls[2]![1]).toEqual({
    upload_reference: inspection.upload_reference,
    preview_reference: preview.preview_reference,
    acknowledge_review: true,
    accept_partial: true,
  });
  expect(
    screen.getAllByText(/Chỉ ghi vào hệ thống sau khi bạn xác nhận nhập dữ liệu/).length,
  ).toBeGreaterThan(0);
  expect(requestBulk.mock.calls.map((c) => c[0])).toEqual([
    'inspect',
    'preview',
    'prepare-confirmation',
  ]);
});

it('invalidates preview on mapping, model, dataset and file changes', async () => {
  open();
  await validate();
  fireEvent.change(screen.getByLabelText('Ánh xạ Age'), { target: { value: 'source' } });
  expect(
    screen.queryByRole('heading', { name: '3. Xem trước và kiểm tra' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Kiểm tra dữ liệu' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Ánh xạ Age'), { target: { value: 'Age' } });
  fireEvent.change(screen.getByLabelText('Phạm vi kiểm tra'), {
    target: { value: 'classification|2.0.0-snapshot-conservative12' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra dữ liệu' }));
  await screen.findByRole('heading', { name: '3. Xem trước và kiểm tra' });
  expect(requestBulk.mock.lastCall![1]).toMatchObject({
    profile: 'model_input',
    models: [{ task: 'classification', version: '2.0.0-snapshot-conservative12' }],
  });
  fireEvent.change(screen.getByLabelText('Loại dữ liệu'), { target: { value: 'orders' } });
  expect(screen.queryByRole('heading', { name: '2. Ánh xạ cột' })).not.toBeInTheDocument();
  await inspect();
  expect((requestBulk.mock.lastCall![1] as FormData).get('dataset_type')).toBe('orders');
  fireEvent.change(screen.getByLabelText('Tệp CSV'), {
    target: { files: [new File(['x'], 'other.csv')] },
  });
  expect(screen.queryByRole('heading', { name: '2. Ánh xạ cột' })).not.toBeInTheDocument();
});

it('sends explicit renamed column mapping, never guesses aliases', async () => {
  requestBulk.mockResolvedValueOnce({
    ...inspection,
    headers: ['MaKH', 'source', 'captured_at', 'Age'],
  });
  open();
  await inspect();
  expect(screen.getByLabelText('Ánh xạ MaKH')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Kiểm tra dữ liệu' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Ánh xạ MaKH'), { target: { value: 'external_id' } });
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra dữ liệu' }));
  await screen.findByRole('heading', { name: '3. Xem trước và kiểm tra' });
  expect(requestBulk.mock.lastCall![1].mapping).toMatchObject({ MaKH: 'external_id' });
});

it('filters via backend and clears old confirmation acknowledgments', async () => {
  open();
  await validate();
  fireEvent.change(screen.getByLabelText('Lọc trạng thái'), { target: { value: 'error' } });
  await waitFor(() => expect(requestBulk.mock.calls).toHaveLength(3));
  expect(requestBulk.mock.lastCall![1]).toMatchObject({ status: 'error', page: 1 });
});

it('viewer reads the shared import history but still cannot upload', async () => {
  allowed = false;
  readable = ['customers.read', 'history.read'];
  listImports.mockResolvedValue({ items: [] });
  open();
  expect(screen.getByText('Cần quyền vận hành dữ liệu')).toBeInTheDocument();
  expect(screen.getByText(/Bạn vẫn xem được lịch sử nhập/)).toBeInTheDocument();
  expect(screen.queryByLabelText('Tệp CSV')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Lịch sử nhập dữ liệu' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tải lịch sử nhập' }));
  await screen.findByText('Chưa có lịch sử nhập.');
  expect(listImports).toHaveBeenCalledTimes(1);
  expect(listImports.mock.lastCall![0]).toBeUndefined();
  expect(requestBulk).not.toHaveBeenCalled();
});

it('a lot link from the batch dashboard opens that lot directly', async () => {
  allowed = false;
  readable = ['customers.read', 'history.read'];
  const id = '22222222-2222-4222-8222-222222222222';
  importDetail.mockResolvedValue({
    job: {
      job_id: id,
      idempotency_key: 'k',
      status: 'failed',
      counts: {},
      metadata: { filename: 'test3.csv' },
      created_at: '2026-11-16T03:00:00Z',
      completed_at: null,
      error_code: null,
      error_row: null,
    },
    rows: [],
    total_rows: 0,
    offset: 0,
    limit: 50,
  });
  render(
    <MemoryRouter initialEntries={[`/bulk-import?lot=${id}`]}>
      <BulkPage />
    </MemoryRouter>,
  );
  await screen.findByText(/0 dòng có kết quả lưu/);
  expect(importDetail.mock.lastCall![0]).toBe(id);
  expect(listImports).not.toHaveBeenCalled();
});

it('ignores a malformed lot id in the URL', () => {
  render(
    <MemoryRouter initialEntries={['/bulk-import?lot=../../admin']}>
      <BulkPage />
    </MemoryRouter>,
  );
  expect(importDetail).not.toHaveBeenCalled();
});

it('viewer cannot upload or call any F08 endpoint', () => {
  allowed = false;
  open();
  expect(screen.getByText('Cần quyền vận hành dữ liệu')).toBeInTheDocument();
  expect(screen.queryByLabelText('Tệp CSV')).not.toBeInTheDocument();
  expect(requestBulk).not.toHaveBeenCalled();
});

it('shows loading, network and expired reference errors without importing', async () => {
  requestBulk.mockRejectedValueOnce(new ApiError('network'));
  open();
  await inspectFailure();
  expect(screen.getByText(/Không thể kết nối tới API/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Đọc tệp CSV' }));
  await screen.findByRole('heading', { name: '2. Ánh xạ cột' });
  requestBulk.mockRejectedValueOnce(new ApiError('http', 410, { code: 'BULK_REFERENCE_EXPIRED' }));
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra dữ liệu' }));
  await screen.findByText(/Lô tạm đã hết hạn hoặc không thuộc phiên hiện tại/);
  expect(screen.getByRole('button', { name: 'Kiểm tra dữ liệu' })).toBeDisabled();
});
async function inspectFailure() {
  fireEvent.change(screen.getByLabelText('Tệp CSV'), {
    target: { files: [new File(['x'], 'demo.csv')] },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Đọc tệp CSV' }));
  await screen.findByRole('alert');
}

it('session revision unmount cancels late responses and clears sensitive preview', async () => {
  const ui = open();
  await validate();
  revision++;
  ui.rerender(
    <MemoryRouter>
      <BulkPage />
    </MemoryRouter>,
  );
  expect(screen.queryByText('shop-a / 001')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('heading', { name: '3. Xem trước và kiểm tra' }),
  ).not.toBeInTheDocument();
});

it('retains no old data while loading a new mapping preview and blocks duplicate prepare', async () => {
  open();
  await inspect();
  let resolve!: (value: Preview) => void;
  requestBulk.mockImplementationOnce(
    () =>
      new Promise<Preview>((r) => {
        resolve = r;
      }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra dữ liệu' }));
  expect(screen.getByText('Đang kiểm tra dữ liệu…')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Kiểm tra dữ liệu' })).toBeDisabled();
  await act(async () => resolve(preview));
  expect(screen.getByRole('heading', { name: '3. Xem trước và kiểm tra' })).toBeInTheDocument();
});

it('uses existing accounts cookies, CSRF, no auto retry and a strict endpoint allowlist', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(inspection), {
      headers: { 'Content-Type': 'application/json', 'X-Security-Profile': 'accounts' },
    }),
  );
  const client = new ApiClient(
    '/backend',
    () => null,
    () => {},
    fetcher,
    { credentials: 'same-origin', getNonce: () => 'n'.repeat(43), getRevision: () => 1 },
  );
  const form = new FormData();
  form.append('file', new File(['x'], 'example.csv'));
  expect(await client.requestBulk('inspect', form)).toEqual(inspection);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, init] = fetcher.mock.calls[0]!;
  expect(url).toBe('/backend/api/v1/bulk/csv/inspect');
  expect(init?.credentials).toBe('same-origin');
  expect(new Headers(init?.headers).get('X-CSRF-Token')).toBe('n'.repeat(43));
  expect(new Headers(init?.headers).get('Content-Type')).toBeNull();
  expect(new Headers(init?.headers).get('Authorization')).toBeNull();
  expect(init?.body).toBe(form);
  client.cancelAll();
});

it('shows readiness after preview without adding confirmation, import or ML requests', async () => {
  open();
  await inspect();
  fireEvent.change(screen.getByLabelText('Phạm vi kiểm tra'), {
    target: { value: 'classification|2.0.0-snapshot-conservative12' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra dữ liệu' }));
  await screen.findByText('Chưa có dòng đủ snapshot');
  const panel = screen.getByRole('region', { name: 'Khả năng sử dụng dữ liệu' });
  expect(within(panel).getByText('Chưa có dòng đủ snapshot')).toBeInTheDocument();
  expect(within(panel).getByText('Có thể chuẩn bị xác nhận')).toBeInTheDocument();
  expect(within(panel).queryByRole('button')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Chuẩn bị xác nhận' })).toBeDisabled();
  expect(requestBulk.mock.calls.map((c) => c[0])).toEqual(['inspect', 'preview']);
});

it.each(['mapping', 'model', 'profile', 'file', 'dataset', 'session'])(
  'removes the old readiness assessment on %s change',
  async (change) => {
    requestBulk.mockResolvedValueOnce({
      ...inspection,
      contract: {
        ...inspection.contract,
        models: [
          ...inspection.contract.models,
          { task: 'classification', version: '1.0.0', features: ['Age'] },
        ],
      },
    });
    const view = open();
    await inspect();
    fireEvent.change(screen.getByLabelText('Phạm vi kiểm tra'), {
      target: { value: 'classification|2.0.0-snapshot-conservative12' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra dữ liệu' }));
    await screen.findByText('Chưa có dòng đủ snapshot');
    if (change === 'mapping')
      fireEvent.change(screen.getByLabelText('Ánh xạ Age'), { target: { value: 'source' } });
    if (change === 'model' || change === 'profile')
      fireEvent.change(screen.getByLabelText('Phạm vi kiểm tra'), {
        target: { value: change === 'model' ? 'classification|1.0.0' : 'snapshot' },
      });
    if (change === 'file')
      fireEvent.change(screen.getByLabelText('Tệp CSV'), {
        target: { files: [new File(['x'], 'next.csv')] },
      });
    if (change === 'dataset')
      fireEvent.change(screen.getByLabelText('Loại dữ liệu'), { target: { value: 'orders' } });
    if (change === 'session') {
      revision++;
      view.rerender(
        <MemoryRouter>
          <BulkPage />
        </MemoryRouter>,
      );
    }
    expect(
      screen.queryByRole('region', { name: 'Khả năng sử dụng dữ liệu' }),
    ).not.toBeInTheDocument();
    expect(requestBulk.mock.calls.map((c) => c[0])).toEqual(['inspect', 'preview']);
  },
);

it('expires the preview assessment on the clock even when the upload reference is still valid', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-06T00:00:00Z'));
  requestBulk.mockResolvedValueOnce(inspection).mockResolvedValueOnce({
    ...preview,
    expires_at: '2026-11-06T00:00:01Z',
  });
  open();
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Tệp CSV'), {
      target: { files: [new File(['x'], 'demo.csv')] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đọc tệp CSV' }));
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra dữ liệu' }));
  });
  const panel = screen.getByRole('region', { name: 'Khả năng sử dụng dữ liệu' });
  expect(within(panel).getByText('Có thể chuẩn bị xác nhận')).toBeInTheDocument();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(within(panel).getByText(/Đánh giá đã hết hiệu lực/)).toBeInTheDocument();
  expect(within(panel).queryByText('Có thể chuẩn bị xác nhận')).not.toBeInTheDocument();
  expect(requestBulk.mock.calls.map((c) => c[0])).toEqual(['inspect', 'preview']);
});

it('does not keep positive readiness while refreshing or after a preview network error', async () => {
  open();
  await validate();
  let reject!: (error: ApiError) => void;
  requestBulk.mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  fireEvent.change(screen.getByLabelText('Lọc trạng thái'), { target: { value: 'warning' } });
  const panel = screen.getByRole('region', { name: 'Khả năng sử dụng dữ liệu' });
  expect(within(panel).getByText(/Đang cập nhật đánh giá/)).toBeInTheDocument();
  expect(within(panel).queryByText('Có thể chuẩn bị xác nhận')).not.toBeInTheDocument();
  await act(async () => {
    reject(new ApiError('network'));
  });
  expect(within(panel).getByText(/Chưa thể xác nhận đánh giá hiện tại/)).toBeInTheDocument();
  expect(within(panel).queryByText('Có thể chuẩn bị xác nhận')).not.toBeInTheDocument();
  expect(requestBulk.mock.calls.map((c) => c[0])).toEqual(['inspect', 'preview', 'preview']);
});
