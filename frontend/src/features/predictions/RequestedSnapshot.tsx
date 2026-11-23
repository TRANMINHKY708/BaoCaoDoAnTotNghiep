import { useEffect, useEffectEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../../app/context';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { allPages, HistoryLimitError } from '../customer-analysis/analysis';
import { profileLink } from '../customer-analysis/contextNavigation';
import type { Snapshot } from '../customers/customers';

export function RequestedSnapshot({
  customerId,
  snapshotId,
  onPick,
  onClear,
}: {
  customerId: string;
  snapshotId: string;
  onPick: (snapshot: Snapshot) => void;
  onClear: () => void;
}) {
  const { session, revision } = useWorkspace();
  const query = useQuery({
    queryKey: ['requested-snapshot', revision, customerId, snapshotId],
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const rows = await allPages(
        async (offset) =>
          (
            await session.client.request('get', '/api/v1/customers/{customer_id}/behaviors', {
              params: { customer_id: customerId },
              query: { offset, limit: 100 },
              signal,
            })
          ).data,
        (row) => row.customer_id === customerId,
        (row) => row.id,
      );
      return rows.find((row) => row.id === snapshotId) ?? null;
    },
  });
  const deliver = useEffectEvent(() => {
    if (query.isSuccess && !query.isFetching && query.data) onPick(query.data);
    else onClear();
  });
  useEffect(() => {
    deliver();
  }, [query.data, query.isSuccess, query.isFetching, query.error]);

  if (query.isFetching || query.isPending)
    return <LoadingState label="Đang xác minh snapshot trong đường dẫn…" />;
  if (query.isError)
    return query.error instanceof HistoryLimitError ? (
      <p role="alert">{query.error.message}</p>
    ) : (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} />
    );
  if (!query.data)
    return (
      <EmptyState
        title="Không xác minh được snapshot trong đường dẫn"
        description="Snapshot không có trong dữ liệu của khách hàng này. Hãy kiểm tra đường dẫn hoặc chủ động chọn bản ghi khác; hệ thống không chọn thay."
      />
    );
  return (
    <p role="status">
      Đã xác minh snapshot {query.data.id.slice(0, 8)}.{' '}
      <Link className="text-link" to={profileLink(customerId, query.data.id)!}>
        Về hồ sơ phân tích
      </Link>
    </p>
  );
}
