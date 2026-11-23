import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { BatchAnalysis } from './BatchAnalysis';
import type { AnalysisDetail, AnalysisJob } from './analysisTypes';
import { ApiClient } from '../../api/client';

const request = vi.fn(),
  listAnalyses = vi.fn(),
  createAnalysis = vi.fn(),
  advanceAnalysis = vi.fn(),
  analysisDetail = vi.fn();
let allowed = true;
vi.mock('../../app/context', () => ({
  useWorkspace: () => ({
    hasCapability: () => allowed,
    session: { client: { request, listAnalyses, createAnalysis, advanceAnalysis, analysisDetail } },
  }),
}));
const job: AnalysisJob = {
  job_id: '11111111-1111-4111-8111-111111111111',
  import_job_id: '22222222-2222-4222-8222-222222222222',
  task: 'classification',
  model_version: '1.0.0',
  artifact_sha256: 'a'.repeat(64),
  metadata_sha256: 'b'.repeat(64),
  persist_results: false,
  status: 'completed',
  counts: { total: 10, success: 10, queued: 0, failed: 0, skipped: 0 },
  attempts: 0,
  error_code: null,
  created_at: '2026-11-05T00:00:00Z',
  started_at: '2026-11-05T00:00:00Z',
  completed_at: '2026-11-05T00:00:01Z',
};
const detail: AnalysisDetail = {
  job,
  offset: 0,
  limit: 50,
  preview_available: 10,
  distribution: { Low: 10 },
  rows: [
    {
      customer_id: '33333333-3333-4333-8333-333333333333',
      snapshot_id: '44444444-4444-4444-8444-444444444444',
      status: 'success',
      saved: false,
      error_code: null,
      result: { purchase_level: 'Low', probabilities: { Low: 0.8, Medium: 0.15, High: 0.05 } },
    },
  ],
};
beforeEach(() => {
  allowed = true;
  vi.resetAllMocks();
  request.mockResolvedValue({
    data: {
      models: [
        { task: 'classification', model_version: '1.0.0', available: true },
        { task: 'classification', model_version: '2.0.0-snapshot-conservative12', available: true },
        { task: 'segmentation', model_version: '1.0.0', available: true },
      ],
    },
  });
  listAnalyses.mockResolvedValue({ items: [] });
  createAnalysis.mockResolvedValue({ ...job, status: 'queued' });
  advanceAnalysis.mockResolvedValue(job);
  analysisDetail.mockResolvedValue(detail);
});
function open() {
  return render(
    <MemoryRouter>
      <BatchAnalysis importJobId={job.import_job_id} />
    </MemoryRouter>,
  );
}
async function prepare() {
  fireEvent.click(screen.getByRole('button', { name: 'Chuẩn bị phân tích / tải tác vụ' }));
  await screen.findByRole('button', { name: 'Phân tích hàng loạt' });
}

