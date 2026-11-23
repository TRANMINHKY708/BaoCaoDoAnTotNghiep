const reportPrefix = process.env.FRONTEND_REPORT_PREFIX || 't16';
if (!/^[a-z0-9_]+$/.test(reportPrefix)) throw new Error('Invalid report prefix');
import { spawnSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { Buffer } from 'node:buffer';

const run = (file, args = [], env = {}) =>
  spawnSync(process.execPath, [file, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
const typecheck = run('node_modules/typescript/bin/tsc', ['-b']);
if (typecheck.status !== 0) throw new Error('Build typecheck failed; run npm run typecheck');
const build = run('node_modules/vite/bin/vite.js', ['build'], { VITE_API_BASE_URL: '/backend' });
if (build.status !== 0) throw new Error('Local QA build failed; inspect Vite configuration');
const assets = await readdir('dist/assets');
if (assets.some((name) => name.endsWith('.map'))) throw new Error('Unexpected public sourcemap');
const scriptAssets = assets.filter((name) => name.endsWith('.js'));
let total = 0,
  compressed = 0;
for (const name of scriptAssets) {
  const bytes = await readFile('dist/assets/' + name);
  total += bytes.length;
  compressed += gzipSync(bytes).length;
  if (bytes.includes(Buffer.from('http://127.0.0.1:8000')))
    throw new Error('Backend localhost default leaked into production JavaScript');
  if (
    [
      'SYNTHETIC_T14_',
      'SYNTHETIC_T15_',
      'TEST_ONLY_WHAT_IF_T16',
      'Public model catalog and existing Swagger example; not application records',
    ].some((marker) => bytes.includes(Buffer.from(marker)))
  )
    throw new Error('TEST-only credential or fixture leaked into production JavaScript');
}
const marker = randomUUID();
const forbidden = run('node_modules/vite/bin/vite.js', ['build'], {
  VITE_API_BASE_URL: '/backend',
  VITE_AUTH_TOKEN: marker,
});
if (
  forbidden.status === 0 ||
  !forbidden.stderr.includes('Only VITE_API_BASE_URL') ||
  (forbidden.stdout + forbidden.stderr).includes(marker)
) {
  throw new Error('Secret-environment build guard failed');
}
const result = {
  stage: reportPrefix,
  node: process.version,
  typescript: 'PASSED',
  production_build: 'PASSED',
  explicit_public_base_for_local_QA: '/backend',
  no_backend_localhost_default_in_bundle: true,
  secret_public_environment_rejected: true,
  secret_value_not_in_error_output: true,
  t14_synthetic_credentials_and_wire_fixtures_not_in_bundle: true,
  t16_test_fixtures_not_in_bundle: true,
  public_sourcemaps: 0,
  javascript_chunks: scriptAssets.length,
  javascript_bytes: total,
  javascript_gzip_bytes: compressed,
  package_lock_sha256: createHash('sha256')
    .update(await readFile('package-lock.json'))
    .digest('hex'),
  limitations: [
    'Build test is not browser visual QA or deployment',
    '/backend is a loopback development/preview proxy, not a production API host',
  ],
};
await writeFile(
  `../reports/${reportPrefix}_build_verification.json`,
  JSON.stringify(result, null, 2) + '\n',
);
console.log(JSON.stringify(result, null, 2));
