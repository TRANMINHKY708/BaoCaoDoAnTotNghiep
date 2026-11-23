import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceSession } from './session';
import { accountCredentials, passwordFailure, passwordIssue, safeDestination } from './accounts';
import { ApiError } from '../../api/errors';
import { ApiClient } from '../../api/client';
import type { AccountReply, Capability } from './accounts';
import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceContext } from '../../app/context';
import BulkPage from '../bulk/BulkPage';

export const identity = (
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER' = 'VIEWER',
  forced = false,
): AccountReply => ({
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    username: 'fixture.user',
    display_name: 'Tài khoản kiểm thử',
    role,
    is_active: true,
    must_change_password: forced,
    created_at: '2026-01-01T00:00:00.000000Z',
    updated_at: '2026-01-01T00:00:00.000000Z',
    row_version: 1,
    status: 'ACTIVE',
    locked_until: null,
  },
  capabilities: forced
    ? []
    : [
        'dashboard.read',
        'customers.read',
        'models.read',
        'history.read',
        'inference.json.run',
        'what_if.preview_compare',
        ...(role === 'VIEWER'
          ? []
          : ([
              'customers.write',
              'snapshots.create',
              'analysis.legacy.save',
              'what_if.legacy.save',
              'inference.csv.run',
            ] as Capability[])),
        ...(role === 'ADMIN' ? (['users.manage'] as Capability[]) : []),
      ],
  session: { expires_at: '2099-01-01T00:00:00Z', idle_expires_at: '2099-01-01T00:00:00Z' },
});
const nonce = 'n'.repeat(43),
  nextNonce = 'x'.repeat(43);
export function reply(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Security-Profile': 'accounts' },
  });
}
const errorReply = (code: string, status: number) =>
  reply(
    {
      error: {
        code,
        details: [],
        message: 'DO NOT RENDER RAW',
        request_id: '11111111-1111-4111-8111-111111111111',
      },
    },
    status,
  );
const owned: WorkspaceSession[] = [];
export function accountSession(fetcher: typeof fetch, clear = vi.fn()) {
  const session = new WorkspaceSession('/backend', clear, fetcher, { profile: 'accounts' });
  owned.push(session);
  return session;
}
afterEach(() => {
  owned.splice(0).forEach((s) => s.dispose());
  vi.restoreAllMocks();
});
export function signedFetch(role: 'ADMIN' | 'OPERATOR' | 'VIEWER' = 'VIEWER', forced = false) {
  return vi.fn<typeof fetch>(async (url) => {
    if (String(url).endsWith('/csrf'))
      return reply({
        csrf_token: nonce,
        state: 'authenticated',
        expires_at: '2099-01-01T00:00:00Z',
      });
    if (String(url).endsWith('/login'))
      return reply({ ...identity(role, forced), csrf_token: nextNonce });
    if (String(url).endsWith('/me')) return reply(identity(role, forced));
    if (String(url).endsWith('/logout') || String(url).endsWith('/change-password'))
      return reply(null, 204);
    return reply({});
  });
}

