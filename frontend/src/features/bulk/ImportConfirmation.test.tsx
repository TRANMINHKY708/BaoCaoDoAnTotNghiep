import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import { ImportConfirmation } from './ImportConfirmation';
import { ImportHistory } from './ImportHistory';
import type { ImportJob } from './importTypes';
import type { Manifest } from './types';

const confirmImport = vi.fn(),
  listImports = vi.fn(),
  importDetail = vi.fn(),
  onLock = vi.fn();
let allowed = true;
vi.mock('../../app/context', () => ({
  useWorkspace: () => ({
    session: { client: { confirmImport, listImports, importDetail } },
    hasCapability: () => allowed,
  }),
}));
const manifest: Manifest = {
  state: 'prepared_not_imported',
  manifest_reference: 'r'.repeat(43),
  manifest_digest: 'd'.repeat(64),
  row_keys: ['a'.repeat(64)],
  expires_at: '2099-01-01T00:00:00Z',
  database_written: false,
  stats: {
    total: 2,
    valid: 1,
    error: 1,
    warning: 1,
    duplicate: 0,
    skipped: 0,
    snapshot_eligible: 1,
    snapshot_ineligible: 0,
  },
};
const job: ImportJob = {
  job_id: '11111111-1111-4111-8111-111111111111',
  idempotency_key: '22222222-2222-4222-8222-222222222222',
  status: 'completed',
  counts: {
    customers_created: 1,
    customers_matched: 0,
    customers_updated: 0,
    snapshots_created: 1,
    snapshots_skipped: 0,
    snapshots_ineligible: 0,
  },
  metadata: { filename: 'fixture.csv', sources: ['shop-a'] },
  created_at: '2026-11-05T00:00:00Z',
  completed_at: '2026-11-05T00:00:01Z',
  error_code: null,
  error_row: null,
};
beforeEach(() => {
  allowed = true;
  confirmImport.mockReset().mockResolvedValue(job);
  listImports.mockReset().mockResolvedValue({ items: [job] });
  importDetail.mockReset();
  onLock.mockReset();
});
afterEach(() => vi.restoreAllMocks());
function open(dataset: 'behavior' | 'orders' = 'behavior', expired = false) {
  return render(
    <MemoryRouter>
      <ImportConfirmation manifest={manifest} dataset={dataset} expired={expired} onLock={onLock} />
    </MemoryRouter>,
  );
}
function acknowledge() {
  fireEvent.click(screen.getByLabelText(/Tôi xác nhận ghi các dòng hợp lệ/));
}

it('writes only after explicit final confirmation, sending reference/key and no features/counts', async () => {
  open();
  expect(confirmImport).not.toHaveBeenCalled();
  const button = screen.getByRole('button', { name: 'Xác nhận nhập dữ liệu' });
  expect(button).toBeDisabled();
  acknowledge();
  fireEvent.click(button);
  await screen.findByText('Nhập dữ liệu hoàn tất');
  expect(confirmImport).toHaveBeenCalledTimes(1);
  expect(confirmImport.mock.calls[0]![0]).toEqual({
    manifest_reference: manifest.manifest_reference,
    manifest_digest: manifest.manifest_digest,
    idempotency_key: expect.any(String),
    acknowledge_import: true,
    accept_partial: true,
  });
  expect(onLock).toHaveBeenCalledWith(true);
  expect(onLock).toHaveBeenLastCalledWith(false);
  expect(screen.getByRole('button', { name: 'Gửi lại cùng mã yêu cầu' })).toBeDisabled();
});

