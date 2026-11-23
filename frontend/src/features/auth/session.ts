import type { AccountUser, Capability, AuthState, AccountsOptions, AccountReply } from './accounts';
import { accountCredentials, validateIdentity } from './accounts';
import type { WorkspaceRole } from '../../api/client';
import { ApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';

export type SessionSnapshot = {
  status: 'disconnected' | 'connecting' | 'connected';
  mode: 'local' | 'secured' | 'accounts' | null;
  authState?: AuthState;
  user?: AccountUser | null;
  capabilities?: readonly Capability[];
  notice?: string;
  role: WorkspaceRole | null;
  revision: number;
};

export class WorkspaceSession {
  #token: string | null = null;
  private snapshot: SessionSnapshot = {
    status: 'disconnected',
    mode: null,
    role: null,
    revision: 0,
  };
  private readonly listeners = new Set<() => void>();
  private readonly clearCache: () => void;
  private connectionController: AbortController | null = null;
  readonly client: ApiClient;
  readonly accountMode: boolean;
  #nonce: string | null = null;
  #operation = 0;
  private channel: BroadcastChannel | null = null;
  private focusCheck: Promise<void> | null = null;
  private readonly onFocus = () => {
    if (
      !this.accountMode ||
      document.visibilityState !== 'visible' ||
      this.focusCheck ||
      this.snapshot.status === 'connecting'
    )
      return;
    // Native file dialogs also return window focus: an unchanged session must
    // not remount forms or clear their selected files.
    this.focusCheck = (
      this.snapshot.status === 'connected' ? this.recheckOnFocus() : this.restore()
    )
      .catch(() => {})
      .finally(() => {
        this.focusCheck = null;
      });
  };
  constructor(
    baseUrl: string,
    clearCache: () => void,
    fetcher: typeof fetch = fetch,
    options?: AccountsOptions,
  ) {
    this.clearCache = clearCache;
    this.accountMode = options?.profile === 'accounts';
    // Hold protected routes until the initial cookie session has been checked.
    if (this.accountMode)
      this.snapshot = {
        ...this.snapshot,
        status: 'connecting',
        mode: 'accounts',
        authState: 'restoring',
        user: null,
        capabilities: [],
      };
    this.client = new ApiClient(
      baseUrl,
      () => this.#token,
      () =>
        this.accountMode
          ? this.anonymous('Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.')
          : this.disconnect(),
      fetcher,
      this.accountMode
        ? {
            credentials: accountCredentials(baseUrl, options?.trustedApiOrigin),
            getNonce: () => this.#nonce,
            getRevision: () => this.snapshot.revision,
          }
        : undefined,
    );
    if (this.accountMode) {
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel('mkeai-session');
        this.channel.onmessage = (event: MessageEvent<unknown>) => {
          if (
            event.data === 'logout' ||
            event.data === 'session-change' ||
            event.data === 'role-refresh'
          ) {
            this.anonymous('Phiên đã thay đổi ở thẻ khác.');
            void this.restore().catch(() => {});
          }
        };
      }
      window.addEventListener('focus', this.onFocus);
      document.addEventListener('visibilitychange', this.onFocus);
    }
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  private update(value: Partial<SessionSnapshot>) {
    this.snapshot = { ...this.snapshot, ...value };
    this.listeners.forEach((listener) => listener());
  }
  disconnect = () => {
    if (this.accountMode) {
      this.anonymous();
      return;
    }
    this.connectionController?.abort();
    this.connectionController = null;
    this.#token = null;
    this.clearCache();
    this.update({
      status: 'disconnected',
      mode: null,
      role: null,
      revision: this.snapshot.revision + 1,
    });
  };
  async connect(mode: 'local' | 'secured', token: string) {
    if (this.accountMode) throw new ApiError('configuration');
    this.disconnect();
    if (mode === 'secured' && !/^[A-Za-z0-9_-]{43,128}$/.test(token))
      throw new ApiError('http', 401);
    this.#token = mode === 'secured' ? token : null;
    const controller = new AbortController();
    this.connectionController = controller;
    this.update({ status: 'connecting', mode });
    try {
      // Read-only protected endpoint: a successful liveness call cannot validate credentials.
      const response = await this.client.request('get', '/api/v1/model-info', {
        signal: controller.signal,
      });
      if (!response.data || !Array.isArray(response.data.models)) throw new ApiError('protocol');
      if (controller.signal.aborted) throw new ApiError('cancelled');
      if (mode === 'secured' && (response.meta.profile !== 'secured' || !response.meta.role))
        throw new ApiError('protocol');
      if (mode === 'local' && response.meta.profile === 'secured') throw new ApiError('protocol');
      this.update({
        status: 'connected',
        mode,
        role: mode === 'secured' ? response.meta.role : null,
      });
    } catch (error) {
      if (this.connectionController === controller) this.disconnect();
      throw error;
    } finally {
      if (this.connectionController === controller) this.connectionController = null;
    }
  }

  private begin(authState: AuthState) {
    this.#operation++;
    this.client.cancelAll();
    this.clearCache();
    this.update({
      mode: 'accounts',
      status: 'connecting',
      authState,
      user: null,
      role: null,
      capabilities: [],
      notice: '',
      revision: this.snapshot.revision + 1,
    });
    return this.#operation;
  }
  private anonymous(notice = '') {
    this.#nonce = null;
    this.begin('anonymous');
    this.update({ status: 'disconnected', notice });
  }
  private accept(reply: AccountReply) {
    validateIdentity(reply);
    this.update({
      status: 'connected',
      authState: reply.user.must_change_password ? 'password_change_required' : 'authenticated',
      user: Object.freeze({ ...reply.user }),
      capabilities: Object.freeze([...reply.capabilities]),
      notice: '',
    });
  }
  private ensure(operation: number) {
    if (operation !== this.#operation) throw new ApiError('cancelled');
  }
  private async bootstrap() {
    const result = await this.client.request('get', '/api/v1/auth/csrf', {
      headers: { 'X-Requested-With': 'MK-eAI' },
    });
    if (!/^[A-Za-z0-9_-]{43}$/.test(result.data?.csrf_token)) throw new ApiError('protocol');
    this.#nonce = result.data.csrf_token;
    return result.data;
  }
  private async recheckOnFocus() {
    const operation = this.#operation;
    const previous = this.snapshot;
    try {
      const response = await this.client.request('get', '/api/v1/auth/me');
      this.ensure(operation);
      const checked = validateIdentity(response.data);
      const csrf = await this.client.request('get', '/api/v1/auth/csrf', {
        headers: { 'X-Requested-With': 'MK-eAI' },
      });
      this.ensure(operation);
      if (
        checked.user.id !== previous.user?.id ||
        checked.user.role !== previous.user?.role ||
        checked.user.row_version !== previous.user?.row_version ||
        checked.user.must_change_password !== previous.user?.must_change_password ||
        JSON.stringify([...checked.capabilities].sort()) !==
          JSON.stringify([...(previous.capabilities ?? [])].sort()) ||
        csrf.data.state !== 'authenticated' ||
        csrf.data.csrf_token !== this.#nonce
      )
        await this.restore();
    } catch (error) {
      if (operation === this.#operation) {
        this.#nonce = null;
        this.begin('restoring');
        this.update({
          status: 'disconnected',
          authState: 'session_unknown',
          notice: 'Chưa thể xác minh phiên. Kiểm tra kết nối rồi thử lại.',
        });
      }
      throw error;
    }
  }
  async restore() {
    if (!this.accountMode) throw new ApiError('configuration');
    const operation = this.begin('restoring');
    this.#nonce = null;
    try {
      const first = await this.client.request('get', '/api/v1/auth/me');
      this.ensure(operation);
      validateIdentity(first.data);
      const csrf = await this.bootstrap();
      this.ensure(operation);
      if (csrf.state !== 'authenticated') throw new ApiError('protocol');
      const confirmed = await this.client.request('get', '/api/v1/auth/me');
      this.ensure(operation);
      if (
        confirmed.data.user.id !== first.data.user.id ||
        confirmed.data.user.role !== first.data.user.role ||
        confirmed.data.user.row_version !== first.data.user.row_version
      )
        throw new ApiError('protocol');
      this.accept(confirmed.data);
    } catch (error) {
      if (operation === this.#operation) {
        if (error instanceof ApiError && error.status === 401)
          this.anonymous('Vui lòng đăng nhập để tiếp tục.');
        else
          this.update({
            status: 'disconnected',
            authState: 'session_unknown',
            notice: 'Chưa thể xác minh phiên. Kiểm tra kết nối rồi thử lại.',
          });
      }
      throw error;
    }
  }
  async login(username: string, password: string) {
    if (!this.accountMode) throw new ApiError('configuration');
    const operation = this.begin('authenticating');
    this.#nonce = null;
    try {
      await this.bootstrap();
      this.ensure(operation);
      const response = await this.client.request('post', '/api/v1/auth/login', {
        body: { username: username.trim().toLowerCase(), password },
      });
      this.ensure(operation);
      if (!/^[A-Za-z0-9_-]{43}$/.test(response.data.csrf_token)) throw new ApiError('protocol');
      this.#nonce = response.data.csrf_token;
      this.accept(response.data);
      this.channel?.postMessage('session-change');
    } catch (error) {
      if (operation !== this.#operation) throw error;
      if (error instanceof ApiError && error.code === 'ALREADY_AUTHENTICATED') {
        await this.restore();
        return;
      }
      this.update({
        status: 'disconnected',
        authState:
          error instanceof ApiError && error.kind === 'http' && error.status < 500
            ? 'anonymous'
            : 'session_unknown',
      });
      throw error;
    }
  }
  async logout() {
    if (!this.accountMode) throw new ApiError('configuration');
    const operation = this.begin('signing_out');
    try {
      if (!this.#nonce) {
        await this.bootstrap();
        this.ensure(operation);
        throw new ApiError('http', 403, { code: 'CSRF_FAILED' });
      }
      await this.client.request('post', '/api/v1/auth/logout');
      this.ensure(operation);
      this.anonymous('Bạn đã đăng xuất.');
      this.channel?.postMessage('logout');
    } catch (error) {
      if (operation === this.#operation)
        this.update({
          status: 'disconnected',
          authState: 'session_unknown',
          notice:
            'Chưa xác nhận được việc thu hồi phiên. Không tự gửi lại thao tác đăng xuất; hãy kiểm tra phiên trước.',
        });
      throw error;
    }
  }
  async changePassword(current: string, replacement: string) {
    if (!this.accountMode) throw new ApiError('configuration');
    const previous = this.snapshot;
    const operation = this.begin('authenticating');
    try {
      await this.client.request('post', '/api/v1/auth/change-password', {
        body: { current_password: current, new_password: replacement },
      });
      this.ensure(operation);
      this.anonymous('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.');
      this.channel?.postMessage('session-change');
    } catch (error) {
      if (operation === this.#operation) {
        if (error instanceof ApiError && error.kind === 'http' && error.status < 500)
          this.update({
            status: previous.status,
            authState: previous.authState,
            user: previous.user,
            capabilities: previous.capabilities,
          });
        else
          this.update({
            status: 'disconnected',
            authState: 'session_unknown',
            notice:
              'Chưa rõ kết quả đổi mật khẩu. Hãy xác minh phiên hoặc đăng nhập lại; không tự gửi lại.',
          });
      }
      throw error;
    }
  }
  notifyRoleChange() {
    this.channel?.postMessage('role-refresh');
  }
  dispose() {
    this.#operation++;
    this.client.cancelAll();
    this.#token = this.#nonce = null;
    this.clearCache();
    this.channel?.close();
    window.removeEventListener('focus', this.onFocus);
    document.removeEventListener('visibilitychange', this.onFocus);
  }
}
