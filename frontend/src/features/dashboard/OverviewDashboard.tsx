import { customerCode } from '../../components/customerIdentity';
import { TechnicalDetails } from '../../components/presentation';
import { modelName, segmentCaption } from '../../components/presentationLabels';
import { lazy, Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity, Database, Filter, FlaskConical, RefreshCw, Users } from 'lucide-react';
import { useWorkspace } from '../../app/context';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import DashboardFoundation from './DashboardPage';
import {
  initialFilters,
  number,
  percent,
  segmentsFor,
  localTime,
  warningLabels,
} from './dashboard';
import type { DashboardFilters, Overview } from './dashboard';
import './dashboard.css';

const Charts = lazy(() => import('./DashboardCharts'));

function Stat({
  label,
  value,
  detail,
  icon: Icon = Database,
}: {
  label: string;
  value: number;
  detail: string;
  icon?: typeof Database;
}) {
  return (
    <article className="dashboard-stat" title={detail}>
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={17} />
      </div>
      <strong>{number(value)}</strong>
    </article>
  );
}

function Results({ data }: { data: Overview }) {
  return (
    <>
      <section aria-labelledby="workspace-heading">
        <div className="section-heading">
          <div>
            <h2 id="workspace-heading">Toàn bộ hệ thống</h2>
            <p>Tổng số hiện có, không phụ thuộc bộ lọc bên dưới.</p>
          </div>
          <span className="subtle-tag">Dữ liệu hiện có tại mốc đọc</span>
        </div>
        <div className="dashboard-stats">
          <Stat
            label="Khách hàng"
            value={data.workspace_totals.customers}
            detail="Tất cả khách hàng hiện có"
            icon={Users}
          />
          <Stat
            label="Đang hoạt động"
            value={data.workspace_totals.active_customers}
            detail="Trạng thái hiện tại, không phải lịch sử"
            icon={Activity}
          />
          <Stat
            label="Bản ghi hành vi"
            value={data.workspace_totals.behavior_snapshots}
            detail="Số bản ghi hành vi đã lưu"
          />
        </div>
      </section>
      <TechnicalDetails>
        <p>
          Phiên bản lưu trong hệ thống: {number(data.workspace_totals.registered_models)}. Đây là số
          bản đăng ký lịch sử, không phải số mô hình có thể chọn.
        </p>
      </TechnicalDetails>
      <div className="dashboard-window">
        <div>
          <span className="eyebrow">KỲ ĐANG HIỂN THỊ · TP.HCM</span>
          <h2>
            {data.filters.date_from} → {data.filters.date_to} <small>(không gồm ngày cuối)</small>
          </h2>
          <p>
            Mốc dữ liệu: {localTime(data.as_of)} · Hoàn tất: {localTime(data.generated_at)}
          </p>
          <TechnicalDetails>
            Cửa sổ hiệu lực: [{localTime(data.filters.window_start)},{' '}
            {localTime(data.filters.window_end)})
          </TechnicalDetails>
        </div>
        <div className="cohort-chip">
          <Users size={18} />
          <strong>{number(data.cohort.customers)}</strong>
          <span>
            khách trong tập đang xem
            <br />
            gồm ngưng hoạt động
          </span>
        </div>
      </div>
      <p className="cohort-rule">
        {data.filters.segment_id
          ? `Lọc khách hàng theo phân nhóm mới nhất trong kỳ: ${segmentCaption(data.filters.segment_id)}`
          : 'Cohort: mọi khách hàng hiện có. Không mang nhãn kỳ trước sang kỳ này.'}
      </p>
      <div className="dashboard-two-columns">
        {(['classification', 'segmentation'] as const).map((task) => {
          const panel = data[task];
          return (
            <section className="panel result-summary" key={task}>
              <span className="eyebrow">
                {task === 'classification' ? 'PHÂN LOẠI · XGBOOST' : 'PHÂN KHÚC · K-MEANS'}
              </span>
              <h2>
                {task === 'classification'
                  ? 'Kết quả mức độ mua hàng'
                  : 'Kết quả phân nhóm tương tác'}
              </h2>
              <p className="model-version">
                {modelName(task, panel.model.model_version)} ·{' '}
                {panel.model.persistence_supported ? 'Có lưu lịch sử' : 'Chưa hỗ trợ lưu kết quả'}
              </p>
              <div className="result-numbers">
                <div>
                  <strong>{number(panel.stored_results.total)}</strong>
                  <span>lượt kết quả lưu</span>
                </div>
                <div>
                  <strong>{number(panel.customers.with_result)}</strong>
                  <span>khách có nhãn trong kỳ</span>
                </div>
              </div>
              <p>
                {number(panel.stored_results.linked)} lượt liên kết ·{' '}
                {number(panel.stored_results.unlinked)} lượt không liên kết ·{' '}
                {number(panel.stored_results.excluded_unlinked)} lượt không liên kết bị loại bởi
                cohort
              </p>
              <p>Mới nhất: {localTime(panel.latest_result_at)}</p>
              <details className="model-detail">
                <summary>Thông tin kỹ thuật</summary>
                <p>{panel.model.model_id}</p>
                <code>{panel.model.artifact_sha256}</code>
                <p>
                  {panel.model.available_for_inference
                    ? 'Suy luận sẵn sàng'
                    : 'Suy luận chưa sẵn sàng; vẫn đọc lịch sử hợp lệ'}{' '}
                  · Không chạy suy luận mới cho Dashboard.
                </p>
              </details>
            </section>
          );
        })}
      </div>
      {!data.classification.stored_results.total && !data.segmentation.stored_results.total && (
        <EmptyState
          title="Chưa có kết quả mô hình trong kỳ"
          description="Bạn có thể chọn kỳ khác. Những phiên bản chỉ hỗ trợ phân tích sẽ không có lịch sử lưu."
        />
      )}
      <Suspense fallback={<LoadingState label="Đang mở biểu đồ…" />}>
        <Charts data={data} />
      </Suspense>
      {data.classification.mean_probabilities && (
        <section className="panel mean-panel">
          <h2>Xác suất trung bình của nhãn mới nhất</h2>
          <div className="mean-values">
            {(['Low', 'Medium', 'High'] as const).map((label) => (
              <span key={label}>
                {label}{' '}
                <strong>{percent(data.classification.mean_probabilities?.[label] ?? null)}</strong>
              </span>
            ))}
          </div>
          <p>
            Mẫu số: {number(data.classification.customers.with_result)} khách có kết quả phân loại
            trong kỳ. Không phải độ chính xác, xác suất giao dịch tương lai hay calibration.
          </p>
        </section>
      )}
      <section className="panel what-if-summary">
        <div>
          <span className="eyebrow">MÔ PHỎNG · THỐNG KÊ RIÊNG</span>
          <h2>Kịch bản mô phỏng đã lưu</h2>
          <p>
            Chỉ áp dụng khoảng thời gian và tập khách hàng, không áp dụng bộ lọc phiên bản mô hình
            phía trên.
          </p>
          <p>Chỉ đếm kịch bản đã lưu; không gộp với kết quả dự đoán hoặc phân nhóm thông thường.</p>
        </div>
        <div className="what-if-counts">
          <div>
            <strong>{number(data.what_if.scenarios)}</strong>
            <span>kịch bản</span>
          </div>
          <div>
            <strong>{number(data.what_if.scenario_results)}</strong>
            <span>kết quả thuộc kịch bản</span>
          </div>
        </div>
        <p>
          Mới nhất: {localTime(data.what_if.latest_scenario_at)} ·{' '}
          {number(data.what_if.excluded_unlinked_scenarios)} kịch bản không liên kết bị loại
        </p>
      </section>
      <section className="panel recent-panel">
        <div className="panel-heading">
          <h2>Khách hàng gần đây</h2>
          <span className="subtle-tag">
            Preview · {data.recent_customers.items.length}/
            {number(data.recent_customers.cohort_total)}
          </span>
        </div>

        {!data.recent_customers.items.length ? (
          <EmptyState
            title="Chưa có khách hàng trong cohort"
            description="Không tự tạo khách hàng hoặc liên kết kết quả CSV để lấp bảng."
          />
        ) : (
          <div className="dashboard-table-scroll">
            <table className="recent-table">
              <caption>Khách hàng theo thời điểm tạo giảm dần; nhãn thiếu được giữ trống</caption>
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Trạng thái hiện tại</th>
                  <th>Purchase_Level trong kỳ</th>
                  <th>Phân nhóm trong kỳ</th>
                  <th>Ngày tạo · TP.HCM</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_customers.items.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Khách hàng">
                      <Link className="text-link" to={`/customers/${c.id}`}>
                        <strong title={c.external_id}>{customerCode(c.external_id)}</strong>
                      </Link>
                    </td>
                    <td data-label="Trạng thái">
                      <span className={`status-pill ${c.is_active ? 'is-active' : ''}`}>
                        {c.is_active ? 'Đang hoạt động' : 'Ngưng hoạt động'}
                      </span>
                    </td>
                    <td data-label="Purchase_Level">
                      {c.purchase_in_window ? (
                        <>
                          <strong>{c.purchase_in_window.purchase_level}</strong>
                          <small>{localTime(c.purchase_in_window.created_at)}</small>
                        </>
                      ) : (
                        <span className="missing-label">Chưa có trong kỳ</span>
                      )}
                    </td>
                    <td data-label="Phân nhóm">
                      {c.segment_in_window ? (
                        <>
                          <strong>
                            {c.segment_in_window.display_label ?? c.segment_in_window.segment_id}
                          </strong>
                          <details className="technical-details">
                            <summary>Mã nhóm</summary>
                            <code>{c.segment_in_window.segment_id}</code>
                          </details>
                          <small>{localTime(c.segment_in_window.created_at)}</small>
                        </>
                      ) : (
                        <span className="missing-label">Chưa có trong kỳ</span>
                      )}
                    </td>
                    <td data-label="Ngày tạo TP.HCM">{localTime(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="dashboard-notes">
        <div>
          <FlaskConical size={20} />
          <h2>Đọc đúng dữ liệu, hiểu đúng giới hạn</h2>
        </div>
        <p>
          Nguồn: PostgreSQL ứng dụng · Không dùng dataset nghiên cứu. Phân tích snapshot, không phải
          dự báo giao dịch trong N ngày. What-if mô phỏng phản ứng của model, không chứng minh tác
          động nhân quả. Purchase_Level không đồng nghĩa phân nhóm tương tác.
        </p>
        <details>
          <summary>Chi tiết phạm vi và cảnh báo ({data.warnings.length})</summary>
          <ul>
            {data.warnings.map((code) => (
              <li key={code}>{warningLabels[code]}</li>
            ))}
          </ul>
        </details>
      </section>
    </>
  );
}

export default function OverviewDashboard() {
  const { session, status, revision } = useWorkspace();
  const [draft, setDraft] = useState<DashboardFilters>(initialFilters);
  const [filters, setFilters] = useState<DashboardFilters>(initialFilters);
  const [formError, setFormError] = useState('');
  const query = useQuery({
    queryKey: ['dashboard-overview', revision, filters],
    enabled: status === 'connected',
    queryFn: async ({ signal }) =>
      (
        await session.client.request('get', '/api/v1/dashboard/overview', {
          query: filters,
          signal,
        })
      ).data,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  if (status !== 'connected') return <DashboardFoundation />;
  return (
    <div className="dashboard-live">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PHÂN TÍCH KHÁCH HÀNG</span>
          <h1>Tổng quan</h1>
        </div>
        <button
          className="button button-secondary"
          disabled={query.isFetching}
          onClick={() => {
            void query.refetch();
          }}
        >
          <RefreshCw size={15} className={query.isFetching ? 'spin' : ''} />
          Làm mới
        </button>
      </div>
      <div className="dashboard-source">
        <span>
          <i /> Dữ liệu đã lưu
        </span>
        <span>Chỉ tổng hợp kết quả đã lưu</span>
      </div>
      <form
        className="panel dashboard-filters"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            !!draft.date_from !== !!draft.date_to ||
            (draft.date_from && draft.date_to && draft.date_from >= draft.date_to)
          ) {
            setFormError('Nhập cả hai ngày TP.HCM, ngày kết thúc phải sau ngày bắt đầu.');
            return;
          }
          setFormError('');
          setFilters({
            ...draft,
            date_from: draft.date_from || undefined,
            date_to: draft.date_to || undefined,
            segment_id: draft.segment_id || undefined,
          });
        }}
      >
        <div className="filter-heading">
          <Filter size={16} />
          <strong>Bộ lọc phân tích</strong>
          <span>Để trống hai ngày: 30 ngày lịch TP.HCM gần nhất theo đồng hồ server</span>
        </div>
        <div className="filter-grid">
          <label>
            Từ ngày · TP.HCM
            <input
              type="date"
              value={draft.date_from ?? ''}
              onChange={(e) => setDraft({ ...draft, date_from: e.target.value })}
            />
          </label>
          <label>
            Đến ngày · TP.HCM (không gồm)
            <input
              type="date"
              value={draft.date_to ?? ''}
              onChange={(e) => setDraft({ ...draft, date_to: e.target.value })}
            />
          </label>
          <label>
            Mô hình mức độ mua hàng
            <select
              value={draft.classification_model_version}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  classification_model_version: e.target
                    .value as DashboardFilters['classification_model_version'],
                })
              }
            >
              <option value="1.0.0">{modelName('classification', '1.0.0')}</option>
              <option value="2.0.0-snapshot-conservative12">
                {modelName('classification', '2.0.0-snapshot-conservative12')}
              </option>
            </select>
          </label>
          <label>
            Mô hình phân nhóm
            <select
              value={draft.segmentation_model_version}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  segmentation_model_version: e.target
                    .value as DashboardFilters['segmentation_model_version'],
                  segment_id: undefined,
                })
              }
            >
              <option value="1.0.0">{modelName('segmentation', '1.0.0')}</option>
              <option value="2.0.0-snapshot-k3">
                {modelName('segmentation', '2.0.0-snapshot-k3')}
              </option>
            </select>
          </label>
          <label>
            Phân nhóm mới nhất trong kỳ
            <select
              value={draft.segment_id ?? ''}
              onChange={(e) => setDraft({ ...draft, segment_id: e.target.value || undefined })}
            >
              <option value="">Mọi khách hàng · gồm ngưng hoạt động</option>
              {segmentsFor(draft.segmentation_model_version).map((id) => (
                <option key={id} value={id}>
                  {segmentCaption(id)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Số khách xem trước
            <select
              value={draft.table_limit}
              onChange={(e) => setDraft({ ...draft, table_limit: Number(e.target.value) })}
            >
              {[1, 10, 20].map((n) => (
                <option key={n} value={n}>
                  {n} khách hàng
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="filter-actions">
          <small>Chọn tối đa 366 ngày. Phiên bản mô hình chỉ dùng để lọc kết quả đã lưu.</small>
          <button className="button button-primary" type="submit">
            Áp dụng bộ lọc
          </button>
        </div>
        {formError && (
          <p className="filter-error" role="alert">
            {formError}
          </p>
        )}
      </form>
      {query.isPending || query.isFetching ? (
        <LoadingState label="Đang tổng hợp dữ liệu…" />
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <Results data={query.data} />
      )}
    </div>
  );
}
