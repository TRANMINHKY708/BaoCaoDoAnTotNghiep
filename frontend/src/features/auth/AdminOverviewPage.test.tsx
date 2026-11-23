import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { WorkspaceSession } from './session';
import { WorkspaceContext } from '../../app/context';
import { createQueryClient } from '../../api/query';
import { AppRoutes } from '../../routes/AppRoutes';
import type { AccountReply } from './accounts';
import { checkedOverview } from './adminOverview';

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
const overview = {
  generated_at: '2026-11-16T03:00:00+00:00',
  window_hours: 24,
  users: {
    total: 5,
    active: 4,
    inactive: 1,
    by_role: { ADMIN: 1, OPERATOR: 1, VIEWER: 2 },
    locked: 1,
    must_change_password: 1,
    never_logged_in: 1,
  },
  sessions: { active: 3, users_online: 2 },
  last_24h: {
    logins_succeeded: 7,
    logins_failed: 6,
    user_changes: 2,
    business_writes: 9,
    denied: 6,
  },
  attention: [{ user: viewer, reasons: ['locked'], locked_until: '2026-11-16T03:15:00+00:00' }],
  recent_admin_actions: [
    {
      id: '33333333-3333-4333-8333-000000000001',
      occurred_at: '2026-11-16T02:00:00+00:00',
      event_code: 'user.created',
      outcome: 'success',
      actor: admin,
      subject: viewer,
    },
  ],
  recent_failed_logins: [
    {
      id: '33333333-3333-4333-8333-000000000002',
      occurred_at: '2026-11-16T02:30:00+00:00',
      event_code: 'auth.login',
      outcome: 'denied',
      actor: null,
      subject: viewer,
    },
  ],
};

function ui(
  path: string,
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER' = 'ADMIN',
  body: unknown = overview,
) {
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
  const response = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json', 'X-Security-Profile': 'accounts' },
    });
  const fetcher = vi.fn<typeof fetch>(async (url) => {
    const route = new URL(String(url), 'http://test.local').pathname;
    if (route.endsWith('/csrf'))
      return response({
        csrf_token: 'n'.repeat(43),
        state: 'authenticated',
        expires_at: '2099-01-01T00:00:00Z',
      });
    if (route.endsWith('/me')) return response(me);
    if (route.endsWith('/admin/overview')) return response(body);
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
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
  return fetcher;
}

describe('admin overview contract (K13)', () => {
  it('accepts the documented shape', () => {
    expect(checkedOverview(overview).users.active).toBe(4);
  });
  it('rejects broken counts, unknown reasons and secret-looking keys', () => {
    for (const bad of [
      { ...overview, users: { ...overview.users, active: -1 } },
      { ...overview, sessions: { active: 1 } },
      { ...overview, attention: [{ user: viewer, reasons: ['vip'], locked_until: null }] },
      {
        ...overview,
        recent_failed_logins: [{ ...overview.recent_failed_logins[0], session_id: 'x' }],
      },
      { ...overview, users: { ...overview.users, password_hash: 1 } },
    ])
      expect(() => checkedOverview(bad)).toThrow();
  });
});

describe('AdminOverviewPage (K13)', () => {
  it('shows counts, accounts needing attention and recent events with audit links', async () => {
    const fetcher = ui('/admin/overview');
    expect(await screen.findByRole('heading', { name: 'Tổng quan quản trị' })).toBeInTheDocument();
    const accounts = await screen.findByRole('region', { name: 'Tài khoản và phiên đăng nhập' });
    expect(within(accounts).getByText('Tài khoản đang hoạt động')).toBeInTheDocument();
    expect(within(accounts).getByText(/3 phiên còn hiệu lực/)).toBeInTheDocument();
    const attention = screen.getByRole('region', { name: 'Danh sách tài khoản cần chú ý' });
    expect(within(attention).getByText('Đang bị khóa tạm')).toBeInTheDocument();
    expect(within(attention).getByRole('link', { name: /Người xem/ })).toHaveAttribute(
      'href',
      `/admin/audit?user_id=${viewer.id}`,
    );
    const failed = screen.getByRole('region', { name: 'Danh sách đăng nhập thất bại' });
    expect(within(failed).getByText('Bị từ chối')).toBeInTheDocument();
    const actions = screen.getByRole('region', { name: 'Danh sách thao tác quản trị' });
    expect(within(actions).getByText('Tạo tài khoản')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tổng quan quản trị' })).toBeInTheDocument();
    const calls = fetcher.mock.calls.map(([u, init]): [string, string] => [
      String(u),
      init?.method ?? 'GET',
    ]);
    expect(calls.filter(([u]) => u.includes('/admin/'))).toEqual([
      ['/backend/api/v1/admin/overview', 'GET'],
    ]);
  });

  it.each(['OPERATOR', 'VIEWER'] as const)('%s sees no data and no admin link', async (role) => {
    const fetcher = ui('/admin/overview', role);
    expect(await screen.findByText('Không có quyền truy cập')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tổng quan quản trị' })).not.toBeInTheDocument();
    expect(fetcher.mock.calls.some(([u]) => String(u).includes('/admin/overview'))).toBe(false);
  });

  it('shows a protocol error instead of numbers when the response breaks the contract', async () => {
    ui('/admin/overview', 'ADMIN', { ...overview, sessions: null });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Tài khoản đang hoạt động')).not.toBeInTheDocument();
  });
});
