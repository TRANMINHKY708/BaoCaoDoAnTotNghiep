import { afterEach, expect, it, vi } from 'vitest';
import { ApiClient } from './client';
import { httpError } from './errors';

afterEach(() => vi.useRealTimers());
const file = new File(['Age\n20'], 'test.csv', { type: 'text/csv' });
const settings = { modelVersion: '1.0.0' as const, saveResults: false };
const ok = () =>
  new Response('Age,Purchase_Level_Predicted\n20,Low', {
    headers: { 'Content-Type': 'text/csv;charset=utf-8', 'X-Model-Version': '1.0.0' },
  });
it('multipart keeps runtime credential only, selected version/save flag, no invented JSON content type', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(ok());
  const result = await new ApiClient(
    '/backend',
    () => 'test-runtime',
    undefined,
    fetcher,
  ).requestPurchaseCsv(file, settings);
  const [url, init] = fetcher.mock.calls[0]!;
  expect(url).toBe('/backend/api/v1/predict/csv/purchase-level');
  expect(init).toMatchObject({
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  });
  expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-runtime');
  expect(new Headers(init?.headers).has('Content-Type')).toBe(false);
  expect((init?.body as FormData).get('model_version')).toBe('1.0.0');
  expect((init?.body as FormData).get('save_results')).toBe('false');
  expect(result.blob.size).toBeGreaterThan(0);
});
it.each([403, 409, 422, 429])(
  'CSV HTTP %s is safe, request sent once and never retried',
  async (status) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'CSV_VALIDATION_ERROR',
            message: 'PRIVATE',
            details: [{ location: ['csv', 2, 'Age'], message: 'PRIVATE-VALUE' }],
          },
        }),
        { status, headers: { 'Content-Type': 'application/json', 'Retry-After': '4' } },
      ),
    );
    const client = new ApiClient('/backend', undefined, undefined, fetcher);
    const error = await client.requestPurchaseCsv(file, settings).catch((e) => e);
    expect(error).toMatchObject({ kind: 'http', status, retryAfterSeconds: 4 });
    expect(error.message).not.toContain('PRIVATE');
    expect(error.issues).toEqual([{ source: 'csv', row: 2, field: 'Age' }]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);
it('CSV 401 invalidates current session, stale credential response is discarded', async () => {
  const reset = vi.fn(),
    fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 401 }));
  await expect(
    new ApiClient('/backend', () => 'runtime', reset, fetcher).requestPurchaseCsv(file, settings),
  ).rejects.toMatchObject({ status: 401 });
  expect(reset).toHaveBeenCalledOnce();
  let token = 'old';
  const pendingFetch = vi.fn<typeof fetch>().mockImplementation(async () => {
    token = 'new';
    return ok();
  });
  await expect(
    new ApiClient('/backend', () => token, reset, pendingFetch).requestPurchaseCsv(file, settings),
  ).rejects.toMatchObject({ kind: 'cancelled' });
});
it('CSV cancellation/timeout use abort and do not retry writes', async () => {
  vi.useFakeTimers();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(
      async (_url, init) =>
        new Promise((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          ),
        ),
    );
  const client = new ApiClient('/backend', undefined, undefined, fetcher);
  const pending = client.requestPurchaseCsv(file, {
    ...settings,
    saveResults: true,
    timeoutMs: 10,
  });
  const checked = expect(pending).rejects.toMatchObject({ kind: 'timeout' });
  await vi.advanceTimersByTimeAsync(11);
  await checked;
  expect(fetcher).toHaveBeenCalledOnce();
});
it('CSV rejects HTML/incorrect version and does not echo response body', async () => {
  for (const response of [
    new Response('<html>PRIVATE</html>', { headers: { 'Content-Type': 'text/html' } }),
    new Response('csv', { headers: { 'Content-Type': 'text/csv', 'X-Model-Version': 'wrong' } }),
  ]) {
    await expect(
      new ApiClient(
        '/backend',
        undefined,
        undefined,
        vi.fn().mockResolvedValue(response),
      ).requestPurchaseCsv(file, settings),
    ).rejects.toMatchObject({ kind: 'protocol' });
  }
});
it('validation locations whitelist names/positions; raw input and forged names never surface', () => {
  const error = httpError(new Response(null, { status: 422 }), {
    error: {
      message: 'SECRET',
      details: [
        { location: ['body', 'customers', 1, 'Age'], input: 'SECRET' },
        { location: ['csv', 999999, 'SECRET-FIELD'] },
        { location: ['csv', 3, 'Country'], message: 'SECRET' },
      ],
    },
  });
  expect(error.issues).toEqual([
    { source: 'json', row: 2, field: 'Age' },
    { source: 'csv', row: 3, field: 'Country' },
  ]);
  expect(JSON.stringify(error)).not.toContain('SECRET');
});
