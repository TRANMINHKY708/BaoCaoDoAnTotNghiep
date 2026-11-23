import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { WorkspaceSession } from './session';
import { WorkspaceContext } from '../../app/context';
import { createQueryClient } from '../../api/query';
import { AppRoutes } from '../../routes/AppRoutes';
import type { AccountReply } from './accounts';
import { checkedAuditPage, filtersFrom } from './audit';

const download = vi.fn();
vi.mock('../predictions/csv', () => ({ downloadBlob: (...args: unknown[]) => download(...args) }));

const owned: WorkspaceSession[] = [];
afterEach(() => {
  owned.splice(0).forEach((s) => s.dispose());
});

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const admin = {
  id: ADMIN_ID,
  username: 'fixture.admin',
  display_name: 'Quản trị thử nghiệm',
  role: 'ADMIN',
};
const other = {
  id: OTHER_ID,
  username: 'fixture.other',
  display_name: 'Người dùng khác',
  role: 'VIEWER',
};
const event = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`,
  occurred_at: `2026-11-13T0${n}:00:00+00:00`,
  event_code: 'auth.login',
  category: 'auth',
  outcome: 'success',
  actor: admin,
  subject: admin,
  resource_type: null,
  resource_id: null,
  request_id: '44444444-4444-4444-8444-444444444444',
  ...extra,
});

function ui(path: string, role: 'ADMIN' | 'OPERATOR' | 'VIEWER' = 'ADMIN') {
  const current: AccountReply['user'] = {
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
      headers: {
        'Content-Type': 'application/json',
        'X-Security-Profile': 'accounts',
        ETag: '"au1-' + 'a'.repeat(64) + '"',
      },
    });
  const fetcher = vi.fn<typeof fetch>(async (url) => {
    const full = new URL(String(url), 'http://test.local');
    const route = full.pathname;
    if (route.endsWith('/csrf'))
      return response({
        csrf_token: 'n'.repeat(43),
        state: 'authenticated',
        expires_at: '2099-01-01T00:00:00Z',
      });
    if (route.endsWith('/me')) return response(me);
    if (route.endsWith('/admin/audit-events/export'))
      return new Response('PK-TEST-ONLY', {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition':
            'attachment; filename="MK-eAI-nhat-ky-hoat-dong-20261116-100000.xlsx"',
          'X-Security-Profile': 'accounts',
        },
      });
    if (route.endsWith('/admin/audit-events')) {
      const cursor = full.searchParams.get('cursor');
      if (full.searchParams.get('outcome') === 'denied')
        return response({
          items: [event(5, { outcome: 'denied', actor: null, subject: other })],
          limit: 50,
          next_cursor: null,
          timezone: 'Asia/Ho_Chi_Minh',
        });
      return cursor
        ? response({
            items: [
              event(1, { event_code: 'user.role_changed', category: 'users', subject: other }),
            ],
            limit: 50,
            next_cursor: null,
            timezone: 'Asia/Ho_Chi_Minh',
          })
        : response({
            items: [event(3)],
            limit: 50,
            next_cursor: 'next-page',
            timezone: 'Asia/Ho_Chi_Minh',
          });
    }
    if (route.includes('/admin/users/')) return response({ ...current, ...other });
    if (route.endsWith('/admin/users'))
      return response({ items: [], total: 0, limit: 20, offset: 0 });
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

describe('audit helpers (K8)', () => {
  it('keeps only valid filters from the URL', () => {
    expect(
      filtersFrom(
        new URLSearchParams(
          `user_id=${OTHER_ID}&category=users&outcome=bad&date_from=2026-11-01&date_to=x`,
        ),
      ),
    ).toEqual({ user_id: OTHER_ID, category: 'users', date_from: '2026-11-01' });
  });
  it('rejects pages that leak session or details fields', () => {
    expect(() =>
      checkedAuditPage({ items: [{ ...event(1), session_id: 'x' }], next_cursor: null }),
    ).toThrow();
    expect(() =>
      checkedAuditPage({ items: [{ ...event(1), outcome: 'maybe' }], next_cursor: null }),
    ).toThrow();
    expect(
      checkedAuditPage({ items: [event(1)], limit: 50, next_cursor: null, timezone: 'UTC' }).items,
    ).toHaveLength(1);
  });
});

describe('AdminAuditPage (K8)', () => {
  it('shows events in Vietnamese, loads more by cursor and filters by outcome', async () => {
    const fetcher = ui('/admin/audit');
    const table = await screen.findByRole('region', { name: 'Nhật ký hoạt động' });
    expect(within(table).getByText('Đăng nhập')).toBeInTheDocument();
    expect(within(table).getByText('Thành công')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tải thêm' }));
    expect(await within(table).findByText('Đổi vai trò')).toBeInTheDocument();
    expect(within(table).getByText('Người dùng khác (fixture.other)')).toBeInTheDocument();
    const calls = fetcher.mock.calls
      .map(([u]) => String(u))
      .filter((u) => u.includes('audit-events'));
    expect(calls.some((u) => u.includes('cursor=next-page'))).toBe(true);
    expect(calls.every((u) => u.includes('timezone=Asia%2FHo_Chi_Minh'))).toBe(true);
    fireEvent.change(screen.getByLabelText('Kết quả'), { target: { value: 'denied' } });
    expect(
      await within(await screen.findByRole('region', { name: 'Nhật ký hoạt động' })).findByText(
        'Bị từ chối',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Chưa xác thực')).toBeInTheDocument();
    expect(fetcher.mock.calls.every(([, init]) => (init?.method ?? 'GET') === 'GET')).toBe(true);
  });
  it('filters by person from the user management link', async () => {
    const fetcher = ui(`/admin/audit?user_id=${OTHER_ID}`);
    expect(
      await screen.findByText(/Người dùng khác \(fixture.other\)/, { selector: 'strong' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(fetcher.mock.calls.some(([u]) => String(u).includes(`user_id=${OTHER_ID}`))).toBe(
        true,
      ),
    );
  });
  it.each(['OPERATOR', 'VIEWER'] as const)(
    'denies %s and hides the navigation entry',
    async (role) => {
      const fetcher = ui('/admin/audit', role);
      expect(
        await screen.findByRole('heading', { name: 'Không có quyền truy cập' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Nhật ký hoạt động' })).not.toBeInTheDocument();
      expect(fetcher.mock.calls.some(([u]) => String(u).includes('audit-events'))).toBe(false);
    },
  );
  it('lists the page in the Admin account navigation', async () => {
    ui('/admin/audit');
    const nav = await screen.findByRole('navigation', { name: 'Tài khoản' });
    expect(within(nav).getByRole('link', { name: 'Nhật ký hoạt động' })).toHaveAttribute(
      'href',
      '/admin/audit',
    );
  });
});

describe('audit export (K13)', () => {
  it('downloads Excel with exactly the filters on screen, as a GET without CSRF', async () => {
    download.mockClear();
    const fetcher = ui(`/admin/audit?user_id=${OTHER_ID}&outcome=denied`);
    fireEvent.click(await screen.findByRole('button', { name: 'Xuất Excel' }));
    expect(await screen.findByText('Đã tải tệp Excel theo bộ lọc hiện tại.')).toBeInTheDocument();
    const call = fetcher.mock.calls.find(([u]) => String(u).includes('/audit-events/export'))!;
    const url = new URL(String(call[0]), 'http://test.local');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      user_id: OTHER_ID,
      outcome: 'denied',
      timezone: 'Asia/Ho_Chi_Minh',
    });
    expect(call[1]?.method).toBe('GET');
    expect(call[1]?.body).toBeUndefined();
    expect(new Headers(call[1]?.headers).get('X-CSRF-Token')).toBeNull();
    expect(download.mock.calls[0]![1]).toBe('MK-eAI-nhat-ky-hoat-dong-20261116-100000.xlsx');
  });
});
