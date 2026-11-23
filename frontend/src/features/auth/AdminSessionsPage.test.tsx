import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { WorkspaceSession } from './session';
import { WorkspaceContext } from '../../app/context';
import { createQueryClient } from '../../api/query';
import { AppRoutes } from '../../routes/AppRoutes';
import type { AccountReply } from './accounts';
import { checkedSessions } from './adminSessions';

const owned: WorkspaceSession[] = [];
afterEach(() => {
  owned.splice(0).forEach((s) => s.dispose());
});

const admin = {
  id: '11111111-1111-4111-8111-111111111111',
  username: 'fixture.admin',
  display_name: 'Quản trị thử nghiệm',
  role: 'ADMIN',
};
const viewer = {
  id: '22222222-2222-4222-8222-222222222222',
  username: 'fixture.viewer',
  display_name: 'Người xem',
  role: 'VIEWER',
};
const MINE = '33333333-3333-4333-8333-000000000001';
const THEIRS = '33333333-3333-4333-8333-000000000002';
const row = (id: string, user: typeof admin, current: boolean) => ({
  id,
  user,
  created_at: '2026-11-16T01:00:00+00:00',
  last_seen_at: '2026-11-16T02:00:00+00:00',
  expires_at: '2026-11-16T03:00:00+00:00',
  current,
});
const listing = {
  items: [row(MINE, admin, true), row(THEIRS, viewer, false)],
  truncated: false,
  generated_at: '2026-11-16T02:05:00+00:00',
};

function ui(role: 'ADMIN' | 'OPERATOR' | 'VIEWER' = 'ADMIN', revokeStatus = 204) {
  const current = {
    ...admin,
    role,
    is_active: true,
    must_change_password: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    row_version: 1,
    status: 'ACTIVE',
    locked_until: null,
  } as AccountReply['user'];
  const me: AccountReply = {
    user: current,
    capabilities: [
      'dashboard.read',
      'models.read',
      ...(role === 'ADMIN' ? ['users.manage' as const] : []),
    ],
    session: { expires_at: '2099-01-01T00:00:00Z', idle_expires_at: '2099-01-01T00:00:00Z' },
  };
  let revoked = false;
  const response = (data: unknown, status = 200) =>
    status === 204
      ? new Response(null, { status, headers: { 'X-Security-Profile': 'accounts' } })
      : new Response(JSON.stringify(data), {
          status,
          headers: { 'Content-Type': 'application/json', 'X-Security-Profile': 'accounts' },
        });
  const fetcher = vi.fn<typeof fetch>(async (url, init) => {
    const route = new URL(String(url), 'http://test.local').pathname;
    if (route.endsWith('/csrf'))
      return response({
        csrf_token: 'n'.repeat(43),
        state: 'authenticated',
        expires_at: '2099-01-01T00:00:00Z',
      });
    if (route.endsWith('/me')) return response(me);
    if (route.endsWith(`/admin/sessions/${THEIRS}/revoke`) && init?.method === 'POST') {
      if (revokeStatus !== 204)
        return response(
          {
            error: {
              code: revokeStatus === 403 ? 'REAUTH_FAILED' : 'SESSION_NOT_FOUND',
              message: 'x',
              details: [],
              request_id: '44444444-4444-4444-8444-444444444444',
            },
          },
          revokeStatus,
        );
      revoked = true;
      return response(null, 204);
    }
    if (route.endsWith('/admin/sessions'))
      return response(revoked ? { ...listing, items: [listing.items[0]] } : listing);
    return response({ models: [] });
  });
  const queries = createQueryClient();
  const session = new WorkspaceSession('/backend', () => queries.clear(), fetcher, {
    profile: 'accounts',
  });
  owned.push(session);
  render(
    <QueryClientProvider client={queries}>
      <WorkspaceContext.Provider value={session}>
        <MemoryRouter initialEntries={['/admin/sessions']}>
          <AppRoutes />
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
  return fetcher;
}

describe('sessions contract (K13)', () => {
  it('accepts the documented shape and rejects extra or secret fields', () => {
    expect(checkedSessions(listing).items).toHaveLength(2);
    for (const bad of [
      { ...listing, items: [{ ...listing.items[0], token: 'x' }] },
      { ...listing, items: [{ ...listing.items[0], id: 'not-a-uuid' }] },
      { ...listing, items: [listing.items[0], { ...listing.items[1], current: true }] },
      { ...listing, extra: 1 },
    ])
      expect(() => checkedSessions(bad)).toThrow();
  });
});

describe('AdminSessionsPage (K13)', () => {
  it('lists sessions, protects the current one and revokes another after re-authentication', async () => {
    const fetcher = ui();
    const table = await screen.findByRole('region', { name: 'Danh sách phiên đăng nhập' });
    expect(within(table).getByText('Phiên hiện tại của bạn')).toBeInTheDocument();
    expect(within(table).getAllByRole('button', { name: /Thu hồi phiên của/ })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: '2 phiên của 2 người dùng' })).toBeInTheDocument();
    fireEvent.click(
      within(table).getByRole('button', { name: 'Thu hồi phiên của Người xem (fixture.viewer)' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Thu hồi phiên' }));
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
    fireEvent.change(screen.getByLabelText('Mật khẩu quản trị của bạn'), {
      target: { value: 'admin-password-fixture' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Thu hồi phiên' }));
    expect(
      await screen.findByText('Đã thu hồi phiên của Người xem (fixture.viewer).'),
    ).toBeInTheDocument();
    const post = fetcher.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(String(post[0])).toBe(`/backend/api/v1/admin/sessions/${THEIRS}/revoke`);
    expect(JSON.parse(String(post[1]!.body))).toEqual({ admin_password: 'admin-password-fixture' });
    expect(new Headers(post[1]!.headers).get('X-CSRF-Token')).toBe('n'.repeat(43));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: '1 phiên của 1 người dùng' })).toBeInTheDocument(),
    );
  });

  it('keeps the dialog open with a clear message when the session is already gone', async () => {
    ui('ADMIN', 404);
    const table = await screen.findByRole('region', { name: 'Danh sách phiên đăng nhập' });
    fireEvent.click(within(table).getByRole('button', { name: /Thu hồi phiên của/ }));
    fireEvent.change(screen.getByLabelText('Mật khẩu quản trị của bạn'), {
      target: { value: 'admin-password-fixture' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Thu hồi phiên' }));
    expect(await screen.findByText(/Phiên này đã kết thúc hoặc đã bị thu hồi/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thu hồi phiên' })).toBeDisabled();
  });

  it.each(['OPERATOR', 'VIEWER'] as const)(
    '%s cannot open the page or see the link',
    async (role) => {
      const fetcher = ui(role);
      expect(await screen.findByText('Không có quyền truy cập')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Phiên đăng nhập' })).not.toBeInTheDocument();
      expect(fetcher.mock.calls.some(([u]) => String(u).includes('/admin/sessions'))).toBe(false);
    },
  );
});
