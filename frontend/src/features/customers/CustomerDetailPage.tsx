import { customerCode } from '../../components/customerIdentity';
import { TechnicalDetails } from '../../components/presentation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  PencilLine,
  RefreshCw,
  UserRound,
  UserRoundX,
} from 'lucide-react';
import { useWorkspace } from '../../app/context';
import { ApiError } from '../../api/errors';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { CustomerEditor } from './CustomerEditor';
import { CustomerRecords } from './CustomerRecords';
import { StatusBadge, WriteNotice } from './CustomerShared';
import { dateTime, isCustomerId, isStrongEtag } from './customers';
import './customers.css';

export default function CustomerDetailPage() {
  const { customerId } = useParams();
  const { revision } = useWorkspace();
  return <CustomerDetail key={`${customerId}:${revision}`} />;
}

function CustomerDetail() {
  const { customerId = '' } = useParams();
  const location = useLocation();
  const { session, status, revision, canWrite, mode } = useWorkspace();
  const [editing, setEditing] = useState<'edit' | 'deactivate' | null>(null);
  const [success, setSuccess] = useState('');
  const valid = isCustomerId(customerId);
  const query = useQuery({
    queryKey: ['customer-detail', revision, customerId],
    enabled: status === 'connected' && valid,
    queryFn: ({ signal }) =>
      session.client.request('get', '/api/v1/customers/{customer_id}', {
        params: { customer_id: customerId },
        signal,
      }),
  });
  const customer = query.data?.data;
  const etag = query.data?.meta.etag ?? null;
  const reload = () => {
    setEditing(null);
    setSuccess('');
    void query.refetch();
  };
  return (
    <div className="customers-workspace">
      <Link className="text-link customer-back" to="/customers">
        <ArrowLeft size={15} /> Danh sách khách hàng
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">HỒ SƠ & DỮ LIỆU SNAPSHOT</span>
          <h1>Chi tiết khách hàng</h1>
        </div>
      </div>
      {status !== 'connected' ? (
        <div className="panel">
          <EmptyState
            title="Kết nối để xem hồ sơ"
            description="Không tải thông tin khách hàng khi chưa kết nối workspace."
            connection
          />
        </div>
      ) : !valid ? (
        <div className="panel">
          <EmptyState
            title="Đường dẫn khách hàng không hợp lệ"
            description="ID khách hàng phải là UUID. Hãy chọn hồ sơ từ danh sách; không gửi yêu cầu với ID sai."
          />
        </div>
      ) : query.isPending || query.isFetching ? (
        <LoadingState label="Đang tải hồ sơ khách hàng…" />
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.status === 404 ? (
          <div className="panel">
            <EmptyState
              title="Không tìm thấy khách hàng"
              description="Hồ sơ không tồn tại trong workspace này. Kiểm tra đường dẫn hoặc quay lại danh sách."
            />
          </div>
        ) : (
          <ErrorState error={query.error} onRetry={reload} />
        )
      ) : customer ? (
        <>
          <WriteNotice />
          {success && (
            <div className="customer-success" role="status">
              {success}
            </div>
          )}
          <section className="panel customer-profile" aria-label="Thông tin khách hàng">
            <div className="customer-profile-top">
              <span className="customer-profile-avatar">
                <UserRound size={30} />
              </span>
              <div className="customer-profile-name">
                <h2 title={customer.external_id}>{customerCode(customer.external_id)}</h2>
                <StatusBadge active={customer.is_active} />
              </div>
              <div className="customer-profile-actions">
                <button className="button button-secondary" onClick={reload}>
                  <RefreshCw size={15} /> Tải lại
                </button>
                {(mode !== 'accounts' || canWrite) && (
                  <>
                    <button
                      className="button button-primary"
                      disabled={!canWrite || !isStrongEtag(etag)}
                      onClick={() => {
                        setSuccess('');
                        setEditing('edit');
                      }}
                    >
                      <PencilLine size={15} /> Chỉnh sửa
                    </button>
                    <button
                      className="button button-secondary customer-deactivate"
                      disabled={!canWrite || !customer.is_active || !isStrongEtag(etag)}
                      onClick={() => {
                        setSuccess('');
                        setEditing('deactivate');
                      }}
                    >
                      <UserRoundX size={15} /> Ngưng hoạt động
                    </button>
                  </>
                )}
              </div>
            </div>
            <dl className="customer-profile-info">
              <div>
                <dt>ID hệ thống</dt>
                <dd>
                  <TechnicalDetails>
                    <code>{customer.id}</code>
                  </TechnicalDetails>
                </dd>
              </div>
              <div>
                <dt>Ngày tạo</dt>
                <dd>{dateTime(customer.created_at)}</dd>
              </div>
              <div>
                <dt>Cập nhật lần cuối</dt>
                <dd>{dateTime(customer.updated_at)}</dd>
              </div>
              {customer.deactivated_at && (
                <div>
                  <dt>Ngưng hoạt động lúc</dt>
                  <dd>{dateTime(customer.deactivated_at)}</dd>
                </div>
              )}
            </dl>
            {!isStrongEtag(etag) && (
              <p className="customer-form-error" role="alert">
                Chưa xác nhận được phiên bản dữ liệu. Chỉnh sửa và ngưng hoạt động đang tạm khóa để
                tránh ghi đè; vui lòng tải lại.
              </p>
            )}
            <div className="customer-context-links">
              <Link className="button button-secondary" to={`/customers/${customer.id}/analysis`}>
                Xem hồ sơ phân tích
              </Link>
              <Link
                className="text-link"
                to={`/segmentation?customer_id=${encodeURIComponent(customer.id)}`}
              >
                Phân nhóm từ dữ liệu này <ArrowUpRight size={14} />
              </Link>
              <Link
                className="text-link"
                to={`/predictions?customer_id=${encodeURIComponent(customer.id)}`}
              >
                Dự đoán từ dữ liệu này <ArrowUpRight size={14} />
              </Link>
              <Link className="text-link" to={`/customers/${customer.id}?tab=predictions`}>
                Lịch sử dự đoán <ArrowUpRight size={14} />
              </Link>
              <Link className="text-link" to={`/customers/${customer.id}?tab=segments`}>
                Lịch sử phân nhóm <ArrowUpRight size={14} />
              </Link>
              <Link
                className="text-link"
                to={`/what-if?customer_id=${encodeURIComponent(customer.id)}`}
              >
                Mô phỏng hành vi <ArrowUpRight size={14} />
              </Link>
            </div>
          </section>
          <CustomerRecords
            customerId={customer.id}
            predictionPath={location.pathname.endsWith('/prediction')}
          />
          {editing && canWrite && (
            <CustomerEditor
              key={`${customer.id}:${etag}`}
              kind={editing}
              customer={customer}
              etag={etag}
              onClose={() => setEditing(null)}
              onReload={reload}
              onDone={() => {
                setSuccess(
                  editing === 'edit'
                    ? 'Đã lưu thay đổi khách hàng.'
                    : 'Đã ngưng hoạt động. Snapshot và lịch sử được giữ nguyên.',
                );
                setEditing(null);
              }}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
