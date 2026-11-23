import { afterEach, expect, it, vi } from 'vitest';
import { publicAuthOptions } from './config';

afterEach(() => vi.unstubAllEnvs());

it.each([undefined, '', 'accounts'])('defaults to account login for profile %s', (profile) => {
  vi.stubEnv('VITE_AUTH_PROFILE', profile);
  expect(publicAuthOptions()).toMatchObject({ profile: 'accounts' });
});

it('keeps workspace only as an explicit choice', () => {
  vi.stubEnv('VITE_AUTH_PROFILE', 'workspace');
  expect(publicAuthOptions()).toBeUndefined();
});

it('rejects invalid configuration without falling back', () => {
  vi.stubEnv('VITE_AUTH_PROFILE', 'invalid');
  expect(() => publicAuthOptions()).toThrow();
});
