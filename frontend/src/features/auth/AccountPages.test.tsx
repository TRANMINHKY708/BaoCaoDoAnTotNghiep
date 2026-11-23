import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { WorkspaceSession } from './session';
import { WorkspaceContext } from '../../app/context';
import { createQueryClient } from '../../api/query';
import { AppRoutes } from '../../routes/AppRoutes';
import type { AccountReply } from './accounts';

const owned: WorkspaceSession[] = [];
afterEach(() => {
  owned.splice(0).forEach((s) => s.dispose());
});
function ui({
  path = '/login',
  role = 'ADMIN',
  connected = false,
  forced = false,
  patchStatus = 200,
  createNetwork = false,
  targetRole = 'VIEWER',
  changeFailure,
}: {
  path?: string;
  role?: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  connected?: boolean;
  forced?: boolean;
  patchStatus?: number;
  createNetwork?: boolean;
  targetRole?: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  changeFailure?: { status: number; code: string };
} = {}) {
  let signed = connected;
  const current: AccountReply['user'] = {
    id: '11111111-1111-4111-8111-111111111111',
    username: 'fixture.admin',
    display_name: 'Quản trị thử nghiệm',
    role,
    is_active: true,
    must_change_password: forced,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    row_version: 1,
    status: 'ACTIVE',
    locked_until: null,
  };
  const other = {
    ...current,
    id: '22222222-2222-4222-8222-222222222222',
    username: 'fixture.other',
    display_name: 'Người dùng khác',
    role: targetRole,
    must_change_password: false,
  };
  const me: AccountReply = {
    user: current,
    capabilities: forced
      ? []
      : [
          'dashboard.read',
          'customers.read',
          'inference.json.run',
          'what_if.preview_compare',
          'history.read',
          'models.read',
          ...(role === 'ADMIN' ? ['users.manage' as const] : []),
        ],
    session: { expires_at: '2099-01-01T00:00:00Z', idle_expires_at: '2099-01-01T00:00:00Z' },
  };
  const response = (data: unknown, status = 200) =>
    new Response(status === 204 ? null : JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'X-Security-Profile': 'accounts',
        ETag: '"au1-' + 'a'.repeat(64) + '"',
      },
    });
  const fetcher = vi.fn<typeof fetch>(async (url, options) => {
    const route = String(url).split('?')[0]!;
    if (route.endsWith('/csrf'))
      return response({
        csrf_token: 'n'.repeat(43),
        state: signed ? 'authenticated' : 'preauth',
        expires_at: '2099-01-01T00:00:00Z',
      });
    if (route.endsWith('/login')) {
      const body = JSON.parse(options!.body as string);
      if (body.password === 'wrong fixture passphrase')
        return response(
          { error: { code: 'UNAUTHORIZED', details: [], message: 'private raw' } },
          401,
        );
      signed = true;
      return response({ ...me, csrf_token: 'x'.repeat(43) });
    }
    if (route.endsWith('/me'))
      return signed
        ? response(me)
        : response({ error: { code: 'UNAUTHORIZED', details: [] } }, 401);
    if (route.endsWith('/change-password') && changeFailure)
      return response(
        { error: { code: changeFailure.code, details: [], message: 'private raw' } },
        changeFailure.status,
      );
    if (route.endsWith('/change-password') || route.endsWith('/logout')) {
      signed = false;
      return response(null, 204);
    }
    if (route.endsWith('/admin/users')) {
      if (options?.method === 'POST') {
        if (createNetwork) throw new Error('private error');
        return response({ ...other, username: 'new.fixture', must_change_password: true }, 201);
      }
      return response({ items: [other], total: 1, limit: 20, offset: 0 });
    }
    if (route.includes('/admin/users/')) {
      if (options?.method === 'PATCH')
        return patchStatus === 200
          ? response(other)
          : response(
              {
                error: {
                  code: patchStatus === 412 ? 'STALE_USER_VERSION' : 'LAST_ADMIN_PROTECTED',
                  details: [],
                },
              },
              patchStatus,
            );
      return response(other);
    }
    if (route.endsWith('/model-info')) return response({ models: [] });
    return response({ items: [], total: 0, offset: 0, limit: 20 });
  });
  const queries = createQueryClient();
  const session = new WorkspaceSession(
    '/backend',
    () => {
      void queries.cancelQueries();
      queries.clear();
    },
    fetcher,
    { profile: 'accounts' },
  );
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
  return { session, fetcher };
}

