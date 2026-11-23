import { expect, it } from 'vitest';
import fixture from '../../test/fixtures/t16_what_if.json';
import {
  bodyLimit,
  canPersist,
  checkedComparison,
  checkedHistory,
  checkedPreview,
  checkedSaved,
  checkedSchema,
  MUTABLE,
  parseChanges,
  type Comparison,
  type Models,
  type Mutable,
  type Request,
  type Schema,
} from './whatIf';
const schema = checkedSchema(fixture.schema),
  row = fixture.rows[0]!;
const model = schema.models.find(
  (m) => m.task === 'classification' && m.model_version === '1.0.0',
)!;
it.each(['missing', 'range'])(
  'rejects an unusable mutable descriptor %s before rendering controls',
  (kind) => {
    const bad = structuredClone(fixture.schema);
    const descriptor = bad.models[0]!.features.find((f) => f.name === 'Email_Open_Rate')!;
    if (kind === 'missing') {
      descriptor.name = 'Unapproved_Field';
      descriptor.mutable = false;
    } else descriptor.maximum = 1;
    expect(() => checkedSchema(bad)).toThrow();
  },
);
it('schema requires the exact six mutable descriptors and four pinned model variants', () => {
  expect(schema.mutable_features).toEqual([...MUTABLE]);
  const bad = structuredClone(fixture.schema);
  bad.mutable_features.push('Lifetime_Value');
  expect(() => checkedSchema(bad)).toThrow('không đúng hợp đồng');
});
it.each(fixture.rows)(
  'actual wire pairing: $request.models.classification / $request.models.segmentation',
  (r) => {
    const request = r.request as Request;
    const p = checkedPreview(r.preview, schema, request);
    expect(
      checkedComparison(r.comparison, schema, request, p, r.intent.changes).baseline
        .baseline_fingerprint,
    ).toBe(p.baseline_fingerprint);
    expect(canPersist(schema, request.models)).toBe(
      request.models.classification === '1.0.0' &&
        (!request.models.segmentation || request.models.segmentation === '1.0.0'),
    );
  },
);
it.each(['artifact', 'metadata', 'version', 'baseline', 'delta'] as const)(
  'rejects %s mismatch rather than mixing model outputs',
  (kind) => {
    const bad = structuredClone(row.comparison);
    if (kind === 'artifact') bad.scenario_classification.model.artifact_sha256 = 'a'.repeat(64);
    if (kind === 'metadata') bad.scenario_classification.model.metadata_sha256 = 'b'.repeat(64);
    if (kind === 'version')
      bad.scenario_classification.model.model_version = '2.0.0-snapshot-conservative12';
    if (kind === 'baseline') bad.baseline.baseline_fingerprint = 'c'.repeat(64);
    if (kind === 'delta') bad.probability_deltas.percentage_points.Low = 123;
    expect(() =>
      checkedComparison(
        bad,
        schema,
        row.request as Request,
        row.preview as never,
        row.intent.changes,
      ),
    ).toThrow();
  },
);
it('percentage points are signed API units, not relative growth or absolute probability', () => {
  const value = checkedComparison(row.comparison);
  for (const c of ['Low', 'Medium', 'High'] as const)
    expect(value.probability_deltas.percentage_points[c]).toBeCloseTo(
      (value.scenario_classification.probabilities[c] -
        value.baseline.classification.probabilities[c]) *
        100,
      9,
    );
});
it.each(['', 'NaN', 'Infinity', 'true', '0x10', '-1', '1e999'])(
  'rejects invalid numeric change %s',
  (raw) => {
    expect(() =>
      parseChanges({ Login_Frequency: raw }, new Set(['Login_Frequency']), model),
    ).toThrow();
  },
);
it('strict ranges, immutable fields, explicit null baseline and no rounding', () => {
  expect(
    parseChanges(
      { Login_Frequency: '10.4', Email_Open_Rate: '100' },
      new Set(['Login_Frequency', 'Email_Open_Rate']),
      model,
    ),
  ).toEqual({ Login_Frequency: 10.4, Email_Open_Rate: 100 });
  expect(() =>
    parseChanges({ Email_Open_Rate: '100.01' }, new Set(['Email_Open_Rate']), model),
  ).toThrow();
  expect(() => parseChanges({}, new Set(['Lifetime_Value' as Mutable]), model)).toThrow();
  expect(parseChanges({}, new Set(), model)).toEqual({});
});
it('stored historical detail verifies internal pins independently of live catalog', () => {
  expect(checkedSaved(fixture.saved).persisted).toBe(true);
  const bad = structuredClone(fixture.saved);
  bad.results[0]!.model_identity.metadata_sha256 = 'd'.repeat(64);
  expect(() => checkedSaved(bad)).toThrow();
});
it('save response cannot replace source or scenario data under an unchanged fingerprint', () => {
  const bad = structuredClone(fixture.saved);
  bad.original_snapshot_id = '16000000-0000-4000-8000-000000000001';
  expect(() => checkedSaved(bad, row.comparison as Comparison)).toThrow();
});
it('unverified history must not invent labels; UTF8 body limit includes multibyte input', () => {
  const h = structuredClone(fixture.history);
  Object.assign(h.items[0]!, {
    integrity_status: 'unverified',
    models: null,
    baseline_label: null,
    scenario_label: null,
    classification_label_changed: null,
  });
  expect(checkedHistory(h).items[0]!.baseline_label).toBeNull();
  Object.assign(h.items[0]!, { baseline_label: 'High' });
  expect(() => checkedHistory(h)).toThrow();
  expect(() => bodyLimit({ text: 'ệ'.repeat(30000) })).toThrow();
});
it('catalog capability must not silently grant persistence to research models', () => {
  const bad = structuredClone(fixture.schema);
  bad.models[1]!.persistence_supported = true;
  expect(() => checkedSchema(bad as unknown as Schema)).toThrow();
  expect(
    canPersist(schema, { classification: '1.0.0', segmentation: '2.0.0-snapshot-k3' } as Models),
  ).toBe(false);
});
