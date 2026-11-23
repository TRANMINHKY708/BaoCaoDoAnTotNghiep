import { isCustomerId } from '../customers/customers';

export function contextKey(params: URLSearchParams) {
  return JSON.stringify([params.getAll('customer_id'), params.getAll('snapshot_id')]);
}

export function requestedContext(params: URLSearchParams) {
  // Repeated parameters are ambiguous, never silently select one of them.
  return {
    customerId:
      params.getAll('customer_id').length > 1 || params.get('customer_id') === ''
        ? 'invalid'
        : (params.get('customer_id') ?? ''),
    snapshotId:
      params.getAll('snapshot_id').length > 1 || params.get('snapshot_id') === ''
        ? 'invalid'
        : (params.get('snapshot_id') ?? ''),
  };
}

export function profileLink(customerId: string, snapshotId?: string) {
  if (!isCustomerId(customerId) || (snapshotId && !isCustomerId(snapshotId))) return null;
  const query = snapshotId ? `?snapshot_id=${encodeURIComponent(snapshotId)}` : '';
  return `/customers/${encodeURIComponent(customerId)}/analysis${query}`;
}
