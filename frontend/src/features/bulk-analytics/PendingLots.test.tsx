import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PendingLots } from './PendingLots';
import { analyzed, pendingLots } from './pending';
import type { AnalysisJob } from '../bulk/analysisTypes';
import type { ImportJob } from '../bulk/importTypes';

const listImports = vi.fn(),
  listAnalyses = vi.fn();
let allowed = true;
vi.mock('../../app/context', () => ({
  useWorkspace: () => ({
    revision: 1,
    hasCapability: () => allowed,
    session: { client: { listImports, listAnalyses } },
  }),
}));

const lot = (id: string, filename: string, valid: number, status = 'completed'): ImportJob =>
  ({
    job_id: id,
    idempotency_key: id,
    status,
    counts: { valid },
    metadata: { filename },
    created_at: '2026-11-16T03:00:00Z',
    completed_at: '2026-11-16T03:00:01Z',
    error_code: null,
    error_row: null,
  }) as ImportJob;
const job = (over: Partial<AnalysisJob>): AnalysisJob =>
  ({
    job_id: 'j',
    import_job_id: 'x',
    task: 'classification',
    model_version: '1.0.0',
    persist_results: true,
    status: 'completed',
    counts: {},
    attempts: 1,
    error_code: null,
    created_at: '',
    started_at: null,
    completed_at: null,
    ...over,
  }) as AnalysisJob;

const A = '11111111-1111-4111-8111-111111111111',
  B = '22222222-2222-4222-8222-222222222222',
  C = '33333333-3333-4333-8333-333333333333';

function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PendingLots />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  allowed = true;
});
afterEach(cleanup);

it('counts a lot only after a completed, saved analysis with the default model', () => {
  expect(analyzed([job({})])).toBe(true);
  expect(analyzed([])).toBe(false);
  expect(analyzed([job({ persist_results: false })])).toBe(false);
  expect(analyzed([job({ status: 'running' })])).toBe(false);
  expect(analyzed([job({ model_version: '1.1.0' })])).toBe(false);
});

it('skips failed imports and analysed lots', async () => {
  const analyses = vi.fn(async (id: string) => (id === A ? [job({})] : []));
  const result = await pendingLots(
    [lot(A, 'a.csv', 10), lot(B, 'b.csv', 3), lot(C, 'c.csv', 4, 'failed')],
    analyses,
  );
  expect(result.map((j) => j.job_id)).toEqual([B]);
  expect(analyses).not.toHaveBeenCalledWith(C);
});

it('lists pending lots with a link that opens the lot', async () => {
  listImports.mockResolvedValue({ items: [lot(A, 'a.csv', 10), lot(B, 'test3.csv', 3)] });
  listAnalyses.mockImplementation(async (id: string) => ({ items: id === A ? [job({})] : [] }));
  open();
  expect(
    await screen.findByText(/1 lô đã nhập nhưng chưa được phân tích \(3 dòng hợp lệ\)/),
  ).toBeTruthy();
  expect(screen.getByText(/test3\.csv/)).toBeTruthy();
  expect(screen.queryByText(/a\.csv/)).toBeNull();
  expect(screen.getByRole('link', { name: 'Mở lô để phân tích' }).getAttribute('href')).toBe(
    `/bulk-import?lot=${B}`,
  );
  expect(screen.getByText(/tick lưu kết quả/)).toBeTruthy();
});

it('tells read-only users who can run the analysis', async () => {
  allowed = false;
  listImports.mockResolvedValue({ items: [lot(B, 'test3.csv', 3)] });
  listAnalyses.mockResolvedValue({ items: [] });
  open();
  expect(await screen.findByText(/Cần tài khoản vận hành hoặc quản trị/)).toBeTruthy();
});

it('stays hidden when every lot is analysed or the lookup fails', async () => {
  listImports.mockRejectedValue(new Error('down'));
  const { container } = open();
  await new Promise((r) => setTimeout(r, 20));
  expect(container.innerHTML).toBe('');
});
