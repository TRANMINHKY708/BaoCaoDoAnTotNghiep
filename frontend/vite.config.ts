import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { defineConfig as testConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (
    Object.keys(env).some(
      (key) =>
        key.startsWith('VITE_') &&
        !['VITE_API_BASE_URL', 'VITE_AUTH_PROFILE', 'VITE_ACCOUNTS_API_ORIGIN'].includes(key),
    )
  ) {
    throw new Error(
      'Only VITE_API_BASE_URL and approved non-secret auth profile/origin are allowed; never expose secrets',
    );
  }
  if (env.VITE_AUTH_PROFILE && !['accounts', 'workspace'].includes(env.VITE_AUTH_PROFILE))
    throw new Error('Invalid public auth profile');
  const target = env.FRONTEND_PROXY_TARGET || 'http://127.0.0.1:8000';
  const url = new URL(target);
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.protocol !== 'http:'
  ) {
    throw new Error('Development proxy must target a credential-free HTTP loopback server');
  }
  const proxy = {
    '/backend': {
      target,
      changeOrigin: false,
      rewrite: (path: string) => path.replace(/^\/backend/, ''),
    },
  };
  return testConfig({
    plugins: [react()],
    server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true, proxy },
    test: {
      environment: 'jsdom',
      // Bound jsdom workers on the local laptop; do not skip or weaken cases.
      maxWorkers: 2,
      setupFiles: ['./src/test/setup.ts'],
      clearMocks: true,
      reporters: [
        'default',
        [
          'junit',
          {
            outputFile: `../reports/${process.env.FRONTEND_REPORT_PREFIX || 't16'}_frontend_junit.xml`,
          },
        ],
      ],
    },
    build: { sourcemap: false },
  });
});
