import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate, useSearchParams } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import fixture from '../../test/fixtures/t16_what_if.json';
import { createQueryClient } from '../../api/query';
import { WorkspaceContext, useWorkspace } from '../../app/context';
import { WorkspaceSession } from '../auth/session';
import { contextKey, requestedContext } from '../customer-analysis/contextNavigation';
import type { Snapshot } from '../customers/customers';
import { SnapshotPicker } from './SnapshotPicker';

const customerId = fixture.customer.id;
const otherId = '14000000-0000-4000-8000-000000000099';
const snapshot = { ...fixture.snapshot, customer_id: customerId };
const otherSnapshot = {
  ...snapshot,
  customer_id: otherId,
  id: '14000000-0000-4000-8000-000000000098',
};
const url = (id = customerId, sid = snapshot.id) =>
  `/predictions?customer_id=${id}&snapshot_id=${sid}`;
const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

function Picker({
  initialId,
  initialSnapshotId,
}: {
  initialId: string;
  initialSnapshotId: string;
}) {
  const [picked, setPicked] = useState<Snapshot | null>(null);
  return (
    <>
      <SnapshotPicker
        initialId={initialId}
        initialSnapshotId={initialSnapshotId}
        onPick={setPicked}
        onCustomerChange={() => setPicked(null)}
      />
      <output aria-label="Snapshot được dùng">{picked?.id ?? 'Chưa chọn'}</output>
    </>
  );
}
function Harness() {
  const { revision, status } = useWorkspace();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const context = requestedContext(params);
  return (
    <>
      <button onClick={() => navigate(url(otherId, otherSnapshot.id))}>Đổi URL khách hàng</button>
      <button onClick={() => navigate(-1)}>Quay lại</button>
      <button onClick={() => navigate(1)}>Đi tới</button>
      {status === 'connected' ? (
        <Picker
          key={`${revision}:${contextKey(params)}`}
          initialId={context.customerId}
          initialSnapshotId={context.snapshotId}
        />
      ) : (
        <p>Phiên đã đóng</p>
      )}
    </>
  );
}
async function setup({
  route = url(),
  foreign = false,
  missing = false,
  denied = false,
  delay = false,
} = {}) {
  const query = createQueryClient();
  let release: (() => void) | undefined;
  let removed = missing;
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const address = new URL(String(input), 'http://test.local');
    expect(init?.method ?? 'GET').toBe('GET');
    if (address.pathname.endsWith('/model-info')) return ok({ models: [] });
    if (address.pathname.endsWith('/customers'))
      return ok({
        items: [fixture.customer, { ...fixture.customer, id: otherId, external_id: 'OTHER' }],
        total: 2,
        offset: 0,
        limit: 5,
      });
    const owner = address.pathname.includes(otherId) ? otherId : customerId;
    if (!address.pathname.endsWith('/behaviors'))
      return denied ? ok({}, 403) : ok({ ...fixture.customer, id: owner });
    const deep = address.searchParams.get('limit') === '100';
    if (deep && delay && owner === customerId)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    const item = owner === otherId ? otherSnapshot : snapshot;
    const offset = Number(address.searchParams.get('offset') ?? 0);
    // Requested snapshot is on the second lookup page, not the first picker page.
    const rows = deep
      ? removed
        ? []
        : offset
          ? [{ ...item, customer_id: foreign ? otherId : owner }]
          : [{ ...item, id: '14000000-0000-4000-8000-000000000003' }]
      : removed
        ? []
        : [{ ...item, id: '14000000-0000-4000-8000-000000000003' }];
    return ok({ items: rows, total: !removed ? 2 : 0, offset, limit: deep ? 100 : 5 });
  });
  const session = new WorkspaceSession('/backend', () => query.clear(), fetcher);
  await session.connect('local', '');
  render(
    <QueryClientProvider client={query}>
      <WorkspaceContext.Provider value={session}>
        <MemoryRouter initialEntries={[route]}>
          <Harness />
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
  return {
    query,
    session,
    fetcher,
    release: () => release?.(),
    remove: () => {
      removed = true;
    },
  };
}
it('verifies a requested snapshot across pages, offers a fixed return link and never writes', async () => {
  const { fetcher } = await setup();
  expect(await screen.findByRole('link', { name: 'Về hồ sơ phân tích' })).toHaveAttribute(
    'href',
    `/customers/${customerId}/analysis?snapshot_id=${snapshot.id}`,
  );
  await waitFor(() =>
    expect(screen.getByLabelText('Snapshot được dùng')).toHaveTextContent(snapshot.id),
  );
  expect(fetcher.mock.calls.some(([input]) => String(input).includes('offset=1'))).toBe(true);
});
it.each([
  { foreign: true },
  { missing: true },
  { route: url(customerId, 'wrong-id') },
  { route: url('wrong-id') },
])('refuses invalid/missing/foreign context without fallback: %j', async (options) => {
  await setup(options);
  await waitFor(() => expect(screen.queryByText(/Đang xác minh snapshot/)).not.toBeInTheDocument());
  await screen.findAllByText(/không hợp lệ|Không xác minh|Chưa thể hoàn thành/);
  expect(screen.getByLabelText('Snapshot được dùng')).toHaveTextContent('Chưa chọn');
  expect(screen.queryByRole('link', { name: 'Về hồ sơ phân tích' })).not.toBeInTheDocument();
});
it('shows authorization errors without revealing another customer', async () => {
  await setup({ denied: true });
  await screen.findByText('Chưa thể hoàn thành yêu cầu');
  expect(screen.getByLabelText('Snapshot được dùng')).toHaveTextContent('Chưa chọn');
  expect(screen.queryByText(/Đã xác minh snapshot/)).not.toBeInTheDocument();
});
it('URL change cancels old verification; a late old response cannot replace the new context', async () => {
  const { release } = await setup({ delay: true });
  await screen.findByText('Đang xác minh snapshot trong đường dẫn…');
  fireEvent.click(screen.getByRole('button', { name: 'Đổi URL khách hàng' }));
  await waitFor(() =>
    expect(screen.getByLabelText('Snapshot được dùng')).toHaveTextContent(otherSnapshot.id),
  );
  await act(async () => release());
  expect(screen.getByLabelText('Snapshot được dùng')).toHaveTextContent(otherSnapshot.id);
});
it('browser back/forward restores the requested snapshot after verification', async () => {
  await setup();
  await screen.findByRole('link', { name: 'Về hồ sơ phân tích' });
  fireEvent.click(screen.getByRole('button', { name: 'Đổi URL khách hàng' }));
  await waitFor(() =>
    expect(screen.getByLabelText('Snapshot được dùng')).toHaveTextContent(otherSnapshot.id),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
  await waitFor(() =>
    expect(screen.getByLabelText('Snapshot được dùng')).toHaveTextContent(snapshot.id),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Đi tới' }));
  await waitFor(() =>
    expect(screen.getByLabelText('Snapshot được dùng')).toHaveTextContent(otherSnapshot.id),
  );
});
it('manual customer selection removes the old requested snapshot and return link', async () => {
  await setup();
  await screen.findByRole('link', { name: 'Về hồ sơ phân tích' });
  fireEvent.click(screen.getByRole('button', { name: 'Chọn OTHER' }));
  expect(screen.getByLabelText('Snapshot được dùng')).toHaveTextContent('Chưa chọn');
  expect(screen.queryByRole('link', { name: 'Về hồ sơ phân tích' })).not.toBeInTheDocument();
});
it('a refetch that loses the snapshot clears previously verified data', async () => {
  const { query, remove } = await setup();
  await screen.findByRole('link', { name: 'Về hồ sơ phân tích' });
  remove();
  await act(async () => {
    await query.invalidateQueries({ queryKey: ['requested-snapshot'] });
  });
  await screen.findByText('Không xác minh được snapshot trong đường dẫn');
  expect(screen.getByLabelText('Snapshot được dùng')).toHaveTextContent('Chưa chọn');
  expect(screen.queryByRole('link', { name: 'Về hồ sơ phân tích' })).not.toBeInTheDocument();
});
it('session change while verifying discards the old response without any automatic replay', async () => {
  const { session, release } = await setup({ delay: true });
  await screen.findByText('Đang xác minh snapshot trong đường dẫn…');
  await act(async () => session.disconnect());
  await act(async () => release());
  expect(screen.getByText('Phiên đã đóng')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Về hồ sơ phân tích' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Snapshot được dùng')).not.toBeInTheDocument();
});
