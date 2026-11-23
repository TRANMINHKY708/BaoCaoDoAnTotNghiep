import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

if (!process.env.npm_execpath) throw new Error('Run via npm run audit:check');
const audit = spawnSync(
  process.execPath,
  [process.env.npm_execpath, 'audit', '--json', '--registry=https://registry.npmjs.org'],
  { encoding: 'utf8', env: process.env },
);
let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  throw new Error('npm advisory scan incomplete; no clean-scan claim');
}
await writeFile('../reports/t11_npm_audit.json', JSON.stringify(report, null, 2) + '\n');
if (audit.status !== 0 || report.metadata?.vulnerabilities?.total !== 0)
  throw new Error('Dependency advisories found; review the report before acceptance');
console.log('npm audit complete: 0 advisories');
