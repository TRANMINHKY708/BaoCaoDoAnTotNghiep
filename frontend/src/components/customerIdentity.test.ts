import { expect, it } from 'vitest';
import { customerCode, customerSearch } from './customerIdentity';

it('formats imported identifiers as short stable presentation aliases', () => {
  const original = `bulk:${'abcdef0123'.repeat(6)}abcd`;
  expect(customerCode(original)).toBe('KH-ABCDEF0123');
  expect(original).toHaveLength(69);
  expect(customerCode(original)).toBe(customerCode(original));
});

it.each(['VIDEO-DEMO-001', 'KAGGLE-V1-ROW-000001', 'bulk:manual', 'KH-001'])(
  'preserves existing external ID %s',
  (value) => expect(customerCode(value)).toBe(value),
);

it('makes the visible short code searchable with the existing substring API', () => {
  const original = `bulk:${'0123456789'.repeat(6)}abcd`;
  const query = customerSearch(customerCode(original));
  expect(original.toLowerCase()).toContain(query.toLowerCase());
  expect(customerSearch('VIDEO-DEMO-001')).toBe('VIDEO-DEMO-001');
  expect(customerSearch('KH-001')).toBe('KH-001');
});
