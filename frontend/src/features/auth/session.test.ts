import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceSession } from './session';
import { createQueryClient } from '../../api/query';

const syntheticToken = () =>
  crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
const catalog = (role?: string, status = 200) =>
  new Response(JSON.stringify({ contract_version: '1.0.0', models: [] }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(role ? { 'X-Workspace-Role': role, 'X-Security-Profile': 'secured' } : {}),
    },
  });

describe('memory-only workspace session', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  it.each(['viewer', 'operator'])('uses server-verified %s, not a role selector', async (role) => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const clearCache = vi.fn();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(catalog(role));
    const session = new WorkspaceSession('/backend', clearCache, fetcher);
    const token = syntheticToken();
    await session.connect('secured', token);
    expect(JSON.stringify(session)).not.toContain(token);
    expect(session.getSnapshot()).toMatchObject({ status: 'connected', role });
    expect(fetcher.mock.calls[0]?.[0]).toBe('/backend/api/v1/model-info');
    expect(storage).not.toHaveBeenCalled();
    storage.mockRestore();
    session.disconnect();
    expect(session.getSnapshot()).toMatchObject({ status: 'disconnected', role: null });
    expect(clearCache).toHaveBeenCalledTimes(2);
  });
  it('does not treat local or a liveness response as secured authentication', async () => {
    const session = new WorkspaceSession(
      '/backend',
      vi.fn(),
      vi.fn<typeof fetch>().mockResolvedValue(catalog()),
    );
    await expect(session.connect('secured', syntheticToken())).rejects.toMatchObject({
      kind: 'protocol',
    });
    expect(session.getSnapshot().status).toBe('disconnected');
  });
  it('does not grant operator in local mode', async () => {
    const session = new WorkspaceSession(
      '/backend',
      vi.fn(),
      vi.fn<typeof fetch>().mockResolvedValue(catalog()),
    );
    await session.connect('local', '');
    expect(session.getSnapshot()).toMatchObject({ status: 'connected', mode: 'local', role: null });
  });
  it('rejects missing/invalid/unknown role headers', async () => {
    const session = new WorkspaceSession(
      '/backend',
      vi.fn(),
      vi.fn<typeof fetch>().mockResolvedValue(catalog('admin')),
    );
    await expect(session.connect('secured', syntheticToken())).rejects.toMatchObject({
      kind: 'protocol',
    });
  });
  it('does not reuse credentials across new instances/reloads', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => catalog('viewer'));
    await new WorkspaceSession('/backend', vi.fn(), fetcher).connect('secured', syntheticToken());
    const fresh = new WorkspaceSession('/backend', vi.fn(), fetcher);
    expect(fresh.getSnapshot()).toMatchObject({ status: 'disconnected', role: null });
    await fresh.client.request('get', '/api/v1/model-info');
    expect(new Headers(fetcher.mock.calls[1]?.[1]?.headers).has('Authorization')).toBe(false);
  });
  it('clears credential and sensitive cache on 401, without retry', async () => {
    const queryClient = createQueryClient();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(catalog('viewer'))
      .mockResolvedValueOnce(catalog(undefined, 401))
      .mockResolvedValue(catalog());
    const session = new WorkspaceSession('/backend', () => queryClient.clear(), fetcher);
    await session.connect('secured', syntheticToken());
    queryClient.setQueryData(['private'], { private: 'synthetic' });
    await expect(session.client.request('get', '/api/v1/model-info')).rejects.toMatchObject({
      status: 401,
    });
    expect(queryClient.getQueryData(['private'])).toBeUndefined();
    expect(session.getSnapshot().status).toBe('disconnected');
    await session.client.request('get', '/api/v1/model-info');
    expect(new Headers(fetcher.mock.calls[2]?.[1]?.headers).has('Authorization')).toBe(false);
  });
  it('cancels a pending connection on disconnect', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        (_url, opts) =>
          new Promise((_resolve, reject) =>
            opts?.signal?.addEventListener('abort', () => reject(new Error('cancelled'))),
          ),
      );
    const session = new WorkspaceSession('/backend', vi.fn(), fetcher);
    const result = session.connect('secured', syntheticToken());
    session.disconnect();
    await expect(result).rejects.toMatchObject({ kind: 'cancelled' });
    expect(session.getSnapshot().role).toBeNull();
  });
});