it('keeps a protected deep link after initial session restoration', async () => {
  ui({ path: '/account', connected: true });
  expect(await screen.findByRole('heading', { name: 'Tài khoản của tôi' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Tổng quan' })).not.toBeInTheDocument();
});

it('Escape closes the mobile navigation even if focus is outside the sidebar', async () => {
  ui({ path: '/account', connected: true });
  await screen.findByRole('heading', { name: 'Tài khoản của tôi' });
  const opener = screen.getByRole('button', { name: 'Mở menu' });
  await userEvent.click(opener);
  expect(opener).toHaveAttribute('aria-expanded', 'true');
  fireEvent.keyDown(document.body, { key: 'Escape' });
  await waitFor(() => expect(opener).toHaveAttribute('aria-expanded', 'false'));
  expect(opener).toHaveFocus();
});

it('login is accessible, has show/hide, no public signup and clears password on failure', async () => {
  ui();
  const user = userEvent.setup();
  const password = await screen.findByLabelText('Mật khẩu');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Đăng nhập' })).not.toBeDisabled());
  expect(password).toHaveAttribute('type', 'password');
  await user.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
  expect(password).toHaveAttribute('type', 'text');
  await user.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }));
  await user.type(screen.getByLabelText('Tên đăng nhập'), 'fixture.admin');
  await user.type(password, 'wrong fixture passphrase');
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
  expect(await screen.findByText(/Tên đăng nhập hoặc mật khẩu chưa đúng/)).toBeInTheDocument();
  expect(password).toHaveValue('');
  expect(screen.queryByRole('link', { name: /Đăng ký/ })).not.toBeInTheDocument();
});
it.each(['OPERATOR', 'VIEWER'] as const)(
  'hides Admin navigation and denies direct Admin route for %s',
  async (role) => {
    ui({ path: '/admin/users', role, connected: true });
    expect(
      await screen.findByRole('heading', { name: 'Không có quyền truy cập' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Quản lý người dùng' })).not.toBeInTheDocument();
  },
);
it('first-password change blocks deep links and confirms new password before sending', async () => {
  const { fetcher } = ui({ path: '/admin/users', role: 'ADMIN', connected: true, forced: true });
  const user = userEvent.setup();
  expect(
    await screen.findByRole('heading', { name: 'Thiết lập mật khẩu của bạn' }),
  ).toBeInTheDocument();
  await user.type(screen.getByLabelText('Mật khẩu hiện tại'), 'an old fixture passphrase');
  await user.type(screen.getByLabelText('Mật khẩu mới'), 'a new fixture passphrase');
  await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'not matching fixture');
  await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu và đăng nhập lại' }));
  expect(await screen.findByText('Mật khẩu xác nhận chưa khớp.')).toBeInTheDocument();
  expect(
    fetcher.mock.calls.filter(([url]) => String(url).endsWith('/change-password')),
  ).toHaveLength(0);
});
it('a new account form never inherits identity or elevated role from the selected account', async () => {
  ui({ path: '/admin/users', connected: true, targetRole: 'ADMIN' });
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Xem tài khoản' }));
  await screen.findByRole('button', { name: 'Chỉnh sửa' });
  await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByLabelText('Tên đăng nhập mới')).toHaveValue('');
  expect(dialog.getByLabelText('Tên hiển thị')).toHaveValue('');
  expect(dialog.getByRole('combobox', { name: 'Vai trò' })).toHaveValue('VIEWER');
  expect(dialog.getByRole('combobox', { name: 'Vai trò' })).not.toBeDisabled();
  expect(dialog.queryByText('fixture.other')).not.toBeInTheDocument();
});

it('Admin creates account with explicit reauth and keeps passwords out of success UI', async () => {
  const { fetcher } = ui({ path: '/admin/users', connected: true });
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Tạo tài khoản' }));
  const dialog = screen.getByRole('dialog');
  await user.type(within(dialog).getByLabelText('Tên đăng nhập mới'), 'new.fixture');
  await user.type(within(dialog).getByLabelText('Tên hiển thị'), 'Tên mới');
  await user.type(
    within(dialog).getByLabelText('Mật khẩu ban đầu'),
    'an initial fixture passphrase',
  );
  await user.type(
    within(dialog).getByLabelText('Xác nhận mật khẩu ban đầu'),
    'an initial fixture passphrase',
  );
  await user.type(
    within(dialog).getByLabelText('Mật khẩu quản trị của bạn'),
    'an admin fixture passphrase',
  );
  await user.click(within(dialog).getByRole('button', { name: 'Xác nhận' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Thao tác đã hoàn tất');
  const sent = fetcher.mock.calls.find(
    ([url, options]) => String(url).endsWith('/admin/users') && options?.method === 'POST',
  );
  expect(sent).toBeDefined();
  expect(new Headers(sent![1]!.headers).get('X-CSRF-Token')).toBe('n'.repeat(43));
  expect(screen.queryByDisplayValue('an initial fixture passphrase')).not.toBeInTheDocument();
});
it.each([412, 409])(
  'Admin handles conflict %i without silent retry or overwrite',
  async (patchStatus) => {
    const { fetcher } = ui({ path: '/admin/users', connected: true, patchStatus });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Xem tài khoản' }));
    await user.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }));
    const dialog = screen.getByRole('dialog');
    await user.clear(within(dialog).getByLabelText('Tên hiển thị'));
    await user.type(within(dialog).getByLabelText('Tên hiển thị'), 'Bản nháp mới');
    await user.type(
      within(dialog).getByLabelText('Mật khẩu quản trị của bạn'),
      'an admin fixture passphrase',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() =>
      expect(fetcher.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(
        1,
      ),
    );
    const mutation = fetcher.mock.calls.find(([, options]) => options?.method === 'PATCH')!;
    expect(new Headers(mutation[1]!.headers).get('If-Match')).toBe('"au1-' + 'a'.repeat(64) + '"');
    expect(
      await within(dialog).findByText(
        patchStatus === 412
          ? /Tài khoản đã thay đổi từ nơi khác. Bản nháp/
          : /Không thể làm mất tài khoản quản trị/,
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Mật khẩu quản trị của bạn')).toHaveValue('');
    if (patchStatus === 412)
      expect(within(dialog).getByRole('button', { name: 'Xác nhận' })).toBeDisabled();
  },
);
it('network create has an uncertain result, blocks retry and does not show success', async () => {
  const { fetcher } = ui({ path: '/admin/users', connected: true, createNetwork: true });
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Tạo tài khoản' }));
  const dialog = screen.getByRole('dialog');
  await user.type(within(dialog).getByLabelText('Tên đăng nhập mới'), 'new.fixture');
  await user.type(within(dialog).getByLabelText('Tên hiển thị'), 'Tên mới');
  await user.type(
    within(dialog).getByLabelText('Mật khẩu ban đầu'),
    'an initial fixture passphrase',
  );
  await user.type(
    within(dialog).getByLabelText('Xác nhận mật khẩu ban đầu'),
    'an initial fixture passphrase',
  );
  await user.type(
    within(dialog).getByLabelText('Mật khẩu quản trị của bạn'),
    'an admin fixture passphrase',
  );
  await user.click(within(dialog).getByRole('button', { name: 'Xác nhận' }));
  expect(await within(dialog).findByText(/Chưa xác nhận kết quả/)).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Xác nhận' })).toBeDisabled();
  expect(
    fetcher.mock.calls.filter(
      ([url, options]) => String(url).endsWith('/admin/users') && options?.method === 'POST',
    ),
  ).toHaveLength(1);
});

it('login explains a too-short password without spending a login attempt', async () => {
  const { fetcher } = ui();
  const user = userEvent.setup();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Đăng nhập' })).not.toBeDisabled());
  await user.type(screen.getByLabelText('Tên đăng nhập'), 'fixture.admin');
  await user.type(screen.getByLabelText('Mật khẩu'), 'abc');
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
  expect(
    await screen.findByText(/Mật khẩu có ít nhất 8 ký tự, bạn mới nhập 3 ký tự/),
  ).toBeInTheDocument();
  expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/login'))).toHaveLength(0);
});
it('wrong login password warns about the temporary lockout', async () => {
  ui();
  const user = userEvent.setup();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Đăng nhập' })).not.toBeDisabled());
  await user.type(screen.getByLabelText('Tên đăng nhập'), 'fixture.admin');
  await user.type(screen.getByLabelText('Mật khẩu'), 'wrong fixture passphrase');
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
  expect(await screen.findByText(/khóa tạm 15 phút/)).toBeInTheDocument();
});
it('new password shows live length and confirmation feedback', async () => {
  ui({ path: '/change-password', connected: true, forced: true });
  const user = userEvent.setup();
  const next = await screen.findByLabelText('Mật khẩu mới');
  expect(screen.queryByText(/Còn thiếu/)).not.toBeInTheDocument();
  await user.type(next, 'abc');
  expect(screen.getByText(/Còn thiếu 5 ký tự \(cần ít nhất 8\)/)).toBeInTheDocument();
  await user.type(next, 'defgh');
  expect(screen.getByText(/Đủ độ dài \(8 ký tự\)/)).toBeInTheDocument();
  await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'abcdefg');
  expect(screen.getByText(/Mật khẩu xác nhận chưa khớp/)).toBeInTheDocument();
  await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'h');
  expect(screen.getByText(/Mật khẩu xác nhận đã khớp/)).toBeInTheDocument();
});
it.each([
  [{ status: 403, code: 'REAUTH_FAILED' }, /Mật khẩu hiện tại chưa đúng\. Nhập sai 5 lần/],
  [{ status: 422, code: 'VALIDATION_ERROR' }, /Mật khẩu mới quá phổ biến/],
])('password change explains the server refusal %#', async (changeFailure, message) => {
  ui({ path: '/change-password', connected: true, forced: true, changeFailure });
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Mật khẩu hiện tại'), 'an old fixture passphrase');
  await user.type(screen.getByLabelText('Mật khẩu mới'), 'a new fixture passphrase');
  await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'a new fixture passphrase');
  await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu và đăng nhập lại' }));
  expect(await screen.findByText(message)).toBeInTheDocument();
});
it('password change rejects a current password shorter than the policy locally', async () => {
  const { fetcher } = ui({ path: '/change-password', connected: true, forced: true });
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Mật khẩu hiện tại'), 'short');
  await user.type(screen.getByLabelText('Mật khẩu mới'), 'a new fixture passphrase');
  await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'a new fixture passphrase');
  await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu và đăng nhập lại' }));
  expect(await screen.findByText(/Mật khẩu hiện tại chưa đúng/)).toBeInTheDocument();
  expect(
    fetcher.mock.calls.filter(([url]) => String(url).endsWith('/change-password')),
  ).toHaveLength(0);
});
