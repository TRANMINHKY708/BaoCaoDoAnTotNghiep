import { expect, it } from 'vitest';
import fixture from '../../test/fixtures/t15_segmentation.json';
import {
  adaptSnapshot,
  formCustomer,
  validateCustomer,
  type Model,
} from '../predictions/prediction';
import type { Snapshot } from '../customers/customers';
import {
  segmentCsv,
  segmentId,
  segmentSpec,
  verifyDistribution,
  verifySegment,
} from './segmentation';
const specs = fixture.catalog.models.map((m) => segmentSpec(m as Model));
it('schemas both have exact ten descriptive features, Total_Purchases allowed, never classifier target/LTV/Churned', () => {
  for (const spec of specs) {
    expect(spec.features).toHaveLength(10);
    expect(spec.model.features).toContain('Total_Purchases');
    expect(spec.model.features).not.toEqual(
      expect.arrayContaining(['Purchase_Level', 'Lifetime_Value', 'Churned']),
    );
  }
  expect(specs[0]!.features.every((f) => !f.nullable)).toBe(true);
  expect(specs[1]!.features.every((f) => f.nullable)).toBe(true);
  expect(() => segmentSpec({ ...specs[0]!.model, task: 'classification' })).toThrow();
});
it('required/finite/negative/decimal/null policy; adapter strips snapshot metadata and never rounds purchases', () => {
  const spec = specs[1]!,
    row = { ...fixture.rows[1]!.customer, Total_Purchases: 15.6, Login_Frequency: null };
  expect(validateCustomer(row, spec)).toEqual(row);
  expect(() => validateCustomer({ ...row, Total_Purchases: -1 }, spec)).toThrow();
  expect(() => formCustomer({}, new Set(), spec)).toThrow();
  const projected = adaptSnapshot(
    {
      ...fixture.rows[0]!.customer,
      Purchase_Level: 'High',
      Churned: false,
      Age: 45,
    } as unknown as Snapshot,
    spec,
  );
  expect(Object.keys(projected)).toHaveLength(10);
  expect(projected).not.toHaveProperty('Purchase_Level');
  expect(() => validateCustomer({ ...row, Login_Frequency: '3' }, spec)).toThrow();
  expect(() => validateCustomer({ ...row, Login_Frequency: true }, spec)).toThrow();
});
it('cluster identity is version-scoped, not Purchase_Level; distance raw finite nonnegative, no probabilities', () => {
  specs.forEach((spec, index) => {
    const result = fixture.rows[index]!.result;
    expect(verifySegment(result, spec)).toEqual(result);
    for (const distance of [-1, Infinity, NaN, '1'])
      expect(() => verifySegment({ ...result, distance_to_centroid: distance }, spec)).toThrow();
    expect(() => verifySegment({ ...result, confidence: 0.99 }, spec)).toThrow();
    expect(() => verifySegment({ ...result, segment_id: 'High' }, spec)).toThrow();
    expect(() => verifySegment({ ...result, model_version: 'wrong' }, spec)).toThrow();
  });
  expect(segmentId('1.0.0', 0)).not.toBe(segmentId('2.0.0-snapshot-k3', 0));
});
it('summary validates namespace/labels/count unit, never substitutes unknown or negative counts', () => {
  const spec = specs[0]!,
    definitions = Object.fromEntries(
      [0, 1, 2].map((c) => [
        segmentId('1.0.0', c),
        { cluster: String(c), display_label: spec.model.labels[String(c)]! },
      ]),
    );
  const body = {
    model_version: '1.0.0',
    definitions,
    stored_result_counts: Object.fromEntries(Object.keys(definitions).map((k) => [k, 0])),
    count_unit: 'stored_segmentation_results_not_unique_customers',
    scope: 'descriptive_snapshot',
  };
  expect(verifyDistribution(body, spec)).toEqual(body);
  expect(() => verifyDistribution({ ...body, count_unit: 'unique_customers' }, spec)).toThrow();
  expect(() =>
    verifyDistribution(
      { ...body, stored_result_counts: { ...body.stored_result_counts, unknown: 4 } },
      spec,
    ),
  ).toThrow();
});
it('CSV preserves exact segment metadata/distance, rejects classifier export and wrong version', () => {
  const spec = specs[1]!,
    r = fixture.rows[1]!.result;
  const row = {
    Model_ID: r.model_id,
    Model_Version: r.model_version,
    Generated_At: r.generated_at,
    Prediction_Task: r.task,
    Cluster: r.cluster,
    Segment_ID: r.segment_id,
    Segment_Name: r.segment_name,
    Distance_To_Centroid: r.distance_to_centroid,
    Distance_Kind: r.distance_kind,
  };
  const csv = Object.keys(row).join(',') + '\n' + Object.values(row).join(',');
  expect(segmentCsv(csv, spec, 1)[0]).toMatchObject({
    cluster: r.cluster,
    segment_id: r.segment_id,
    distance_to_centroid: r.distance_to_centroid,
    input_quality: null,
  });
  expect(() => segmentCsv(csv, specs[0]!, 1)).toThrow();
  expect(() => segmentCsv('Purchase_Level\nHigh', spec, 1)).toThrow();
});
