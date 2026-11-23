import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import contract from '../../../../docs/contracts/t12_dashboard_openapi.draft.json';
import { createQueryClient } from '../../api/query';
import { WorkspaceContext } from '../../app/context';
import { WorkspaceSession } from '../auth/session';
import OverviewDashboard from './OverviewDashboard';
import type { Overview } from './dashboard';
import { percent, segmentsFor } from './dashboard';

// Approved synthetic wire examples are TEST FIXTURES ONLY, never application data.
const examples =
  contract.paths['/api/v1/dashboard/overview'].get.responses['200'].content['application/json']
    .examples;
const fixture = (empty = false) =>
  structuredClone(examples[empty ? 'empty' : 'populated'].value) as Overview;
const ok = (data: unknown) =>
  new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
async function setup(respond: (input: string, init?: RequestInit) => Promise<Response>) {
  const queries = createQueryClient();
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const url = String(input);
    return url.endsWith('/model-info')
      ? ok({ models: [], contract_version: '1.0.0' })
      : respond(url, init);
  });
  const session = new WorkspaceSession('/backend', () => queries.clear(), fetcher);
  await session.connect('local', '');
  render(
    <QueryClientProvider client={queries}>
      <WorkspaceContext.Provider value={session}>
        <MemoryRouter>
          <OverviewDashboard />
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
  return { session, fetcher, queries };
}

