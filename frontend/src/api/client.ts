import type { paths } from './generated';
import type { InsightEnvelope } from '../features/bulk-analytics/insights';
import { ApiError, httpError } from './errors';
import type { ReportRequest } from './reports';
import type {
  BatchAction,
  BatchExport,
  BatchFilters,
  BatchNarrative,
  BatchOptions,
  BatchView,
} from '../features/bulk-analytics/types';
import type { BulkSteps } from '../features/bulk/types';
import type { ImportDetail, ImportIntent, ImportJob } from '../features/bulk/importTypes';
import type { AnalysisDetail, AnalysisJob, AnalysisTask } from '../features/bulk/analysisTypes';

type Method = 'get' | 'post' | 'patch' | 'delete';
type Path<M extends Method> = {
  [P in keyof paths]: P extends `/api/v1/${string}`
    ? M extends keyof paths[P]
      ? paths[P][M] extends undefined
        ? never
        : P
      : never
    : never;
}[keyof paths];
type Op<M extends Method, P extends Path<M>> = M extends keyof paths[P] ? paths[P][M] : never;
type Content<T> = T extends { content: { 'application/json': infer J } } ? J : never;
type Success<O> = O extends { responses: infer R }
  ? { [S in keyof R]: S extends 200 | 201 | 204 ? Content<R[S]> : never }[keyof R]
  : never;
