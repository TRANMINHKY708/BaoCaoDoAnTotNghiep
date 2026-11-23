import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import openapiTS, { astToString } from 'openapi-typescript';

const source = new URL('../../reports/auth03/accounts_openapi.json', import.meta.url);
const output = new URL('../src/api/generated.ts', import.meta.url);
const bytes = await readFile(source);
const hash = createHash('sha256').update(bytes).digest('hex');
const spec = JSON.parse(bytes.toString('utf8'));
// Approved additive calendar-timezone extension; retain historical evidence intact.
const dashboard = spec.paths['/api/v1/dashboard/overview'].get;
spec.components.schemas.DashboardOverview.properties.filters.properties.timezone = {
  type: 'string',
  enum: ['UTC', 'Asia/Ho_Chi_Minh'],
};
dashboard.parameters.push({
  name: 'timezone',
  in: 'query',
  required: false,
  description:
    'Calendar timezone for date bounds and daily buckets. Defaults to UTC for existing clients.',
  schema: { type: 'string', enum: ['UTC', 'Asia/Ho_Chi_Minh'], default: 'UTC' },
});
for (const parameter of dashboard.parameters) {
  if (['date_from', 'date_to'].includes(parameter.name))
    parameter.description = parameter.description.replaceAll('UTC', 'in the selected timezone');
}
const types = await openapiTS(spec);
const content = `// Generated from reports/auth03/accounts_openapi.json. Do not hand-edit. Calendar timezone extension applied by generator.\n// SHA256: ${hash}\n${astToString(types)}`;
if (process.argv.includes('--check')) {
  if ((await readFile(output, 'utf8')) !== content)
    throw new Error('OpenAPI types drifted; run npm run api:generate');
  console.log('OpenAPI generated types: exact match');
} else {
  await writeFile(output, content);
  console.log('Generated local OpenAPI types (no network or server required)');
}