it('prevents double click while the same import is in flight', async () => {
  let done!: (value: ImportJob) => void;
  confirmImport.mockImplementationOnce(
    () =>
      new Promise<ImportJob>((resolve) => {
        done = resolve;
      }),
  );
  open();
  acknowledge();
  const button = screen.getByRole('button', { name: 'Xác nhận nhập dữ liệu' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(confirmImport).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Đang đối chiếu và xử lý yêu cầu…')).toBeInTheDocument();
  await act(async () => done(job));
  await screen.findByText('Nhập dữ liệu hoàn tất');
});

it('does not retry unknown writes, resolves result through read-only lookup', async () => {
  confirmImport.mockRejectedValueOnce(new ApiError('timeout'));
  open();
  acknowledge();
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nhập dữ liệu' }));
  await screen.findByText(/Trạng thái ghi chưa rõ/);
  expect(screen.getByRole('button', { name: 'Gửi lại cùng mã yêu cầu' })).toBeDisabled();
  const key = confirmImport.mock.calls[0]![0].idempotency_key;
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra kết quả đã gửi' }));
  await screen.findByText('Nhập dữ liệu hoàn tất');
  expect(listImports.mock.calls[0]![0]).toBe(key);
  expect(confirmImport).toHaveBeenCalledTimes(1);
});

it('reuses the exact request key if lookup found no durable job', async () => {
  confirmImport.mockRejectedValueOnce(new ApiError('network'));
  listImports.mockResolvedValueOnce({ items: [] });
  open();
  acknowledge();
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nhập dữ liệu' }));
  await screen.findByText(/Trạng thái ghi chưa rõ/);
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra kết quả đã gửi' }));
  await screen.findByText(/Chưa tìm thấy job đã lưu/);
  fireEvent.click(screen.getByRole('button', { name: 'Gửi lại cùng mã yêu cầu' }));
  await screen.findByText('Nhập dữ liệu hoàn tất');
  expect(confirmImport.mock.calls[1]![0]).toEqual(confirmImport.mock.calls[0]![0]);
});

it('requires a deliberate new attempt after a confirmed rollback, keeping old job separate', async () => {
  confirmImport.mockResolvedValueOnce({
    ...job,
    status: 'failed',
    error_code: 'BULK_SNAPSHOT_CONFLICT',
    error_row: 3,
  });
  open();
  acknowledge();
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nhập dữ liệu' }));
  await screen.findByText('Nhập thất bại — đã rollback dữ liệu nghiệp vụ');
  const key = confirmImport.mock.calls[0]![0].idempotency_key;
  fireEvent.click(screen.getByRole('button', { name: 'Chuẩn bị lần thử mới sau rollback' }));
  expect(screen.getByRole('button', { name: 'Xác nhận nhập dữ liệu' })).toBeDisabled();
  acknowledge();
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nhập dữ liệu' }));
  await screen.findByText('Nhập dữ liệu hoàn tất');
  expect(confirmImport.mock.calls[1]![0].idempotency_key).not.toBe(key);
});

it('does not import orders, insufficient permissions or expired manifests', () => {
  const ui = open('orders');
  expect(screen.queryByRole('button', { name: 'Xác nhận nhập dữ liệu' })).not.toBeInTheDocument();
  ui.unmount();
  allowed = false;
  const denied = open();
  acknowledge();
  expect(screen.getByRole('button', { name: 'Xác nhận nhập dữ liệu' })).toBeDisabled();
  denied.unmount();
  allowed = true;
  open('behavior', true);
  acknowledge();
  expect(screen.getByRole('button', { name: 'Xác nhận nhập dữ liệu' })).toBeDisabled();
  expect(confirmImport).not.toHaveBeenCalled();
});

it('loads actual import history only on click and displays row identities and snapshot results', async () => {
  importDetail.mockResolvedValue({
    job,
    total_rows: 1,
    offset: 0,
    limit: 50,
    rows: [
      {
        row: 2,
        status: 'applied',
        outcome: {
          identity: { source_system: 'shop-a', external_customer_id: '001' },
          snapshot_action: 'created',
        },
      },
    ],
  });
  render(
    <MemoryRouter>
      <ImportHistory />
    </MemoryRouter>,
  );
  expect(listImports).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Tải lịch sử nhập' }));
  await screen.findByText(/fixture.csv/);
  fireEvent.click(screen.getByRole('button', { name: 'Xem dòng' }));
  await screen.findByText('shop-a / 001');
  expect(screen.getByText('Đã tạo snapshot')).toBeInTheDocument();
  expect(confirmImport).not.toHaveBeenCalled();
});

it('uses existing CSRF/cookies for confirm, with read-only job lookup and no automatic retry', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(job), {
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
  const body = {
    manifest_reference: manifest.manifest_reference,
    manifest_digest: manifest.manifest_digest,
    idempotency_key: job.idempotency_key,
    acknowledge_import: true as const,
    accept_partial: true,
  };
  await client.confirmImport(body);
  const [url, init] = fetcher.mock.calls[0]!;
  expect(url).toBe('/backend/api/v1/bulk/imports/confirm');
  expect(init?.method).toBe('POST');
  expect(JSON.parse(String(init?.body))).toEqual(body);
  expect(new Headers(init?.headers).get('X-CSRF-Token')).toBe('n'.repeat(43));
  expect(init?.credentials).toBe('same-origin');
  fetcher.mockResolvedValueOnce(
    new Response(JSON.stringify({ items: [job] }), {
      headers: { 'Content-Type': 'application/json', 'X-Security-Profile': 'accounts' },
    }),
  );
  await client.listImports(job.idempotency_key);
  expect(fetcher.mock.calls[1]![1]?.method).toBe('GET');
  expect(fetcher).toHaveBeenCalledTimes(2);
  client.cancelAll();
});