type Body<O> = O extends { requestBody: infer B } ? Content<B> : never;
type Query<O> = O extends { parameters: { query?: infer Q } } ? Q : never;
type Params<O> = O extends { parameters: { path: infer P } } ? P : never;
export type WorkspaceRole = 'viewer' | 'operator';
export type AccountsTransport = {
  credentials: 'same-origin' | 'include';
  getNonce: () => string | null;
  getRevision: () => number;
};
export type ResponseMeta = {
  analysisReceipt?: string | null;
  role: WorkspaceRole | null;
  profile: string | null;
  etag: string | null;
};
type RequestOptions<M extends Method, P extends Path<M>> = {
  body?: Body<Op<M, P>>;
  query?: Query<Op<M, P>>;
  params?: Params<Op<M, P>>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export function normalizeBaseUrl(value: string): string {
  if (!value || value.includes('?') || value.includes('#') || value.startsWith('//'))
    throw new ApiError('configuration');
  if (value.startsWith('/') && !value.includes('\\')) return value.replace(/\/$/, '');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError('configuration');
  }
  if (url.username || url.password || !['https:', 'http:'].includes(url.protocol))
    throw new ApiError('configuration');
  if (url.protocol === 'http:' && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw new ApiError('configuration');
  return url.toString().replace(/\/$/, '');
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly getToken: () => string | null;
  private readonly onUnauthorized: () => void;
  private readonly fetcher: typeof fetch;
  private readonly active = new Set<AbortController>();
  constructor(
    baseUrl: string,
    getToken: () => string | null = () => null,
    onUnauthorized = () => {},
    fetcher: typeof fetch = fetch,
    private readonly accounts?: AccountsTransport,
  ) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.getToken = getToken;
    this.onUnauthorized = onUnauthorized;
    // Also covers native fetch forwarded by WorkspaceSession or another caller.
    this.fetcher = fetcher.bind(globalThis);
  }
  cancelAll() {
    this.active.forEach((controller) => controller.abort());
    this.active.clear();
  }
  private prepare(headers: Headers, unsafe: boolean) {
    headers.delete('Authorization');
    headers.delete('Cookie');
    headers.delete('X-Workspace-Role');
    if (this.accounts) {
      headers.delete('X-CSRF-Token');
      const nonce = this.accounts.getNonce();
      if (unsafe && nonce) headers.set('X-CSRF-Token', nonce);
    } else {
      const token = this.getToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }
  }
  async requestReport(
    body: ReportRequest | BatchExport,
    options: { signal?: AbortSignal } = {},
  ): Promise<{ blob: Blob; filename: string }> {
    const exportPath =
      body.source === 'batch_analytics'
        ? '/api/v1/bulk/analytics/export'
        : '/api/v1/reports/export';
    return this.download('POST', exportPath, body, body.format, options);
  }
  /** K13 audit-log workbook (Admin only): a GET with the log's own filters, no body and no CSRF. */
  async exportAuditLog(
    query: Record<string, string | undefined>,
    options: { signal?: AbortSignal } = {},
  ): Promise<{ blob: Blob; filename: string }> {
    const params = new URLSearchParams();
    for (const [name, value] of Object.entries(query)) if (value) params.set(name, value);
    const suffix = params.size ? `?${params.toString()}` : '';
    return this.download(
      'GET',
      `/api/v1/admin/audit-events/export${suffix}`,
      undefined,
      'xlsx',
      options,
    );
  }
  /** Shared binary download: same credential, revision, timeout and file checks for every export. */
  private async download(
    method: 'GET' | 'POST',
    path: string,
    body: unknown,
    format: 'pdf' | 'xlsx',
    options: { signal?: AbortSignal },
  ): Promise<{ blob: Blob; filename: string }> {
    const controller = new AbortController();
    this.active.add(controller);
    const revision = this.accounts?.getRevision(),
      token = this.getToken();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 60000);
    const cancel = () => controller.abort();
    options.signal?.addEventListener('abort', cancel, { once: true });
    if (options.signal?.aborted) controller.abort();
    const current = () => {
      if (
        controller.signal.aborted ||
        this.getToken() !== token ||
        (this.accounts && revision !== this.accounts.getRevision())
      )
        throw new ApiError(timedOut ? 'timeout' : 'cancelled');
    };
    try {
      current();
      const headers = new Headers(method === 'POST' ? { 'Content-Type': 'application/json' } : {});
      this.prepare(headers, method === 'POST');
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        method,
        ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
        headers,
        credentials: this.accounts?.credentials ?? 'omit',
        signal: controller.signal,
        redirect: 'error',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      });
      current();
      if (this.accounts && response.headers.get('X-Security-Profile') !== 'accounts')
        throw new ApiError('protocol');
      if (!response.ok) {
        let safe: unknown = null;
        try {
          if (response.headers.get('Content-Type')?.includes('application/json'))
            safe = await response.json();
        } catch {
          /* never echo raw errors */
        }
        current();
        if (response.status === 401) this.onUnauthorized();
        throw httpError(response, safe);
      }
      const mime =
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const filename = /filename="(MK-eAI-[a-z0-9-]+\.(pdf|xlsx))"/.exec(
        response.headers.get('Content-Disposition') ?? '',
      )?.[1];
      if (
        !response.headers.get('Content-Type')?.startsWith(mime) ||
        !filename?.endsWith(`.${format}`)
      )
        throw new ApiError('protocol');
      const blob = await response.blob();
      current();
      if (blob.size > 10 * 1024 * 1024 || blob.size < 4) throw new ApiError('protocol');
      return { blob, filename };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted) throw new ApiError(timedOut ? 'timeout' : 'cancelled');
      throw new ApiError('network');
    } finally {
      clearTimeout(timer);
      this.active.delete(controller);
      options.signal?.removeEventListener('abort', cancel);
    }
  }
  /** Dedicated existing CSV operation: same memory credential and cancellation rules. */
  async requestPurchaseCsv(
    file: File,
    options: {
      modelVersion: '1.0.0' | '2.0.0-snapshot-conservative12';
      saveResults: boolean;
      signal?: AbortSignal;
      timeoutMs?: number;
    },
  ): Promise<{ blob: Blob; modelVersion: string }> {
    return this.requestInferenceCsv('purchase-level', file, options);
  }
  async requestSegmentCsv(
    file: File,
    options: {
      modelVersion: '1.0.0' | '2.0.0-snapshot-k3';
      saveResults: boolean;
      signal?: AbortSignal;
      timeoutMs?: number;
    },
  ): Promise<{ blob: Blob; modelVersion: string }> {
    return this.requestInferenceCsv('segment', file, options);
  }
  private async requestInferenceCsv(
    endpoint: 'purchase-level' | 'segment',
    file: File,
    options: {
      modelVersion: string;
      saveResults: boolean;
      signal?: AbortSignal;
      timeoutMs?: number;
    },
  ): Promise<{ blob: Blob; modelVersion: string }> {
    const controller = new AbortController();
    this.active.add(controller);
    const revision = this.accounts?.getRevision();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs ?? 15000);
    const cancel = () => controller.abort();
    options.signal?.addEventListener('abort', cancel, { once: true });
    if (options.signal?.aborted) controller.abort();
    const token = this.getToken();
    const headers = new Headers({ Accept: 'text/csv, application/json' });
    this.prepare(headers, true);
    const body = new FormData();
    body.append('file', file);
    body.append('model_version', options.modelVersion);
    body.append('save_results', String(options.saveResults));
    const current = () => {
      if (
        this.getToken() !== token ||
        (this.accounts && this.accounts.getRevision() !== revision) ||
        controller.signal.aborted
      )
        throw new ApiError(timedOut ? 'timeout' : 'cancelled');
    };
    try {
      current();
      const response = await this.fetcher(`${this.baseUrl}/api/v1/predict/csv/${endpoint}`, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
        credentials: this.accounts?.credentials ?? 'omit',
        redirect: 'error',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      });
      current();
      if (this.accounts && response.headers.get('X-Security-Profile') !== 'accounts')
        throw new ApiError('protocol');
      if (!response.ok) {
        let error: unknown = null;
        try {
          if (response.headers.get('Content-Type')?.includes('application/json'))
            error = await response.json();
        } catch {
          /* Never echo raw errors. */
        }
        current();
        if (response.status === 401) this.onUnauthorized();
        throw httpError(response, error);
      }
      if (
        !response.headers.get('Content-Type')?.toLowerCase().startsWith('text/csv') ||
        response.headers.get('X-Model-Version') !== options.modelVersion
      )
        throw new ApiError('protocol');
      const blob = await response.blob();
      current();
      if (blob.size > 16 * 1024 * 1024) throw new ApiError('protocol');
      return { blob, modelVersion: options.modelVersion };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted) throw new ApiError(timedOut ? 'timeout' : 'cancelled');
      throw new ApiError('network');
    } finally {
      clearTimeout(timer);
      this.active.delete(controller);
      options.signal?.removeEventListener('abort', cancel);
    }
  }
  async request<M extends Method, P extends Path<M>>(
    method: M,
    template: P,
    options: RequestOptions<M, P> = {},
  ): Promise<{ data: Success<Op<M, P>>; meta: ResponseMeta }> {
    return this.transport<Success<Op<M, P>>>(method, template, options);
  }
  async requestBulk<S extends keyof BulkSteps>(
    step: S,
    body: BulkSteps[S]['body'],
    signal?: AbortSignal,
  ): Promise<BulkSteps[S]['response']> {
    if (!['inspect', 'preview', 'prepare-confirmation'].includes(step))
      throw new ApiError('configuration');
    return (
      await this.transport<BulkSteps[S]['response']>('post', `/api/v1/bulk/csv/${step}`, {
        body,
        signal,
        timeoutMs: 30000,
      })
    ).data;
  }
  async confirmImport(body: ImportIntent, signal?: AbortSignal): Promise<ImportJob> {
    return (
      await this.transport<ImportJob>('post', '/api/v1/bulk/imports/confirm', {
        body,
        signal,
        timeoutMs: 120000,
      })
    ).data;
  }
  async listImports(key?: string, signal?: AbortSignal): Promise<{ items: ImportJob[] }> {
    return (
      await this.transport<{ items: ImportJob[] }>('get', '/api/v1/bulk/imports', {
        query: key ? { idempotency_key: key } : {},
        signal,
      })
    ).data;
  }
  async importDetail(id: string, offset = 0, signal?: AbortSignal): Promise<ImportDetail> {
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new ApiError('configuration');
    return (
      await this.transport<ImportDetail>('get', `/api/v1/bulk/imports/${id}`, {
        query: { offset, limit: 50 },
        signal,
      })
    ).data;
  }
  async createAnalysis(
    body: {
      import_job_id: string;
      task: AnalysisTask;
      model_version: string;
      save_results: boolean;
    },
    signal?: AbortSignal,
  ): Promise<AnalysisJob> {
    return (
      await this.transport<AnalysisJob>('post', '/api/v1/bulk/analyses', {
        body,
        signal,
        timeoutMs: 30000,
      })
    ).data;
  }
  async listAnalyses(importJobId: string, signal?: AbortSignal): Promise<{ items: AnalysisJob[] }> {
    if (!/^[a-f0-9-]{36}$/i.test(importJobId)) throw new ApiError('configuration');
    return (
      await this.transport<{ items: AnalysisJob[] }>('get', '/api/v1/bulk/analyses', {
        query: { import_job_id: importJobId },
        signal,
      })
    ).data;
  }
  async analysisDetail(id: string, offset = 0, signal?: AbortSignal): Promise<AnalysisDetail> {
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new ApiError('configuration');
    return (
      await this.transport<AnalysisDetail>('get', `/api/v1/bulk/analyses/${id}`, {
        query: { offset, limit: 50 },
        signal,
      })
    ).data;
  }
  async advanceAnalysis(
    id: string,
    step: 'advance' | 'retry',
    signal?: AbortSignal,
  ): Promise<AnalysisJob> {
    if (!/^[a-f0-9-]{36}$/i.test(id) || !['advance', 'retry'].includes(step))
      throw new ApiError('configuration');
    return (
      await this.transport<AnalysisJob>('post', `/api/v1/bulk/analyses/${id}/${step}`, {
        signal,
        timeoutMs: 30000,
      })
    ).data;
  }
  async batchAnalyticsOptions(importJobId?: string, signal?: AbortSignal): Promise<BatchOptions> {
    return (
      await this.transport<BatchOptions>('get', '/api/v1/bulk/analytics/options', {
        query: { import_job_id: importJobId },
        signal,
      })
    ).data;
  }
  async batchAnalytics(
    filters: BatchFilters,
    offset = 0,
    signal?: AbortSignal,
  ): Promise<BatchView> {
    return (
      await this.transport<BatchView>('get', '/api/v1/bulk/analytics/overview', {
        query: { ...filters, offset, limit: 50 },
        signal,
      })
    ).data;
  }
  async batchAnalyticsInsights(
    filters: BatchFilters,
    fingerprint: string,
    feature?: string,
    signal?: AbortSignal,
  ): Promise<InsightEnvelope> {
    return (
      await this.transport<InsightEnvelope>('get', '/api/v1/bulk/analytics/insights', {
        query: { ...filters, expected_fingerprint: fingerprint, feature_key: feature },
        signal,
      })
    ).data;
  }
  async batchAnalyticsNarrative(body: BatchAction, signal?: AbortSignal): Promise<BatchNarrative> {
    return (
      await this.transport<BatchNarrative>('post', '/api/v1/bulk/analytics/narrative', {
        body,
        signal,
        timeoutMs: 60000,
      })
    ).data;
  }
  /** K9 model usage (read-only aggregation). The caller validates the response. */
  async modelUsage(signal?: AbortSignal): Promise<unknown> {
    return (await this.transport<unknown>('get', '/api/v1/models/usage', { signal })).data;
  }
  /** K13 admin overview (Admin only, read-only). The caller validates the response. */
  async adminOverview(signal?: AbortSignal): Promise<unknown> {
    return (await this.transport<unknown>('get', '/api/v1/admin/overview', { signal })).data;
  }
  /** K13 live sessions (Admin only). The caller validates the response. */
  async adminSessions(signal?: AbortSignal): Promise<unknown> {
    return (await this.transport<unknown>('get', '/api/v1/admin/sessions', { signal })).data;
  }
  /** K13 revoke one session after the Admin re-enters their password (CSRF via transport). */
  async revokeSession(sessionId: string, adminPassword: string): Promise<void> {
    await this.transport<unknown>('post', '/api/v1/admin/sessions/{session_id}/revoke', {
      params: { session_id: sessionId },
      body: { admin_password: adminPassword },
    });
  }
  /** K8 audit log (Admin only, read-only). The caller validates the response. */
  async auditEvents(
    query: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    return (await this.transport<unknown>('get', '/api/v1/admin/audit-events', { query, signal }))
      .data;
  }
  /** K5 churn API: inference only, never persisted. Responses are validated by the caller. */
  async churnModel(signal?: AbortSignal): Promise<unknown> {
    return (await this.transport<unknown>('get', '/api/v1/churn/model', { signal })).data;
  }
  async churnPredict(customer: unknown, explain: boolean, signal?: AbortSignal): Promise<unknown> {
    return (
      await this.transport<unknown>('post', '/api/v1/churn/predict', {
        body: { customer, explain },
        signal,
      })
    ).data;
  }
  async churnBatch(customers: unknown[], signal?: AbortSignal): Promise<unknown> {
    return (
      await this.transport<unknown>('post', '/api/v1/churn/predict/batch', {
        body: { customers },
        signal,
        timeoutMs: 30000,
      })
    ).data;
  }
  private async transport<T>(
    method: Method,
    template: string,
    options: {
      body?: unknown;
      query?: unknown;
      params?: unknown;
      signal?: AbortSignal;
      headers?: Record<string, string>;
      timeoutMs?: number;
    },
  ): Promise<{ data: T; meta: ResponseMeta }> {
    // Template must be a local v1 operation; clients cannot override origin or supply a URL.
    if (
      !template.startsWith('/api/v1/') ||
      template.includes('..') ||
      template.includes('?') ||
      template.includes('#')
    )
      throw new ApiError('configuration');
    let path: string = template;
    for (const [name, value] of Object.entries(options.params || {}))
      path = path.replace(`{${name}}`, encodeURIComponent(String(value)));
    if (path.includes('{')) throw new ApiError('configuration');
    const query = new URLSearchParams();
    for (const [name, value] of Object.entries(options.query || {}))
      if (value !== undefined && value !== null) query.set(name, String(value));
    const controller = new AbortController();
    this.active.add(controller);
    const revision = this.accounts?.getRevision();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs ?? 15000);
    const cancel = () => controller.abort();
    options.signal?.addEventListener('abort', cancel, { once: true });
    if (options.signal?.aborted) controller.abort();
    const headers = new Headers(options.headers);
    // Credentials come only from this client's in-memory provider, never caller headers.
    headers.delete('Authorization');
    const multipart = options.body instanceof FormData;
    if (multipart) headers.delete('Content-Type');
    else if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    const token = this.getToken();
    this.prepare(headers, method !== 'get');
    try {
      if (controller.signal.aborted) throw new ApiError('cancelled');
      const response = await this.fetcher(
        `${this.baseUrl}${path}${query.size ? '?' + query : ''}`,
        {
          method: method.toUpperCase(),
          headers,
          body: multipart
            ? (options.body as FormData)
            : options.body === undefined
              ? undefined
              : JSON.stringify(options.body),
          signal: controller.signal,
          credentials: this.accounts?.credentials ?? 'omit',
          redirect: 'error',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
        },
      );
      // A late response from an old credential must not clear or populate a new session.
      if (this.getToken() !== token || (this.accounts && this.accounts.getRevision() !== revision))
        throw new ApiError('cancelled');
      if (this.accounts && response.headers.get('X-Security-Profile') !== 'accounts')
        throw new ApiError('protocol');
      const isJson = response.headers.get('Content-Type')?.includes('application/json');
      let body: unknown = null;
      // RFC 9110: 204 has no content, even when a proxy retains Content-Type.
      if (isJson && response.status !== 204) {
        try {
          body = await response.json();
        } catch {
          if (controller.signal.aborted) throw new ApiError(timedOut ? 'timeout' : 'cancelled');
          if (response.ok) throw new ApiError('protocol');
        }
      }
      if (
        this.getToken() !== token ||
        (this.accounts && this.accounts.getRevision() !== revision) ||
        controller.signal.aborted
      )
        throw new ApiError(timedOut ? 'timeout' : 'cancelled');
      if (!response.ok) {
        if (response.status === 401 && template !== '/api/v1/auth/login') this.onUnauthorized();
        throw httpError(response, body);
      }
      if (!isJson && response.status !== 204) throw new ApiError('protocol');
      const role = response.headers.get('X-Workspace-Role');
      return {
        data: body as T,
        meta: {
          ...(/^[A-Za-z0-9_-]{43}$/.test(response.headers.get('X-Analysis-Receipt') ?? '')
            ? { analysisReceipt: response.headers.get('X-Analysis-Receipt') }
            : {}),
          role: role === 'viewer' || role === 'operator' ? role : null,
          profile: response.headers.get('X-Security-Profile'),
          etag: response.headers.get('ETag'),
        },
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted) throw new ApiError(timedOut ? 'timeout' : 'cancelled');
      throw new ApiError('network');
    } finally {
      clearTimeout(timer);
      this.active.delete(controller);
      options.signal?.removeEventListener('abort', cancel);
    }
  }
}
