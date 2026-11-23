const reportPrefix = process.env.FRONTEND_REPORT_PREFIX || 't16';
if (!/^[a-z0-9_]+$/.test(reportPrefix)) throw new Error('Invalid report prefix');
import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

if (!process.env.npm_execpath) throw new Error('Run via npm run check');
const checks = [];
for (const command of ['lint', 'format:check', 'api:check', 'typecheck', 'test', 'build:test']) {
  const started = Date.now();
  const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', command], {
    env: process.env,
    encoding: 'utf8',
  });
  checks.push({
    command: `npm run ${command}`,
    exit_code: result.status,
    seconds: (Date.now() - started) / 1000,
  });
  await writeFile(
    `../reports/${reportPrefix}_frontend_checks.json`,
    JSON.stringify(
      { stage: reportPrefix, checks, status: result.status === 0 ? 'PASSED_SO_FAR' : 'FAILED' },
      null,
      2,
    ) + '\n',
  );
  if (result.status !== 0)
    throw new Error(
      `Frontend ${command} failed; run the command locally for diagnostics. No raw response or credential logs retained.`,
    );
  console.log(`${command}: PASSED`);
}
await writeFile(
  `../reports/${reportPrefix}_frontend_checks.json`,
  JSON.stringify(
    { stage: reportPrefix, status: 'PASSED', node: process.version, checks },
    null,
    2,
  ) + '\n',
);
