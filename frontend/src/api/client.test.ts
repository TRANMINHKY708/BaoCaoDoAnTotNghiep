import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, normalizeBaseUrl } from './client';
import { ApiError } from './errors';

const response = (
  status = 200,
  body: unknown = { status: 'alive', contract_version: '1.0.0' },
  headers = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

afterEach(() => vi.useRealTimers());
describe('typed API transport', () => {
  it('accepts bodyless 204 even if a proxy retains a JSON content type', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 204,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const result = await new ApiClient('/backend', undefined, undefined, fetcher).request(
      'delete',
      '/api/v1/customers/{customer_id}',
      { params: { customer_id: 'synthetic' } },
    );
    expect(result.data).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(['default', 'forwarded'])('preserves the native fetch receiver (%s)', async (source) => {
    const browserFetch = vi.fn(function (this: unknown) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve(response());
    });
    vi.stubGlobal('fetch', browserFetch);
    try {
      const client = new ApiClient(
        '/backend',
        undefined,
        undefined,
        source === 'forwarded' ? fetch : undefined,
      );
      await expect(client.request('get', '/api/v1/health')).resolves.toMatchObject({
        data: { status: 'alive' },
      });
      expect(browserFetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('discards a body that finishes after the active credential changed', async () => {
    let credential = 'old';
    let resolveBody: (data: unknown) => void = () => {};
    const serverResponse = response();
    vi.spyOn(serverResponse, 'json').mockImplementation(
      () =>
        new Promise((done) => {
          resolveBody = done;
        }),
    );
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(serverResponse);
    const pending = new ApiClient('/backend', () => credential, undefined, fetcher).request(
      'get',
      '/api/v1/health',
    );
    await Promise.resolve();
    credential = 'new';
    resolveBody({ status: 'alive' });
    await expect(pending).rejects.toMatchObject({ kind: 'cancelled' });
  });
  it('uses the configured origin, in-memory credential and no browser credentials', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response());
    const client = new ApiClient(
      'https://api.example.test',
      () => 'runtime-only',
      undefined,
      fetcher,
    );
    await client.request('get', '/api/v1/health', { headers: { Authorization: 'never-use-this' } });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/health',
      expect.objectContaining({ credentials: 'omit', redirect: 'error', cache: 'no-store' }),
    );
    const headers = new Headers(fetcher.mock.calls[0]?.[1]?.headers);
    expect(headers.get('Authorization')).toBe('Bearer runtime-only');
  });
  it('encodes path/query and preserves concurrency/idempotency headers', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response());
    const client = new ApiClient('/backend', undefined, undefined, fetcher);
    await client.request('get', '/api/v1/customers/{customer_id}', {
      params: { customer_id: 'x/y' },
      headers: { 'If-Match': 'revision', 'Idempotency-Key': 'key' },
    });
    expect(fetcher.mock.calls[0]?.[0]).toBe('/backend/api/v1/customers/x%2Fy');
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('If-Match')).toBe('revision');
    await client.request('get', '/api/v1/customers', { query: { q: 'a & b', limit: 20 } });
    expect(fetcher.mock.calls[1]?.[0]).toBe('/backend/api/v1/customers?q=a+%26+b&limit=20');
  });
  it.each([401, 403, 409, 412, 422, 429, 500, 503])(
    'normalizes HTTP %i without exposing raw messages',
    async (status) => {
      const revoked = vi.fn();
      const client = new ApiClient(
        '/backend',
        () => 'memory',
        revoked,
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            response(
              status,
              { error: { code: 'SAFE_CODE', message: 'private-input-do-not-render' } },
              { 'Retry-After': '60', 'X-Request-ID': '80b82ad8-3226-419d-a234-81744b436984' },
            ),
          ),
      );
      let failure: unknown;
      try {
        await client.request('get', '/api/v1/health');
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(ApiError);
      expect(failure).toMatchObject({ status, code: 'SAFE_CODE', retryAfterSeconds: 60 });
      expect((failure as ApiError).message).not.toContain('private-input');
      expect(revoked).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
    },
  );
  it('never retries an HTTP failure automatically', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(429));
    await expect(
      new ApiClient('/backend', undefined, undefined, fetcher).request('get', '/api/v1/health'),
    ).rejects.toMatchObject({ status: 429 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('handles legacy/plain errors and rejects non-JSON success', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('private SQL', { status: 500 }))
      .mockResolvedValueOnce(new Response('<html>proxy</html>'));
    const client = new ApiClient('/backend', undefined, undefined, fetcher);
    await expect(client.request('get', '/api/v1/health')).rejects.toMatchObject({ status: 500 });
    await expect(client.request('get', '/api/v1/health')).rejects.toMatchObject({
      kind: 'protocol',
    });
  });
  it('reports network failure without retaining fetch exception/token/URL', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('private-token-url'));
    await expect(
      new ApiClient('/backend', undefined, undefined, fetcher).request('get', '/api/v1/health'),
    ).rejects.toMatchObject({ kind: 'network' });
  });
  it('distinguishes timeout from user cancellation', async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        (_url, opts) =>
          new Promise((_resolve, reject) =>
            opts?.signal?.addEventListener(
              'abort',
              () => reject(new DOMException('Abort', 'AbortError')),
              { once: true },
            ),
          ),
      );
    const client = new ApiClient('/backend', undefined, undefined, fetcher);
    const timeout = expect(
      client.request('get', '/api/v1/health', { timeoutMs: 20 }),
    ).rejects.toMatchObject({ kind: 'timeout' });
    await vi.advanceTimersByTimeAsync(21);
    await timeout;
    const controller = new AbortController();
    const cancelled = expect(
      client.request('get', '/api/v1/health', { signal: controller.signal }),
    ).rejects.toMatchObject({ kind: 'cancelled' });
    controller.abort();
    await cancelled;
  });
  it('does not send a pre-cancelled request', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      new ApiClient('/backend', undefined, undefined, fetcher).request('get', '/api/v1/health', {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ kind: 'cancelled' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not invalidate a new credential after a late old 401', async () => {
    let credential = 'old';
    let resolve: (value: Response) => void = () => {};
    const revoked = vi.fn();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const request = new ApiClient('/backend', () => credential, revoked, fetcher).request(
      'get',
      '/api/v1/health',
    );
    credential = 'new';
    resolve(response(401));
    await expect(request).rejects.toMatchObject({ kind: 'cancelled' });
    expect(revoked).not.toHaveBeenCalled();
  });
  it.each([
    '',
    '//evil.test',
    'javascript:alert(1)',
    'http://remote.example.test',
    'https://user:password@example.test',
    '/backend?token=x',
  ])('rejects unsafe base %s', (url) => {
    expect(() => normalizeBaseUrl(url)).toThrow(ApiError);
  });
});
