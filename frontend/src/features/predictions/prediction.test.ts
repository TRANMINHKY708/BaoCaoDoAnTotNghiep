import { expect, it } from 'vitest';
import fixture from '../../test/fixtures/t14_predictions.json';
import {
  adaptSnapshot,
  batchCustomers,
  formCustomer,
  InputError,
  modelSpec,
  strictJson,
  validateCustomer,
  verifyResult,
  type Model,
} from './prediction';
import { csvPredictions, inspectCsv, parseCsv } from './csv';
import type { Snapshot } from '../customers/customers';

const specs = fixture.catalog.models.map((model) => modelSpec(model as Model));
const legacy = specs[0]!,
  t4 = specs[1]!,
  customer = fixture.rows[0]!.customer;
const file = (text: string, name = 'test.csv') => {
  const bytes = new TextEncoder().encode(text),
    item = new File([bytes], name, { type: 'text/csv' });
  Object.defineProperty(item, 'arrayBuffer', {
    configurable: true,
    value: async () => bytes.buffer,
  });
  return item;
};
const csv = (row: Record<string, unknown>) =>
  Object.keys(row).join(',') +
  '\r\n' +
  Object.values(row)
    .map((value) => (value === null ? '' : String(value)))
    .join(',') +
  '\r\n';

it('uses exact catalog counts, constraints, order and nullability; never target leakage keys', () => {
  expect(legacy.features).toHaveLength(24);
  expect(t4.features).toHaveLength(12);
  expect(legacy.features.some((f) => f.nullable)).toBe(false);
  expect(t4.features.every((f) => f.nullable)).toBe(true);
  expect(t4.features.find((f) => f.name === 'Age')?.min).toBeUndefined();
  expect(legacy.features.find((f) => f.name === 'Age')?.min).toBe(18);
  expect(t4.features.map((f) => f.name)).not.toEqual(
    expect.arrayContaining(['Lifetime_Value', 'Churned', 'Total_Purchases']),
  );
  expect(() => modelSpec({ ...legacy.model, feature_count: 12 })).toThrow();
});
it.each([true, '43', NaN, Infinity, -1, 101])(
  'rejects invalid legacy Age %s without coercion',
  (value) => {
    expect(() => validateCustomer({ ...customer, Age: value }, legacy)).toThrow(InputError);
  },
);
it.each([
  { Purchase_Level: 'High' },
  { Total_Purchases: 12 },
  { private_unknown: 1 },
  { Churned: 0.5 },
  { Email_Open_Rate: 101 },
  { Signup_Quarter: 'Q5' },
  { Country: '   ' },
])('rejects forbidden/invalid fields %o', (value) => {
  expect(() => validateCustomer({ ...customer, ...value }, legacy)).toThrow(InputError);
});
it('requires every T4 key, accepts explicit null, preserves dataset strings NA and decimals', () => {
  const row = { ...fixture.rows[1]!.customer, Age: null, Country: 'NA', Login_Frequency: 10.4 };
  expect(validateCustomer(row, t4)).toEqual(row);
  const missing: Record<string, unknown> = { ...row };
  delete missing.Age;
  expect(() => validateCustomer(missing, t4)).toThrow(InputError);
  expect(() =>
    validateCustomer(Object.fromEntries(t4.features.map((f) => [f.name, null])), t4),
  ).toThrow(InputError);
});
it('blank form is missing; zero/null only explicit; manual decimals are not rounded', () => {
  expect(() => formCustomer({}, new Set(), t4)).toThrow(InputError);
  const draft = Object.fromEntries(
    Object.entries(fixture.rows[1]!.customer).map(([k, v]) => [k, String(v)]),
  );
  draft.Login_Frequency = '10.456789123';
  draft.Wishlist_Items = '0';
  draft.Age = '';
  expect(() => formCustomer(draft, new Set(), t4)).toThrow(InputError);
  expect(formCustomer(draft, new Set(['Age']), t4)).toMatchObject({
    Age: null,
    Wishlist_Items: 0,
    Login_Frequency: 10.456789123,
  });
});
it.each([
  '{"a":1,"a":2}',
  '{"nested":{"a":1,"\\u0061":2}}',
  '[1e999]',
  '[NaN]',
  '{"a":[{"b":1,"b":2}]}',
])('strict JSON rejects duplicate keys or nonfinite %s', (text) =>
  expect(() => strictJson(text)).toThrow(InputError),
);
it('strict JSON allows repeated names across objects, escaped strings and bounds nesting/bytes', () => {
  const rows = [{ a: 'x,:[' + String.fromCharCode(34) }, { a: 2 }];
  expect(strictJson(JSON.stringify(rows))).toEqual(rows);
  expect(() => strictJson('['.repeat(33) + '0' + ']'.repeat(33))).toThrow(InputError);
  expect(() => strictJson(JSON.stringify('x'.repeat(1024 * 1024)))).toThrow(InputError);
  expect(batchCustomers(JSON.stringify([customer, customer]), legacy)).toHaveLength(2);
  expect(() => batchCustomers(JSON.stringify(Array(101).fill(customer)), legacy)).toThrow(
    InputError,
  );
  expect(() => batchCustomers(JSON.stringify({ customers: [customer] }), legacy)).toThrow(
    InputError,
  );
});
it('snapshot adapter picks selected keys, maps legacy boolean only, rejects missing rather than defaults', () => {
  const snapshot = { ...customer, Total_Purchases: 10.4, Churned: false } as unknown as Snapshot;
  expect(adaptSnapshot(snapshot, legacy)).toEqual({ ...customer, Churned: 0 });
  expect(Object.keys(adaptSnapshot(snapshot, t4))).toEqual(t4.model.features);
  const missing = { ...snapshot } as Partial<Snapshot>;
  delete missing.Age;
  expect(() => adaptSnapshot(missing as Snapshot, t4)).toThrow(InputError);
});
it('wire result parity rejects wrong version/class/probabilities/scope and preserves unrounded values', () => {
  const result = fixture.rows[0]!.result;
  expect(verifyResult(result, '1.0.0')).toEqual(result);
  for (const changed of [
    { model_version: t4.model.model_version },
    { predicted_class: 9 },
    { probabilities: { Low: 1, Medium: 1, High: 1 } },
    { scope: 'future_forecast' },
    {
      purchase_level: 'Low',
      predicted_class: 0,
      probabilities: { Low: 0.1, Medium: 0.8, High: 0.1 },
    },
  ])
    expect(() => verifyResult({ ...result, ...changed }, '1.0.0')).toThrow();
});
it('CSV handles BOM, quoted comma/newline/doublequote and rejects malformed grammar', () => {
  expect(parseCsv('\uFEFFa,b\r\n"x,y","quoted""line\nnext"\r\n')).toEqual([
    ['a', 'b'],
    ['x,y', 'quoted"line\nnext'],
  ]);
  expect(() => parseCsv('a\n"unterminated')).toThrow();
  expect(() => parseCsv('a\n"x"trailing')).toThrow();
});
it('CSV validates exact keys, nullability, UTF8, row count and preserves string NA', async () => {
  await expect(
    inspectCsv(file(csv({ ...fixture.rows[1]!.customer, Country: 'NA', Age: null })), t4),
  ).resolves.toMatchObject({ total: 1 });
  await expect(inspectCsv(file(csv({ ...customer, Age: null })), legacy)).rejects.toThrow();
  await expect(
    inspectCsv(file(csv({ ...customer, Total_Purchases: 10 })), legacy),
  ).rejects.toThrow();
  await expect(
    inspectCsv(file(csv({ ...customer, customer_id: 'passthrough-only' })), legacy),
  ).resolves.toMatchObject({ total: 1 });
  await expect(inspectCsv(file('Age,Age\n1,2'), legacy)).rejects.toThrow();
  await expect(inspectCsv(file(csv(customer), 'data.txt'), legacy)).rejects.toThrow();
  const oversized = file('');
  Object.defineProperty(oversized, 'size', { value: 10 * 1024 * 1024 + 1 });
  await expect(inspectCsv(oversized, legacy)).rejects.toThrow();
  const invalid = file('');
  Object.defineProperty(invalid, 'arrayBuffer', {
    value: async () => new Uint8Array([0xff]).buffer,
  });
  await expect(inspectCsv(invalid, t4)).rejects.toThrow();
  const header = legacy.model.features.join(',');
  await expect(inspectCsv(file(header), legacy)).rejects.toThrow();
  await expect(
    inspectCsv(
      file(header + '\n' + Array(1001).fill(Object.values(customer).join(',')).join('\n')),
      legacy,
    ),
  ).rejects.toThrow();
});
it('CSV row errors report safe row/field without values; rejects hex rather than Number coercion', async () => {
  try {
    await inspectCsv(file(csv({ ...customer, Age: '0x40', Country: 'PRIVATE-CUSTOMER' })), legacy);
    throw new Error('Expected validation');
  } catch (error) {
    expect(error).toBeInstanceOf(InputError);
    expect((error as InputError).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ row: 2, field: 'Age' })]),
    );
    expect(JSON.stringify(error)).not.toContain('PRIVATE-CUSTOMER');
  }
});
it('CSV preview retains server result order/metadata and rejects count/model/class mismatch', () => {
  const result = fixture.rows[0]!.result;
  const row = {
    Model_ID: result.model_id,
    Model_Version: result.model_version,
    Generated_At: result.generated_at,
    Prediction_Task: result.task,
    Predicted_Class: result.predicted_class,
    Purchase_Level_Predicted: result.purchase_level,
    Probability_Low: result.probabilities.Low,
    Probability_Medium: result.probabilities.Medium,
    Probability_High: result.probabilities.High,
  };
  expect(csvPredictions(csv(row), legacy, 1)).toEqual([result]);
  expect(() => csvPredictions(csv(row), legacy, 2)).toThrow();
  expect(() => csvPredictions(csv(row), t4, 1)).toThrow();
});
