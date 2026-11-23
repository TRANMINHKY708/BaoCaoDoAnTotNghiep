import { filterRequest, initialDraft, type Draft } from './filters';
import type { BatchFilters, BatchView, ModelIdentity } from './types';
import { ApiError } from '../../api/errors';
import { isCustomerId } from '../customers/customers';

const fields = [
  'import_job_id',
  'analysis_job_id',
  'classification_model',
  'segmentation_model',
  'date_from',
  'date_to',
  'purchase_level',
  'cluster',
  'customer_id',
  'customer_filter',
  'offset',
] as const;
export function readFilters(params: URLSearchParams, privateQuery?: unknown) {
  const draft: Draft = { ...initialDraft };
  for (const key of params.keys())
    if (!(fields as readonly string[]).includes(key) || params.getAll(key).length !== 1)
      throw new Error('Đường dẫn có tham số không hỗ trợ hoặc bị lặp. Chưa truy vấn dữ liệu.');
  for (const key of fields) {
    if (key in draft && key !== 'customer_id' && key !== 'customer_filter')
      draft[key as keyof Draft] = params.get(key) ?? draft[key as keyof Draft];
  }
  if (params.has('customer_id')) {
    if (!isCustomerId(params.get('customer_id')!) || params.has('customer_filter'))
      throw new Error('Ngữ cảnh khách hàng trong đường dẫn không hợp lệ.');
    draft.customer_query = params.get('customer_id')!;
  }
  if (params.has('customer_filter')) {
    if (
      params.get('customer_filter') !== 'private' ||
      typeof privateQuery !== 'string' ||
      !privateQuery.trim()
    )
      throw new Error(
        'Bộ lọc tìm mã khách hàng không có trong phiên điều hướng này. Hãy mở lại từ dashboard hoặc đặt lại bộ lọc.',
      );
    draft.customer_query = privateQuery;
  }
  const rawOffset = params.get('offset') ?? '0';
  if (!/^(0|[1-9]\d*)$/.test(rawOffset) || Number(rawOffset) > 1_000_000)
    throw new Error('Vị trí trang trong đường dẫn không hợp lệ.');
  filterRequest(draft);
  return { draft, offset: Number(rawOffset) };
}

export function filterLocation(draft: Draft, offset = 0) {
  filterRequest(draft);
  const query = new URLSearchParams();
  for (const key of fields) {
    if (
      key in draft &&
      draft[key as keyof Draft] &&
      draft[key as keyof Draft] !== initialDraft[key as keyof Draft]
    )
      query.set(key, draft[key as keyof Draft]);
  }
  const customerQuery = draft.customer_query.trim();
  if (customerQuery)
    query.set(
      isCustomerId(customerQuery) ? 'customer_id' : 'customer_filter',
      isCustomerId(customerQuery) ? customerQuery : 'private',
    );
  if (offset) query.set('offset', String(offset));
  // Also validate internally created links. The only destination is this fixed route.
  readFilters(query, customerQuery);
  return {
    search: query.toString(),
    state: { batchCustomerQuery: isCustomerId(customerQuery) ? '' : customerQuery },
  };
}
export function returnToBatch(params: URLSearchParams, state: unknown) {
  if (!params.has('batch_filters')) return null;
  const query = params.get('batch_filters')!;
  if (params.getAll('batch_filters').length !== 1 || query.length > 2048 || /[?#]/.test(query))
    return null;
  try {
    const privateQuery =
      state && typeof state === 'object' && 'batchCustomerQuery' in state
        ? state.batchCustomerQuery
        : undefined;
    const parsed = readFilters(new URLSearchParams(query), privateQuery);
    const canonical = filterLocation(parsed.draft, parsed.offset);
    return {
      to: `/batch-analytics${canonical.search ? '?' + canonical.search : ''}`,
      state: canonical.state,
    };
  } catch {
    return null;
  }
}

export function segmentationScope(data: BatchView, draft: Draft): ModelIdentity | null {
  if (!Array.isArray(data.models)) return null;
  const [version, artifact, metadata] = draft.segmentation_model.split('|');
  const models = new Map(
    data.models
      .filter((m) => m.task === 'segmentation')
      .map((m) => [[m.task, m.model_version, m.artifact_sha256, m.metadata_sha256].join('|'), m]),
  );
  if (models.size !== 1) return null;
  const model = [...models.values()][0]!;
  if (
    model.model_version !== version ||
    !/^[a-f0-9]{64}$/.test(model.artifact_sha256) ||
    !/^[a-f0-9]{64}$/.test(model.metadata_sha256) ||
    (artifact && model.artifact_sha256 !== artifact) ||
    (metadata && model.metadata_sha256 !== metadata)
  )
    return null;
  if (
    data.rows.some(
      (r) =>
        r.task === 'segmentation' &&
        (r.model_version !== model.model_version ||
          r.artifact_sha256 !== model.artifact_sha256 ||
          r.metadata_sha256 !== model.metadata_sha256),
    )
  )
    return null;
  return model;
}

export function checkedView(view: BatchView, filters: BatchFilters, offset: number) {
  if (
    view.offset !== offset ||
    view.limit !== 50 ||
    !Number.isSafeInteger(view.total_rows) ||
    view.total_rows < 0 ||
    !Array.isArray(view.rows) ||
    !Array.isArray(view.models) ||
    view.rows.length > 50 ||
    !view.filters
  )
    throw new ApiError('protocol');
  for (const key of Object.keys(filters) as (keyof BatchFilters)[]) {
    const expected = filters[key] ?? null,
      actual = view.filters[key] ?? null;
    if (key === 'date_from' || key === 'date_to') {
      if (expected === null && actual === null) continue;
      if (Date.parse(String(expected)) === Date.parse(String(actual))) continue;
    } else if (actual === expected) continue;
    throw new ApiError('protocol');
  }
  return view;
}