it('shows real-response units, lineage and both independent namespaces', async () => {
  await setup(async () => ok(fixture()));
  expect(await screen.findByRole('heading', { name: 'Toàn bộ hệ thống' })).toBeInTheDocument();
  expect(
    await screen.findByRole('heading', { name: 'Mức độ mua hàng · Purchase_Level' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Phân nhóm tương tác · K-Means' }),
  ).toBeInTheDocument();
  expect(screen.getAllByText('lượt kết quả lưu')).toHaveLength(2);
  expect(screen.getAllByText(/Không dùng dataset nghiên cứu/).length).toBeGreaterThan(0);
  expect(screen.getByText(/Chỉ áp dụng khoảng thời gian và tập khách hàng/)).toBeInTheDocument();
  expect(screen.getByText(/nhãn mô hình đã lưu/i)).toBeInTheDocument();
});

it('empty is null shares/no fabricated customer chart, not an API error', async () => {
  await setup(async () => ok(fixture(true)));
  expect(await screen.findByText('Chưa có kết quả mô hình trong kỳ')).toBeInTheDocument();
  expect(await screen.findAllByText('Chưa có nhãn trong kỳ')).toHaveLength(2);
  expect(screen.getByText('Chưa có khách hàng trong cohort')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText('100%')).not.toBeInTheDocument();
});

it.each([409, 422, 429, 503])('HTTP %s is an error, never zero data', async (status) => {
  const { fetcher } = await setup(
    async () =>
      new Response(
        JSON.stringify({ error: { code: 'SAFE_ERROR', message: 'sensitive-private-value' } }),
        { status, headers: { 'Content-Type': 'application/json', 'Retry-After': '1' } },
      ),
  );
  expect(await screen.findByRole('alert')).not.toHaveTextContent('sensitive-private-value');
  expect(screen.queryByText('Chưa có kết quả mô hình trong kỳ')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Toàn bộ hệ thống' })).not.toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('network error does not become an empty dashboard', async () => {
  await setup(async () => {
    throw new TypeError('private-network-message');
  });
  expect(await screen.findByRole('alert')).toHaveTextContent('Không thể kết nối');
  expect(screen.queryByRole('heading', { name: 'Toàn bộ hệ thống' })).not.toBeInTheDocument();
});

it('loading has no fake numbers and disconnect cancels/clears the request', async () => {
  let signal: AbortSignal | null | undefined;
  let finish: ((response: Response) => void) | undefined;
  const { session } = await setup(async (_url, init) => {
    signal = init?.signal;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  expect(await screen.findByText('Đang tổng hợp dữ liệu…')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Toàn bộ hệ thống' })).not.toBeInTheDocument();
  act(() => session.disconnect());
  await waitFor(() => expect(signal?.aborted).toBe(true));
  await act(async () => {
    finish?.(ok(fixture()));
  });
  expect(screen.queryByRole('heading', { name: 'Toàn bộ hệ thống' })).not.toBeInTheDocument();
});

it('401 clears the connection and does not display prior business data', async () => {
  const { session } = await setup(async () => new Response('{}', { status: 401 }));
  await waitFor(() => expect(session.getSnapshot().status).toBe('disconnected'));
  expect(screen.queryByRole('heading', { name: 'Toàn bộ hệ thống' })).not.toBeInTheDocument();
});

it('applies all normalized filters as one request and one query key', async () => {
  const { fetcher, queries } = await setup(async () => ok(fixture()));
  await screen.findByRole('heading', { name: 'Toàn bộ hệ thống' });
  const user = userEvent.setup();
  await user.selectOptions(
    screen.getByLabelText('Mô hình mức độ mua hàng'),
    '2.0.0-snapshot-conservative12',
  );
  await user.selectOptions(screen.getByLabelText('Mô hình phân nhóm'), '2.0.0-snapshot-k3');
  await user.selectOptions(screen.getByLabelText('Phân nhóm mới nhất trong kỳ'), 'engagement_low');
  await user.selectOptions(screen.getByLabelText('Số khách xem trước'), '20');
  expect(fetcher).toHaveBeenCalledTimes(2);
  await user.click(screen.getByRole('button', { name: 'Áp dụng bộ lọc' }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  const url = new URL(String(fetcher.mock.calls[2]?.[0]), 'http://local.test');
  expect(url.searchParams.get('classification_model_version')).toBe(
    '2.0.0-snapshot-conservative12',
  );
  expect(url.searchParams.get('segmentation_model_version')).toBe('2.0.0-snapshot-k3');
  expect(url.searchParams.get('segment_id')).toBe('engagement_low');
  expect(url.searchParams.get('table_limit')).toBe('20');
  expect(url.searchParams.has('date_from')).toBe(false);
  const key = queries
    .getQueryCache()
    .getAll()
    .find((q) => q.queryKey[0] === 'dashboard-overview')?.queryKey;
  expect(key?.[1]).toBe(1);
  expect(key?.[2]).toMatchObject({ segment_id: 'engagement_low', table_limit: 20 });
});

it('changing segmentation version clears the old namespace cohort', async () => {
  await setup(async () => ok(fixture()));
  await screen.findByRole('heading', { name: 'Toàn bộ hệ thống' });
  const user = userEvent.setup();
  await user.selectOptions(
    screen.getByLabelText('Phân nhóm mới nhất trong kỳ'),
    'legacy:1.0.0:cluster:1',
  );
  await user.selectOptions(screen.getByLabelText('Mô hình phân nhóm'), '2.0.0-snapshot-k3');
  expect(screen.getByLabelText('Phân nhóm mới nhất trong kỳ')).toHaveValue('');
});

it('date pair is validated before submitting and raw errors are never rendered', async () => {
  const { fetcher } = await setup(async () => ok(fixture()));
  await screen.findByRole('heading', { name: 'Toàn bộ hệ thống' });
  const user = userEvent.setup();
  // Date input is a browser native control, not locale-based string parsing.
  const input = screen.getByLabelText('Từ ngày · TP.HCM');
  fireEvent.change(input, { target: { value: '2026-10-01' } });
  await user.click(screen.getByRole('button', { name: 'Áp dụng bộ lọc' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Nhập cả hai ngày TP.HCM');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('share zero differs from missing denominator and segment IDs are not class IDs', () => {
  expect(percent(0)).toBe('0%');
  expect(percent(null)).toBe('Chưa có tỷ lệ');
  expect(segmentsFor('1.0.0')).toEqual([
    'legacy:1.0.0:cluster:0',
    'legacy:1.0.0:cluster:1',
    'legacy:1.0.0:cluster:2',
  ]);
  expect(segmentsFor('2.0.0-snapshot-k3')).toEqual([
    'engagement_low',
    'engagement_medium',
    'engagement_high',
  ]);
});

it('always requests Vietnam calendar buckets and displays the real local instant', async () => {
  const { fetcher } = await setup(async () => ok(fixture()));
  await screen.findByRole('heading', { name: 'Toàn bộ hệ thống' });
  expect(
    fetcher.mock.calls.some(([url]) => String(url).includes('timezone=Asia%2FHo_Chi_Minh')),
  ).toBe(true);
  expect(screen.getByText(/KỲ ĐANG HIỂN THỊ/)).toHaveTextContent('TP.HCM');
});