describe('focus revalidation preserves file input only for an unchanged session', () => {
  function focus() {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    fireEvent.focus(window);
  }

  it('keeps the actual selected CSV and enabled read button after a native dialog returns focus', async () => {
    const fetcher = signedFetch('OPERATOR'),
      clear = vi.fn(),
      session = accountSession(fetcher, clear);
    await session.restore();
    const before = session.getSnapshot(),
      clears = clear.mock.calls.length;
    fetcher.mockClear();
    render(
      createElement(
        MemoryRouter,
        null,
        createElement(WorkspaceContext.Provider, { value: session }, createElement(BulkPage)),
      ),
    );
    const input = screen.getByLabelText('Tệp CSV');
    focus();
    expect(screen.getByLabelText('Tệp CSV')).toBe(input);
    fireEvent.change(input, {
      target: { files: [new File(['Age\n43'], 'selected.csv', { type: 'text/csv' })] },
    });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(session.getSnapshot()).toBe(before);
    expect(clear).toHaveBeenCalledTimes(clears);
    expect(screen.getByText(/Đã chọn: selected.csv/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đọc tệp CSV' })).toBeEnabled();
  });

  it('clears protected state when focus detects changed permissions', async () => {
    const fetcher = signedFetch('OPERATOR'),
      session = accountSession(fetcher);
    await session.restore();
    const revision = session.getSnapshot().revision;
    fetcher.mockImplementation(async (url) =>
      String(url).endsWith('/csrf')
        ? reply({ csrf_token: nonce, state: 'authenticated', expires_at: '2099-01-01T00:00:00Z' })
        : reply(identity('VIEWER')),
    );
    focus();
    await vi.waitFor(() => expect(session.getSnapshot().user?.role).toBe('VIEWER'));
    expect(session.getSnapshot().revision).toBeGreaterThan(revision);
    expect(session.getSnapshot().capabilities).not.toContain('inference.csv.run');
  });

  it('clears old state when a different session CSRF credential is detected', async () => {
    const fetcher = signedFetch('OPERATOR'),
      session = accountSession(fetcher);
    await session.restore();
    const revision = session.getSnapshot().revision;
    fetcher.mockImplementation(async (url) =>
      String(url).endsWith('/csrf')
        ? reply({
            csrf_token: nextNonce,
            state: 'authenticated',
            expires_at: '2099-01-01T00:00:00Z',
          })
        : reply(identity('OPERATOR')),
    );
    focus();
    await vi.waitFor(() => {
      expect(session.getSnapshot().status).toBe('connected');
      expect(session.getSnapshot().revision).toBeGreaterThan(revision);
    });
  });

  it.each([401, 'network'] as const)(
    'fails closed on focus revalidation failure %s',
    async (failure) => {
      const fetcher = signedFetch('OPERATOR'),
        session = accountSession(fetcher);
      await session.restore();
      const revision = session.getSnapshot().revision;
      fetcher.mockImplementation(async () => {
        if (failure === 'network') throw new TypeError('fixture network error');
        return errorReply('UNAUTHORIZED', 401);
      });
      focus();
      await vi.waitFor(() => expect(session.getSnapshot().status).toBe('disconnected'));
      expect(session.getSnapshot().user).toBeNull();
      expect(session.getSnapshot().capabilities).toEqual([]);
      expect(session.getSnapshot().revision).toBeGreaterThan(revision);
      expect(session.getSnapshot().authState).toBe(
        failure === 401 ? 'anonymous' : 'session_unknown',
      );
    },
  );
});

describe('accounts session transport', () => {
  it('holds the initial protected route while the cookie session is unverified', () => {
    const session = accountSession(signedFetch());
    expect(session.getSnapshot()).toMatchObject({
      status: 'connecting',
      authState: 'restoring',
      user: null,
    });
  });
  it('multi-tab messages contain no credentials and force cache clearing plus server verification', async () => {
    class Channel {
      static instances: Channel[] = [];
      onmessage: ((event: MessageEvent) => void) | null = null;
      postMessage = vi.fn();
      close = vi.fn();
      constructor() {
        Channel.instances.push(this);
      }
    }
    vi.stubGlobal('BroadcastChannel', Channel);
    try {
      const fetcher = signedFetch(),
        clear = vi.fn(),
        session = accountSession(fetcher, clear);
      await session.login('fixture.user', 'a long fixture passphrase');
      const channel = Channel.instances[0]!;
      expect(channel.postMessage.mock.calls).toEqual([['session-change']]);
      const count = clear.mock.calls.length;
      fetcher.mockResolvedValueOnce(errorReply('UNAUTHORIZED', 401));
      channel.onmessage?.(new MessageEvent('message', { data: 'logout' }));
      expect(session.getSnapshot().user).toBeNull();
      await vi.waitFor(() => expect(session.getSnapshot().authState).toBe('anonymous'));
      expect(clear.mock.calls.length).toBeGreaterThan(count);
      expect(fetcher.mock.calls.at(-1)![0]).toBe('/backend/api/v1/auth/me');
      channel.onmessage?.(new MessageEvent('message', { data: { role: 'ADMIN' } }));
      expect(session.getSnapshot().user).toBeNull();
      // No active nonce remains after the simulated server revocation.
      await expect(session.logout()).rejects.toMatchObject({ code: 'CSRF_FAILED' });
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('bootstraps csrf then logs in with cookie credentials, no Bearer, nonce in RAM only', async () => {
    const fetcher = signedFetch('ADMIN'),
      session = accountSession(fetcher);
    await session.login(' Fixture.User ', 'a long fixture passphrase');
    expect(session.getSnapshot()).toMatchObject({
      status: 'connected',
      mode: 'accounts',
      authState: 'authenticated',
      user: { role: 'ADMIN' },
    });
    const first = fetcher.mock.calls[0]![1]!;
    expect(new Headers(first.headers).get('X-Requested-With')).toBe('MK-eAI');
    const login = fetcher.mock.calls[1]![1]!;
    expect(login.credentials).toBe('same-origin');
    expect(new Headers(login.headers).get('Authorization')).toBeNull();
    expect(new Headers(login.headers).get('X-CSRF-Token')).toBe(nonce);
    expect(JSON.parse(login.body as string).username).toBe('fixture.user');
    expect(JSON.stringify(session)).not.toContain(nonce);
    expect(JSON.stringify(session.getSnapshot())).not.toContain(nextNonce);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
  it('restores me and confirms identity with csrf before releasing data', async () => {
    const fetcher = signedFetch(),
      session = accountSession(fetcher);
    const pending = session.restore();
    expect(session.getSnapshot().user).toBeNull();
    await pending;
    expect(fetcher.mock.calls.map((c) => String(c[0]).split('/').at(-1))).toEqual([
      'me',
      'csrf',
      'me',
    ]);
    expect(session.getSnapshot().authState).toBe('authenticated');
  });
  it('keeps first-change capabilities empty and requires fresh login after password change', async () => {
    const fetcher = signedFetch('OPERATOR', true),
      session = accountSession(fetcher);
    await session.login('fixture.user', 'a long fixture passphrase');
    expect(session.getSnapshot()).toMatchObject({
      authState: 'password_change_required',
      capabilities: [],
    });
    await session.changePassword('a long fixture passphrase', 'a brand new fixture passphrase');
    expect(session.getSnapshot()).toMatchObject({
      authState: 'anonymous',
      user: null,
      capabilities: [],
    });
  });
  it('401 login remains a form failure; protected 401 clears sensitive cache and nonce', async () => {
    const fetcher = signedFetch(),
      clear = vi.fn(),
      session = accountSession(fetcher, clear);
    fetcher
      .mockImplementationOnce(async () =>
        reply({ csrf_token: nonce, state: 'preauth', expires_at: '2099-01-01T00:00:00Z' }),
      )
      .mockImplementationOnce(async () => errorReply('UNAUTHORIZED', 401));
    await expect(session.login('fixture.user', 'a wrong fixture passphrase')).rejects.toMatchObject(
      { status: 401 },
    );
    expect(session.getSnapshot().authState).toBe('anonymous');
    await session.login('fixture.user', 'a long fixture passphrase');
    fetcher.mockImplementationOnce(async () => errorReply('UNAUTHORIZED', 401));
    await expect(session.client.request('get', '/api/v1/model-info')).rejects.toMatchObject({
      status: 401,
    });
    expect(session.getSnapshot()).toMatchObject({ authState: 'anonymous', user: null });
    expect(clear).toHaveBeenCalled();
  });
  it('403 does not logout or downgrade; uses safe auth error messages', async () => {
    const fetcher = signedFetch(),
      session = accountSession(fetcher);
    await session.login('fixture.user', 'a long fixture passphrase');
    fetcher.mockImplementationOnce(async () => errorReply('CSRF_FAILED', 403));
    await expect(session.client.request('post', '/api/v1/what-if/preview')).rejects.toMatchObject({
      status: 403,
      code: 'CSRF_FAILED',
    });
    expect(session.getSnapshot().status).toBe('connected');
    expect(session.getSnapshot().mode).toBe('accounts');
  });
  it('network logout stays unknown and never claims server revocation or retries', async () => {
    const fetcher = signedFetch(),
      session = accountSession(fetcher);
    await session.login('fixture.user', 'a long fixture passphrase');
    fetcher.mockRejectedValueOnce(new Error('private wire details'));
    const count = fetcher.mock.calls.length;
    await expect(session.logout()).rejects.toMatchObject({ kind: 'network' });
    expect(fetcher.mock.calls.length - count).toBe(1);
    expect(session.getSnapshot()).toMatchObject({
      authState: 'session_unknown',
      user: null,
      capabilities: [],
    });
  });
  it('successful logout clears local data and cookie session is revoked only by backend', async () => {
    const fetcher = signedFetch(),
      session = accountSession(fetcher);
    await session.login('fixture.user', 'a long fixture passphrase');
    await session.logout();
    expect(session.getSnapshot()).toMatchObject({ authState: 'anonymous', user: null });
    expect(new Headers(fetcher.mock.calls.at(-1)![1]!.headers).get('X-CSRF-Token')).toBe(nextNonce);
  });
  it('does not retry logout when no nonce exists', async () => {
    const fetcher = signedFetch(),
      session = accountSession(fetcher);
    await expect(session.logout()).rejects.toMatchObject({ code: 'CSRF_FAILED' });
    expect(fetcher.mock.calls.map((c) => String(c[0]).split('/').at(-1))).toEqual(['csrf']);
    expect(session.getSnapshot().authState).toBe('session_unknown');
  });
  it('revalidates existing account on ALREADY_AUTHENTICATED instead of switching identity', async () => {
    const fetcher = signedFetch(),
      session = accountSession(fetcher);
    fetcher
      .mockImplementationOnce(async () =>
        reply({ csrf_token: nonce, state: 'authenticated', expires_at: '2099-01-01T00:00:00Z' }),
      )
      .mockImplementationOnce(async () => errorReply('ALREADY_AUTHENTICATED', 409));
    await session.login('other.user', 'a long fixture passphrase');
    expect(session.getSnapshot().user?.username).toBe('fixture.user');
  });
  it('unknown backend profile never falls back to local/shared Bearer', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Security-Profile': 'secured' },
      }),
    );
    const session = accountSession(fetcher);
    await expect(session.restore()).rejects.toMatchObject({ kind: 'protocol' });
    expect(session.getSnapshot()).toMatchObject({ mode: 'accounts', authState: 'session_unknown' });
    await expect(session.connect('local', '')).rejects.toMatchObject({ kind: 'configuration' });
  });
  it('late response cannot repopulate a cleared user or cache', async () => {
    const fetcher = signedFetch(),
      session = accountSession(fetcher);
    await session.login('fixture.user', 'a long fixture passphrase');
    let resolve!: (value: Response) => void;
    fetcher.mockImplementationOnce(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    const pending = session.client.request('get', '/api/v1/model-info');
    session.disconnect();
    resolve(reply({ models: [] }));
    await expect(pending).rejects.toMatchObject({ kind: 'cancelled' });
    expect(session.getSnapshot().user).toBeNull();
  });
  it('does not render identity A when restore confirms identity B', async () => {
    const fetcher = signedFetch(),
      session = accountSession(fetcher),
      other = identity();
    other.user.id = '22222222-2222-4222-8222-222222222222';
    fetcher
      .mockImplementationOnce(async () => reply(identity()))
      .mockImplementationOnce(async () =>
        reply({ csrf_token: nonce, state: 'authenticated', expires_at: '2099-01-01T00:00:00Z' }),
      )
      .mockImplementationOnce(async () => reply(other));
    await expect(session.restore()).rejects.toMatchObject({ kind: 'protocol' });
    expect(session.getSnapshot()).toMatchObject({ user: null, authState: 'session_unknown' });
  });
  it('multipart CSV sends same cookie/nonce and lets browser create boundary', async () => {
    const fetcher = signedFetch('OPERATOR'),
      session = accountSession(fetcher);
    await session.login('fixture.user', 'a long fixture passphrase');
    fetcher.mockResolvedValueOnce(
      new Response('result\nHigh', {
        headers: {
          'Content-Type': 'text/csv',
          'X-Model-Version': '1.0.0',
          'X-Security-Profile': 'accounts',
        },
      }),
    );
    await session.client.requestPurchaseCsv(
      new File(['Age\n20'], 'fixture.csv', { type: 'text/csv' }),
      { modelVersion: '1.0.0', saveResults: false },
    );
    const options = fetcher.mock.calls.at(-1)![1]!;
    expect(options.credentials).toBe('same-origin');
    expect(new Headers(options.headers).get('X-CSRF-Token')).toBe(nextNonce);
    expect(new Headers(options.headers).has('Content-Type')).toBe(false);
  });
  it.each([
    '/api/v1/customers',
    '/api/v1/customers/{customer_id}/behaviors',
    '/api/v1/predict/purchase-level',
    '/api/v1/predict/batch/purchase-level',
    '/api/v1/predict/segment',
    '/api/v1/what-if/preview',
    '/api/v1/what-if',
    '/api/v1/what-if/scenarios',
  ] as const)('central transport protects %s', async (path) => {
    const fetcher = signedFetch('OPERATOR'),
      session = accountSession(fetcher);
    await session.login('fixture.user', 'a long fixture passphrase');
    const transport = session.client as ApiClient;
    await transport.request('post', path, {
      params: { customer_id: '11111111-1111-4111-8111-111111111111' },
      headers: { Authorization: 'Bearer forged', 'X-CSRF-Token': 'forged' },
    } as never);
    const headers = new Headers(fetcher.mock.calls.at(-1)![1]!.headers);
    expect(headers.get('Authorization')).toBeNull();
    expect(headers.get('X-CSRF-Token')).toBe(nextNonce);
  });
});

describe('accounts input boundaries', () => {
  it.each([
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/login',
    '/%2f%2fevil.test',
    'javascript:bad',
  ])('rejects redirect %s', (path) => expect(safeDestination(path)).toBe('/dashboard'));
  it('allows an internal intended route', () =>
    expect(safeDestination('/customers/fixture?tab=history')).toBe(
      '/customers/fixture?tab=history',
    ));
  it('permits only approved same-site cross-origin transport', () => {
    expect(accountCredentials('/backend')).toBe('same-origin');
    const here = new URL(window.location.origin);
    const other = `${here.protocol}//${here.hostname}:8765`;
    expect(accountCredentials(other, other)).toBe('include');
    expect(() => accountCredentials('https://evil.test', 'https://evil.test')).toThrow();
    expect(() => accountCredentials(other)).toThrow();
  });
  it.each(['x'.repeat(7), 'x'.repeat(129), ' '.repeat(15), 'é'.repeat(7)])(
    'validates password bounds without trimming',
    (value) => expect(passwordIssue(value)).not.toBe(''),
  );
  it('allows spaces and NFC within password bounds', () => {
    expect(passwordIssue('a very long passphrase')).toBe('');
    expect(passwordIssue('e\u0301'.repeat(8))).toBe('');
    expect(passwordIssue('x'.repeat(8))).toBe('');
  });
});

describe('K18 password messages', () => {
  const http = (status: number, code: string) => new ApiError('http', status, { code });
  it('reports the exact shortfall and the other bounds', () => {
    expect(passwordIssue('abc')).toBe('Mật khẩu cần ít nhất 8 ký tự (bạn mới nhập 3 ký tự).');
    expect(passwordIssue(' '.repeat(9))).toBe('Mật khẩu không được chỉ có khoảng trắng.');
    expect(passwordIssue('x'.repeat(129))).toBe('Mật khẩu dài quá 128 ký tự.');
  });
  it('maps server refusals per form and ignores unrelated errors', () => {
    expect(passwordFailure(http(401, 'UNAUTHORIZED'), 'login')).toMatch(
      /chưa đúng.*khóa tạm 15 phút/,
    );
    expect(passwordFailure(http(429, 'RATE_LIMITED'), 'login')).toMatch(/quá nhiều lần/);
    expect(passwordFailure(http(403, 'REAUTH_FAILED'), 'change')).toMatch(
      /^Mật khẩu hiện tại chưa đúng/,
    );
    expect(passwordFailure(http(403, 'REAUTH_FAILED'), 'admin')).toMatch(/^Mật khẩu quản trị/);
    expect(passwordFailure(http(422, 'VALIDATION_ERROR'), 'change')).toMatch(/quá phổ biến/);
    expect(passwordFailure(http(409, 'USERNAME_UNAVAILABLE'), 'admin')).toBe('');
    expect(passwordFailure(new ApiError('network'), 'login')).toBe('');
    expect(passwordFailure(new Error('x'), 'change')).toBe('');
  });
});
