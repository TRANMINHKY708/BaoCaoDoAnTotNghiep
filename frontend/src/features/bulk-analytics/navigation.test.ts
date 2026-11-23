import { expect, it } from 'vitest';
import { filterRequest, initialDraft } from './filters';
import {
  checkedView,
  filterLocation,
  readFilters,
  returnToBatch,
  segmentationScope,
} from './navigation';
import type { BatchView } from './types';
const uuid = '11111111-1111-4111-8111-111111111111';
const identity = {
  task: 'segmentation',
  model_version: '1.0.0',
  artifact_sha256: 'a'.repeat(64),
  metadata_sha256: 'b'.repeat(64),
};
const draft = {
  ...initialDraft,
  import_job_id: uuid,
  analysis_job_id: uuid,
  purchase_level: 'Medium',
  cluster: '1',
  segmentation_model: `1.0.0|${identity.artifact_sha256}|${identity.metadata_sha256}`,
  date_from: '2026-11-01',
  date_to: '2026-11-05',
  customer_query: uuid,
};
it('round-trips all supported filters and server offset, preserving Vietnam dates and identity', () => {
  const location = filterLocation(draft, 100);
  expect(
    readFilters(new URLSearchParams(location.search), location.state.batchCustomerQuery),
  ).toEqual({ draft, offset: 100 });
  expect(filterRequest(draft).date_from).toBe('2026-10-31T17:00:00.000Z');
  expect(
    filterRequest({ ...initialDraft, import_job_id: 'ABCDEFAB-CDEF-4ABC-8ABC-ABCDEFABCDEF' })
      .import_job_id,
  ).toBe('abcdefab-cdef-4abc-8abc-abcdefabcdef');
});
it.each([
  'cluster=9',
  'cluster=NaN',
  'cluster=1&cluster=2',
  'offset=-1',
  'offset=1000001',
  'offset=1.5',
  'sort=other',
  'redirect=https://evil.example',
  'import_job_id=wrong',
  'customer_id=email@example.com',
  'date_from=2026-02-30&date_to=2026-03-01',
  'date_from=2026-11-01',
  'classification_model=other%7C%7C',
  'segmentation_model=1.0.0%7Cabc%7C',
])('rejects malformed/duplicate/unsupported URL before a backend query: %s', (query) => {
  expect(() => readFilters(new URLSearchParams(query))).toThrow();
});
it('keeps a non-UUID search out of URLs and requires its private navigation state to restore', () => {
  const input = { ...initialDraft, customer_query: 'store-private-id@example.com' };
  const target = filterLocation(input);
  expect(target.search).not.toContain('example');
  expect(
    readFilters(new URLSearchParams(target.search), target.state.batchCustomerQuery).draft
      .customer_query,
  ).toBe(input.customer_query);
  expect(() => readFilters(new URLSearchParams(target.search))).toThrow();
});
it('allows only a fixed internal return route with validated filter state', () => {
  const location = filterLocation(draft, 50);
  const params = new URLSearchParams({ batch_filters: location.search });
  expect(returnToBatch(params, location.state)?.to).toBe('/batch-analytics?' + location.search);
  for (const bad of [
    'https://evil.example',
    '//evil.example',
    'offset=1&offset=2',
    'cluster=1#external',
    'sort=anything',
    'x'.repeat(2049),
  ])
    expect(returnToBatch(new URLSearchParams({ batch_filters: bad }), {})).toBeNull();
  params.append('batch_filters', '');
  expect(returnToBatch(params, {})).toBeNull();
});
it('requires one exact segmentation identity; equal cluster numbers never join models', () => {
  const view = { models: [identity], rows: [] } as unknown as BatchView;
  expect(segmentationScope(view, initialDraft)).toEqual(identity);
  expect(segmentationScope({ ...view, models: [] }, initialDraft)).toBeNull();
  expect(
    segmentationScope(
      { ...view, models: [identity, { ...identity, artifact_sha256: 'c'.repeat(64) }] },
      initialDraft,
    ),
  ).toBeNull();
  expect(
    segmentationScope(
      { ...view, models: [{ ...identity, model_version: '2.0.0-snapshot-k3' }] },
      initialDraft,
    ),
  ).toBeNull();
  expect(
    segmentationScope(view, {
      ...initialDraft,
      segmentation_model: `1.0.0|${'c'.repeat(64)}|${identity.metadata_sha256}`,
    }),
  ).toBeNull();
  expect(
    segmentationScope(
      { ...view, rows: [{ ...identity, metadata_sha256: 'c'.repeat(64) }] as BatchView['rows'] },
      initialDraft,
    ),
  ).toBeNull();
});
it('checks echoed filters/page and does not silently accept another server scope', () => {
  const filters = filterRequest(initialDraft);
  const view = {
    offset: 0,
    limit: 50,
    total_rows: 0,
    rows: [],
    models: [],
    filters,
  } as unknown as BatchView;
  expect(checkedView(view, filters, 0)).toBe(view);
  expect(() => checkedView({ ...view, offset: 50 }, filters, 0)).toThrow();
  expect(() => checkedView({ ...view, filters: { ...filters, cluster: 2 } }, filters, 0)).toThrow();
});
