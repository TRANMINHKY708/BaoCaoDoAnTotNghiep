/** Read-only invariants for the demo presentation branch against accepted T16. */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
const base = '9f7a31ff00e267c0a0238122809369ba3b13f6f8';
const printer = ts.createPrinter({ removeComments: true });
function source(text, path) {
  return ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}
function nodes(file, predicate) {
  const out = [];
  function visit(n) {
    if (predicate(n)) out.push(printer.printNode(ts.EmitHint.Unspecified, n, file));
    ts.forEachChild(n, visit);
  }
  visit(file);
  return out;
}
function equal(a, b, label) {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error('Presentation invariant failed: ' + label);
}
function old(path) {
  return execFileSync('git', ['show', base + ':frontend/' + path], { encoding: 'utf8' });
}
const guards = [
  'src/features/predictions/prediction.ts',
  'src/features/predictions/csv.ts',
  'src/features/segmentation/segmentation.ts',
  'src/features/what-if/whatIf.ts',
  'src/features/dashboard/dashboard.ts',
];
for (const path of guards) {
  equal(
    nodes(source(old(path), path), ts.isFunctionDeclaration),
    nodes(source(readFileSync(path, 'utf8'), path), ts.isFunctionDeclaration),
    path + ' guard functions',
  );
}
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = dir + '/' + entry.name;
    if (entry.isDirectory()) walk(p);
    else if (p.endsWith('.tsx') && !p.includes('.test.')) files.push(p);
  }
}
walk('src/features');
for (const path of files) {
  if (
    !execFileSync('git', ['ls-tree', base, '--', 'frontend/' + path], { encoding: 'utf8' }).trim()
  )
    continue;
  const before = source(old(path), path),
    after = source(readFileSync(path, 'utf8'), path);
  const network = (n) =>
    ts.isCallExpression(n) &&
    /^session\.(client\.|connect\b|disconnect\b)/.test(n.expression.getText().replace(/\s/g, ''));
  equal(nodes(before, network), nodes(after, network), path + ' network calls');
  const state = (n) => ts.isCallExpression(n) && n.expression.getText() === 'useState';
  equal(nodes(before, state), nodes(after, state), path + ' state defaults');
}
const protectedFiles = [
  'src/api/client.ts',
  'src/api/generated.ts',
  'src/api/config.ts',
  'src/api/query.ts',
  'src/api/errors.ts',
  'src/app/context.ts',
  'src/features/auth/session.ts',
  'package-lock.json',
];
for (const path of protectedFiles)
  equal(old(path), readFileSync(path, 'utf8'), path + ' unchanged');
writeFileSync(
  '../reports/demo_ui_logic_verification.json',
  JSON.stringify(
    {
      status: 'PASS',
      base,
      guard_functions_preserved: guards,
      network_and_state_components: files.length,
      protected_files: protectedFiles,
      scope: 'Presentation-only invariants, not a substitute for runtime tests',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Presentation invariants PASS: guards, requests, state defaults and session/client unchanged',
);
