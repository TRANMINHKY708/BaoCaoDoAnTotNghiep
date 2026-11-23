import { customerCode, customerSearch } from '../../components/customerIdentity';
import { TechnicalDetails } from '../../components/presentation';
import { useEffect, useEffectEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/errors';
import { profileLink } from '../customer-analysis/contextNavigation';
import { RequestedSnapshot } from './RequestedSnapshot';
import { useWorkspace } from '../../app/context';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { Pagination } from '../customers/CustomerShared';
import { dateTime, isCustomerId, type Snapshot } from '../customers/customers';

export function SnapshotPicker({
  initialId,
  initialSnapshotId = '',
  onPick,
  onCustomerChange,
}: {
  initialId: string;
  initialSnapshotId?: string;
  onPick: (item: Snapshot) => void;
  onCustomerChange: () => void;
}) {
  const { session, revision } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(''),
    [q, setQ] = useState(''),
    [offset, setOffset] = useState(0);
  const [customerId, setCustomerId] = useState(isCustomerId(initialId) ? initialId : ''),
    [snapshotOffset, setSnapshotOffset] = useState(0);
  const [requestedActive, setRequestedActive] = useState(true);
  const [pickedId, setPickedId] = useState('');
  const customers = useQuery({
    queryKey: ['prediction-customers', revision, q, offset],
    queryFn: ({ signal }) =>
      session.client.request('get', '/api/v1/customers', {
        signal,
        query: {
          ...(q ? { q: customerSearch(q) } : {}),
          offset,
          limit: 5,
          sort: 'external_id',
          direction: 'asc',
        },
      }),
  });
  const selected = useQuery({
    queryKey: ['customer-detail', revision, customerId],
    enabled: !!customerId,
    queryFn: async ({ signal }) => {
      const response = await session.client.request('get', '/api/v1/customers/{customer_id}', {
        signal,
        params: { customer_id: customerId },
      });
      if (response.data.id !== customerId) throw new ApiError('protocol');
      return response;
    },
  });
  const snapshots = useQuery({
    queryKey: ['prediction-snapshots', revision, customerId, snapshotOffset],
    enabled: !!customerId && selected.isSuccess && !selected.isFetching,
    queryFn: async ({ signal }) => {
      const response = await session.client.request(
        'get',
        '/api/v1/customers/{customer_id}/behaviors',
        {
          signal,
          params: { customer_id: customerId },
          query: { offset: snapshotOffset, limit: 5 },
        },
      );
      if (response.data.items.some((item) => item.customer_id !== customerId))
        throw new ApiError('protocol');
      return response;
    },
  });
  const invalidate = useEffectEvent(() => {
    if (selected.isFetching || selected.isError) {
      onCustomerChange();
    }
  });
  if (pickedId && (selected.isFetching || selected.isError)) setPickedId('');
  useEffect(() => {
    invalidate();
  }, [selected.isFetching, selected.isError]);
  const back =
    pickedId && selected.isSuccess && !selected.isFetching
      ? profileLink(customerId, pickedId)
      : null;
  return (
    <section className="prediction-picker" aria-label="Chọn khách hàng và snapshot">
      <h3>Chọn dữ liệu đã lưu</h3>

      {initialId && !isCustomerId(initialId) && (
        <p role="alert">customer_id trong đường dẫn không hợp lệ; chưa dùng ID này để gọi API.</p>
      )}
      {requestedActive &&
        initialSnapshotId &&
        (!isCustomerId(initialSnapshotId) || !isCustomerId(initialId)) && (
          <p role="alert">Ngữ cảnh snapshot trong đường dẫn không hợp lệ; chưa chọn bản ghi nào.</p>
        )}
      {requestedActive &&
        isCustomerId(initialSnapshotId) &&
        customerId === initialId &&
        selected.isSuccess &&
        !selected.isFetching && (
          <RequestedSnapshot
            customerId={customerId}
            snapshotId={initialSnapshotId}
            onPick={onPick}
            onClear={onCustomerChange}
          />
        )}
      {back && (
        <Link className="text-link" to={back}>
          Về hồ sơ phân tích
        </Link>
      )}
      <form
        className="prediction-search"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(search);
          setOffset(0);
        }}
      >
        <label>
          Tìm mã khách hàng
          <input
            value={search}
            maxLength={100}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button className="button button-secondary">Tìm khách hàng</button>
      </form>
      {customers.isPending ? (
        <LoadingState label="Đang tìm khách hàng…" />
      ) : customers.isError ? (
        <ErrorState
          error={customers.error}
          onRetry={() => {
            void customers.refetch();
          }}
        />
      ) : (
        <>
          {!customers.data.data.items.length ? (
            <EmptyState
              title="Không có khách hàng phù hợp"
              description="Hãy kiểm tra lại mã tìm kiếm hoặc chọn trang khác."
            />
          ) : (
            <ul className="prediction-snapshot-list">
              {customers.data.data.items.map((item) => (
                <li key={item.id}>
                  <span title={item.external_id}>{customerCode(item.external_id)}</span>
                  <button
                    type="button"
                    className="button button-secondary"
                    aria-pressed={item.id === customerId}
                    onClick={() => {
                      setCustomerId(item.id);
                      setSnapshotOffset(0);
                      setRequestedActive(false);
                      setPickedId('');
                      onCustomerChange();
                      if (params.has('customer_id') || params.has('snapshot_id')) {
                        const next = new URLSearchParams(params);
                        next.set('customer_id', item.id);
                        next.delete('snapshot_id');
                        setParams(next);
                      }
                    }}
                  >
                    Chọn {customerCode(item.external_id)}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Pagination
            offset={offset}
            limit={5}
            total={customers.data.data.total}
            count={customers.data.data.items.length}
            onChange={setOffset}
          />
        </>
      )}
      {customerId && (
        <div className="prediction-picked-customer">
          {selected.isPending ? (
            <LoadingState label="Đang tải khách hàng đã chọn…" />
          ) : selected.isError ? (
            <ErrorState
              error={selected.error}
              onRetry={() => {
                void selected.refetch();
              }}
            />
          ) : (
            <>
              <h3 title={selected.data.data.external_id}>
                Dữ liệu của {customerCode(selected.data.data.external_id)}
              </h3>
              {snapshots.isPending ? (
                <LoadingState label="Đang tải dữ liệu hành vi…" />
              ) : snapshots.isError ? (
                <ErrorState
                  error={snapshots.error}
                  onRetry={() => {
                    void snapshots.refetch();
                  }}
                />
              ) : (
                <>
                  {!snapshots.data.data.items.length ? (
                    <EmptyState
                      title="Khách hàng chưa có bản ghi hành vi"
                      description="Bạn có thể nhập thủ công; hệ thống không tạo dữ liệu thay thế."
                    />
                  ) : (
                    <ul className="prediction-snapshot-list">
                      {snapshots.data.data.items.map((item) => (
                        <li key={item.id}>
                          <div>
                            <strong>{dateTime(item.captured_at)}</strong>
                            <small>Nguồn dữ liệu: {item.source}</small>
                            <TechnicalDetails>
                              <p>Mã bản ghi: {item.id}</p>
                            </TechnicalDetails>
                          </div>
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => {
                              if (item.customer_id === customerId) {
                                setRequestedActive(false);
                                setPickedId(item.id);
                                onPick(item);
                              }
                            }}
                          >
                            Dùng bản ghi này
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Pagination
                    offset={snapshotOffset}
                    limit={5}
                    total={snapshots.data.data.total}
                    count={snapshots.data.data.items.length}
                    onChange={setSnapshotOffset}
                  />
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