it('does not create or analyze automatically; runs both selected models only after click', async () => {
  open();
  expect(request).not.toHaveBeenCalled();
  await prepare();
  expect(createAnalysis).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Phân tích hàng loạt' }));
  await waitFor(() => expect(createAnalysis).toHaveBeenCalledTimes(2));
  expect(createAnalysis.mock.calls[0]![0]).toEqual({
    import_job_id: job.import_job_id,
    task: 'classification',
    model_version: '1.0.0',
    save_results: false,
  });
  await screen.findByText('Low: 80.00% · Medium: 15.00% · High: 5.00%');
  expect(screen.getByRole('link', { name: 'Xem hồ sơ phân tích' })).toHaveAttribute(
    'href',
    '/customers/33333333-3333-4333-8333-333333333333/analysis',
  );
});
it('saves only explicit legacy selection; research remains preview even when save is selected', async () => {
  open();
  await prepare();
  fireEvent.click(screen.getByLabelText('Phân nhóm khách hàng'));
  fireEvent.click(screen.getByLabelText('Lưu kết quả bản ban đầu vào đúng hồ sơ khách hàng'));
  fireEvent.change(screen.getByLabelText('Mô hình Mức độ mua hàng'), {
    target: { value: '2.0.0-snapshot-conservative12' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Phân tích hàng loạt' }));
  await waitFor(() => expect(createAnalysis).toHaveBeenCalledOnce());
  expect(createAnalysis.mock.calls[0]![0].save_results).toBe(false);
});
it('does not automatically retry an ambiguous write error', async () => {
  createAnalysis.mockRejectedValue(new Error('offline'));
  open();
  await prepare();
  fireEvent.click(screen.getByRole('button', { name: 'Phân tích hàng loạt' }));
  await screen.findByText(/Không tự gửi lại thao tác ghi/);
  expect(createAnalysis).toHaveBeenCalledOnce();
  expect(advanceAnalysis).not.toHaveBeenCalled();
});
it('loads durable jobs and explicitly resumes a pending step', async () => {
  listAnalyses.mockResolvedValue({
    items: [{ ...job, status: 'running', counts: { total: 10, success: 5 } }],
  });
  open();
  await prepare();
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
  await screen.findByText('Low: 80.00% · Medium: 15.00% · High: 5.00%');
  expect(advanceAnalysis.mock.calls[0]![1]).toBe('advance');
  expect(createAnalysis).not.toHaveBeenCalled();
});

it('renders job start and completion times explicitly in Vietnam timezone', async () => {
  listAnalyses.mockResolvedValue({ items: [job] });
  open();
  await prepare();
  const timing = screen.getByText(/Bắt đầu:/);
  expect(timing).toHaveTextContent('07:00:00');
  expect(timing).toHaveTextContent('07:00:01');
  expect(timing).toHaveTextContent('(UTC+7)');
});
it('shows unavailable previews instead of zeros or old output', async () => {
  listAnalyses.mockResolvedValue({ items: [job] });
  analysisDetail.mockResolvedValue({ ...detail, preview_available: 0, distribution: {}, rows: [] });
  open();
  await prepare();
  fireEvent.click(screen.getByRole('button', { name: 'Xem kết quả' }));
  await screen.findByText(/Một phần bản xem trước đã hết hạn/);
  expect(screen.queryByText(/Low: 80.00%/)).not.toBeInTheDocument();
});
it('blocks processing without operator capability', async () => {
  allowed = false;
  open();
  await prepare();
  expect(screen.getByRole('button', { name: 'Phân tích hàng loạt' })).toBeDisabled();
  expect(screen.getByText(/việc chạy phân tích cần quyền vận hành dữ liệu/)).toBeInTheDocument();
  expect(screen.getByLabelText('Lưu kết quả bản ban đầu vào đúng hồ sơ khách hàng')).toBeDisabled();
});
it('cancels an in-flight request when the import context is unmounted', async () => {
  listAnalyses.mockImplementation(() => new Promise(() => {}));
  const view = open();
  fireEvent.click(screen.getByRole('button', { name: 'Chuẩn bị phân tích / tải tác vụ' }));
  await waitFor(() => expect(listAnalyses).toHaveBeenCalled());
  const signal = listAnalyses.mock.calls[0]![1] as AbortSignal;
  view.unmount();
  expect(signal.aborted).toBe(true);
});

it('uses the existing accounts transport and CSRF nonce for creating a batch job', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(job), {
      headers: { 'Content-Type': 'application/json', 'X-Security-Profile': 'accounts' },
    }),
  );
  const client = new ApiClient(
    'http://127.0.0.1:8000',
    () => null,
    () => {},
    fetcher,
    { credentials: 'include', getNonce: () => 'c'.repeat(43), getRevision: () => 1 },
  );
  await client.createAnalysis({
    import_job_id: job.import_job_id,
    task: 'classification',
    model_version: '1.0.0',
    save_results: true,
  });
  expect(fetcher.mock.calls[0]![0]).toBe('http://127.0.0.1:8000/api/v1/bulk/analyses');
  const options = fetcher.mock.calls[0]![1] as RequestInit;
  expect(new Headers(options.headers).get('X-CSRF-Token')).toBe('c'.repeat(43));
  expect(options.credentials).toBe('include');
});

it('refuses an invalid job path and never automatically retries a failed step', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ error: { code: 'CONFLICT', message: 'conflict' } }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  const client = new ApiClient(
    'http://127.0.0.1:8000',
    () => null,
    () => {},
    fetcher,
  );
  await expect(client.advanceAnalysis('../other', 'advance')).rejects.toBeDefined();
  expect(fetcher).not.toHaveBeenCalled();
  await expect(client.advanceAnalysis(job.job_id, 'advance')).rejects.toBeDefined();
  expect(fetcher).toHaveBeenCalledOnce();
});
