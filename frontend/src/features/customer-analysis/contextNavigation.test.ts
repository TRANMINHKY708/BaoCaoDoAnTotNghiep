import { expect, it } from 'vitest';
import { contextKey, profileLink, requestedContext } from './contextNavigation';
import { analysisLink } from './analysis';
const customer = '14000000-0000-4000-8000-000000000001';
const snapshot = '14000000-0000-4000-8000-000000000002';
it('uses only explicit ID context and fixed internal profile routes', () => {
  expect(analysisLink('/predictions', customer)).toBe(`/predictions?customer_id=${customer}`);
  expect(analysisLink('/segmentation', customer, snapshot)).toBe(
    `/segmentation?customer_id=${customer}&snapshot_id=${snapshot}`,
  );
  expect(profileLink(customer, snapshot)).toBe(
    `/customers/${customer}/analysis?snapshot_id=${snapshot}`,
  );
  expect(profileLink(customer)).toBe(`/customers/${customer}/analysis`);
  expect(profileLink('https://evil.example')).toBeNull();
  expect(profileLink(customer, '//evil.example')).toBeNull();
});
it('rejects ambiguous duplicate context and ignores redirect/model/feature parameters', () => {
  expect(
    requestedContext(
      new URLSearchParams(
        `customer_id=${customer}&snapshot_id=${snapshot}&return_to=https://evil.example&model_version=other`,
      ),
    ),
  ).toEqual({ customerId: customer, snapshotId: snapshot });
  expect(
    requestedContext(
      new URLSearchParams('customer_id=a&customer_id=b&snapshot_id=x&snapshot_id=y'),
    ),
  ).toEqual({ customerId: 'invalid', snapshotId: 'invalid' });
  expect(requestedContext(new URLSearchParams('customer_id=&snapshot_id='))).toEqual({
    customerId: 'invalid',
    snapshotId: 'invalid',
  });
  expect(
    contextKey(new URLSearchParams(`customer_id=${customer}&snapshot_id=${snapshot}`)),
  ).not.toBe(contextKey(new URLSearchParams(`customer_id=${customer}`)));
});
