import { ApiError } from './errors';

export function publicApiBase() {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  // No localhost silently embedded in a production build; /backend is dev proxy only.
  if (configured) return configured;
  if (import.meta.env.DEV) return '/backend';
  throw new ApiError('configuration');
}

export function publicAuthOptions() {
  const profile = import.meta.env.VITE_AUTH_PROFILE as string | undefined;
  if (profile === 'workspace') return undefined;
  if (profile && profile !== 'accounts') throw new ApiError('configuration');
  return {
    profile: 'accounts' as const,
    trustedApiOrigin: import.meta.env.VITE_ACCOUNTS_API_ORIGIN as string | undefined,
  };
}
