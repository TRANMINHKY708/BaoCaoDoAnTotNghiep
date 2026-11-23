import { ModelDetails } from '../../components/presentation';
import { modelName } from '../../components/presentationLabels';
import { roleLabel as accountRoleLabel } from '../auth/accounts';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CircleDot, RefreshCw, ShieldCheck } from 'lucide-react';
import { useWorkspace } from '../../app/context';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { ChurnModelCard } from '../churn/ChurnModelCard';

export default function SystemPage() {
  const { session, status, role, mode, user, revision } = useWorkspace();
  const catalog = useQuery({
    queryKey: ['model-catalog', revision],
    enabled: status === 'connected',
    queryFn: async ({ signal }) =>
      (await session.client.request('get', '/api/v1/model-info', { signal })).data,
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THÔNG TIN HỆ THỐNG</span>
          <h1>Hệ thống & mô hình</h1>
        </div>
        <span className="scope-badge">
          <CircleDot size={14} />
          {status === 'connected' ? 'Đã kết nối' : 'Chưa kết nối'}
        </span>
      </div>
      <section className="panel system-summary">
        <div>
          <span className="eyebrow">PHIÊN KẾT NỐI</span>
          <h2>
            {status === 'connected'
              ? mode === 'accounts'
                ? `${accountRoleLabel(user?.role)} · đã xác minh`
                : mode === 'local'
                  ? 'Trên máy · không xác thực'
                  : `${role === 'operator' ? 'Quyền vận hành' : 'Quyền xem'} · đã xác minh`
              : 'Chưa có phiên làm việc'}
          </h2>
        </div>
        <ShieldCheck size={30} />
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Danh mục mô hình</h2>
          <Link className="text-link" to="/models">
            Quản lý mô hình chi tiết →
          </Link>
          <button
            className="button button-small button-secondary"
            disabled={status !== 'connected' || catalog.isFetching}
            onClick={() => {
              void catalog.refetch();
            }}
          >
            <RefreshCw size={14} />
            Làm mới
          </button>
        </div>
        {status !== 'connected' ? (
          <EmptyState
            title="Kết nối để xem mô hình"
            description="Kết nối không gian làm việc để xem danh mục mô hình."
            connection
          />
        ) : catalog.isPending ? (
          <LoadingState />
        ) : catalog.isError ? (
          <ErrorState
            error={catalog.error}
            onRetry={() => {
              void catalog.refetch();
            }}
          />
        ) : !catalog.data.models.length ? (
          <EmptyState
            title="Chưa có mô hình trong catalog"
            description="Hiện chưa có mô hình trong danh mục. Không tự sử dụng phiên bản thay thế."
          />
        ) : (
          <div className="catalog-grid">
            {catalog.data.models.map((model) => (
              <article
                className="catalog-card"
                key={`${model.task}:${model.model_id}:${model.model_version}`}
              >
                <span className={`model-status ${model.available ? 'available' : ''}`}>
                  {model.available ? 'Khả dụng' : 'Chưa khả dụng'}
                </span>
                <span className="eyebrow">
                  {model.task === 'classification'
                    ? 'PHÂN LOẠI MỨC ĐỘ MUA'
                    : 'PHÂN KHÚC KHÁCH HÀNG'}
                </span>
                <h3>{modelName(model.task, model.model_version)}</h3>
                <ModelDetails model={model} />
                <dl>
                  <div>
                    <dt>Vai trò phiên bản</dt>
                    <dd>{model.is_default ? 'Phiên bản mặc định' : 'Phiên bản tùy chọn'}</dd>
                  </div>
                  <div>
                    <dt>Lưu kết quả</dt>
                    <dd>
                      {model.persistence_supported
                        ? 'Dành cho quyền vận hành'
                        : 'Chỉ phân tích, chưa hỗ trợ lưu'}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
            <ChurnModelCard />
          </div>
        )}
      </section>
      <div className="research-callout">
        <strong>Giới hạn khoa học luôn được giữ nguyên</strong>
        <p>
          Purchase_Level mô tả mức độ mua hàng trong snapshot. What-if là phản ứng của mô hình,
          không phải tác động nhân quả hoặc dự báo giao dịch tương lai. Khoảng cách K-Means không
          phải xác suất hay mức tin cậy. Thời điểm ghi nhận và ý nghĩa một số chỉ số tổng hợp trong
          dữ liệu chưa được xác minh đầy đủ.
        </p>
      </div>
    </>
  );
}
