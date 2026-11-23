import { customerCode, customerSearch } from '../../components/customerIdentity';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Plus, RefreshCw, Search, UsersRound } from 'lucide-react';
import { useWorkspace } from '../../app/context';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { CustomerEditor } from './CustomerEditor';
import { Pagination, StatusBadge, WriteNotice } from './CustomerShared';
import { dateTime, listFilters, number } from './customers';
import './customers.css';

function CustomerSearch({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [previous, setPrevious] = useState(value);
  if (previous !== value) {
    setPrevious(value);
    setDraft(value);
  }
  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => onSearch(draft), 400);
    return () => clearTimeout(timer);
  }, [draft, value, onSearch]);
  return (
    <label className="customer-search">
      <Search size={17} />
      <span className="sr-only">Tìm mã khách hàng</span>
      <input
        type="search"
        placeholder="Tìm theo mã khách hàng…"
        value={draft}
        maxLength={100}
        onChange={(e) => setDraft(e.target.value)}
      />
    </label>
  );
}

export default function CustomersPage() {
  const { revision } = useWorkspace();
  return <CustomerDirectory key={revision} />;
}

function CustomerDirectory() {
  const { session, status, revision, canWrite, mode } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const filters = listFilters(params);
  const [creating, setCreating] = useState(false);
  const query = useQuery({
    queryKey: ['customers', revision, filters],
    enabled: status === 'connected',
    queryFn: async ({ signal }) =>
      (
        await session.client.request('get', '/api/v1/customers', {
          query: { ...filters, q: customerSearch(filters.q) || undefined },
          signal,
        })
      ).data,
  });
  function change(values: Record<string, string | number | boolean>) {
    const next = new URLSearchParams(params);
    Object.entries(values).forEach(([key, value]) => {
      if (value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setParams(next);
  }
  return (
    <div className="customers-workspace">
      <div className="page-heading customer-page-heading">
        <div>
          <span className="eyebrow">QUẢN LÝ KHÁCH HÀNG</span>
          <h1>Khách hàng</h1>
        </div>
        {status === 'connected' && (mode !== 'accounts' || canWrite) && (
          <button
            className="button button-primary"
            disabled={!canWrite}
            onClick={() => setCreating(true)}
          >
            <Plus size={17} /> Thêm khách hàng
          </button>
        )}
      </div>
      {status !== 'connected' ? (
        <div className="panel">
          <EmptyState
            title="Kết nối để xem khách hàng"
            description="Không tải dữ liệu hoặc thực hiện thao tác khi chưa kết nối workspace."
            connection
          />
        </div>
      ) : (
        <>
          <WriteNotice />
          <section className="panel customer-directory" aria-labelledby="customer-directory-title">
            <div className="customer-section-heading">
              <div className="customer-section-title">
                <span className="customer-section-icon">
                  <UsersRound size={20} />
                </span>
                <div>
                  <h2 id="customer-directory-title">Danh sách khách hàng</h2>
                </div>
              </div>
              <button
                className="button button-secondary"
                disabled={query.isFetching}
                onClick={() => {
                  void query.refetch();
                }}
              >
                <RefreshCw size={15} /> Làm mới
              </button>
            </div>
            <div className="customer-filters">
              <CustomerSearch value={filters.q} onSearch={(q) => change({ q, offset: 0 })} />
              <label>
                Hiển thị
                <select
                  value={filters.include_inactive ? 'all' : 'active'}
                  onChange={(e) =>
                    change({ include_inactive: e.target.value === 'all', offset: 0 })
                  }
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="all">Tất cả trạng thái</option>
                </select>
              </label>
              <label>
                Sắp xếp
                <select
                  value={`${filters.sort}:${filters.direction}`}
                  onChange={(e) => {
                    const [sort = 'created_at', direction = 'desc'] = e.target.value.split(':');
                    change({ sort, direction, offset: 0 });
                  }}
                >
                  <option value="created_at:desc">Mới tạo trước</option>
                  <option value="created_at:asc">Cũ nhất trước</option>
                  <option value="external_id:asc">Mã tăng dần</option>
                  <option value="external_id:desc">Mã giảm dần</option>
                </select>
              </label>
              <label>
                Mỗi trang
                <select
                  value={filters.limit}
                  onChange={(e) => change({ limit: e.target.value, offset: 0 })}
                >
                  {[...new Set([10, 20, 50, 100, filters.limit])]
                    .sort((a, b) => a - b)
                    .map((n) => (
                      <option key={n} value={n}>
                        {n} khách
                      </option>
                    ))}
                </select>
              </label>
            </div>

            {query.isPending || query.isFetching ? (
              <LoadingState label="Đang tải danh sách khách hàng…" />
            ) : query.isError ? (
              <ErrorState
                error={query.error}
                onRetry={() => {
                  void query.refetch();
                }}
              />
            ) : (
              <>
                <div className="customer-result-summary">
                  <strong>{number(query.data.total)} khách hàng</strong>
                  <span>
                    theo bộ lọc hiện tại · dữ liệu ứng dụng, không phải dataset huấn luyện
                  </span>
                </div>
                {!query.data.items.length ? (
                  <>
                    <EmptyState
                      title={
                        filters.offset ? 'Trang này không còn bản ghi' : 'Chưa tìm thấy khách hàng'
                      }
                      description={
                        filters.offset
                          ? 'Dữ liệu có thể đã thay đổi hoặc đường dẫn đang ở trang vượt quá kết quả.'
                          : 'Thử đổi từ khóa hoặc chọn tất cả trạng thái. Không tạo dữ liệu demo tự động.'
                      }
                    />
                    {filters.offset > 0 && (
                      <button
                        className="button button-secondary"
                        onClick={() => change({ offset: 0 })}
                      >
                        Về trang đầu
                      </button>
                    )}
                  </>
                ) : (
                  <div
                    className="customer-table-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label="Bảng khách hàng, cuộn ngang nếu cần"
                  >
                    <table className="customer-table">
                      <thead>
                        <tr>
                          <th scope="col">Khách hàng</th>
                          <th scope="col">Trạng thái</th>
                          <th scope="col">Ngày tạo · TP.HCM</th>
                          <th scope="col">Cập nhật · TP.HCM</th>
                          <th scope="col">
                            <span className="sr-only">Xem hồ sơ</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {query.data.items.map((customer) => (
                          <tr key={customer.id}>
                            <td>
                              <Link className="customer-name" to={`/customers/${customer.id}`}>
                                <span className="customer-avatar">
                                  <UsersRound size={18} />
                                </span>
                                <strong title={customer.external_id}>
                                  {customerCode(customer.external_id)}
                                </strong>
                              </Link>
                            </td>
                            <td>
                              <StatusBadge active={customer.is_active} />
                            </td>
                            <td>{dateTime(customer.created_at)}</td>
                            <td>{dateTime(customer.updated_at)}</td>
                            <td>
                              <Link
                                className="customer-open"
                                aria-label={`Xem hồ sơ ${customerCode(customer.external_id)}`}
                                to={`/customers/${customer.id}`}
                              >
                                Chi tiết <ArrowRight size={15} />
                              </Link>
                              <Link
                                className="customer-open"
                                aria-label={`Xem hồ sơ phân tích ${customerCode(customer.external_id)}`}
                                to={`/customers/${customer.id}/analysis`}
                              >
                                Xem hồ sơ phân tích
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <Pagination
                  offset={filters.offset}
                  limit={filters.limit}
                  total={query.data.total}
                  count={query.data.items.length}
                  onChange={(offset) => change({ offset })}
                />
              </>
            )}
          </section>

          {creating && canWrite && (
            <CustomerEditor
              kind="create"
              onClose={() => setCreating(false)}
              onReload={() => {
                setCreating(false);
                void query.refetch();
              }}
              onDone={(customer) => {
                setCreating(false);
                if (customer) navigate(`/customers/${customer.id}`);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
