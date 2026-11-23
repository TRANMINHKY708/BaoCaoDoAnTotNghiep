import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Download, RefreshCw, Sparkles } from 'lucide-react';
import { useWorkspace } from '../../app/context';
import { ApiError } from '../../api/errors';
import { customerCode } from '../../components/customerIdentity';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { SafeMarkdown } from '../assistant/SafeMarkdown';
import { assistantError } from '../assistant/assistant';
import { downloadBlob } from '../predictions/csv';
import { vietnamDateTime } from '../bulk/time';
import { filterRequest, initialDraft } from './filters';
import type { Draft } from './filters';
import type { BatchNarrative, BatchView } from './types';
import { checkedView, filterLocation, readFilters, segmentationScope } from './navigation';
import { profileLink } from '../customer-analysis/contextNavigation';
import { FeatureComparison } from './FeatureComparison';
import { InsightPanel } from './InsightPanel';
import { PendingLots } from './PendingLots';
import { supportedFeatures } from './comparisonData';
import type { InsightTarget } from './insights';
import { productText } from '../../utils/productText';
import { narrativeText } from '../../utils/narrativeText';
import '../dashboard/dashboard.css';
import '../bulk/bulk.css';
import './analytics.css';

const cards: Record<string, string> = {
  customers: 'Khách hàng duy nhất',
  snapshots: 'Snapshot hợp lệ',
  import_jobs: 'Lô nhập dữ liệu',
  analysis_jobs: 'Tác vụ phân tích',
  analyzed_customers: 'Khách có kết quả đã lưu',
  stored_results: 'Kết quả ML đã lưu',
  failed_items: 'Dòng xử lý thất bại',
  skipped_items: 'Dòng bị bỏ qua',
};
const featureLabels: Record<string, string> = {
  Login_Frequency: 'Tần suất đăng nhập',
  Session_Duration_Avg: 'Thời lượng phiên',
  Pages_Per_Session: 'Số trang mỗi phiên',
  Cart_Abandonment_Rate: 'Tỷ lệ bỏ giỏ (%)',
  Wishlist_Items: 'Sản phẩm yêu thích',
  Total_Purchases: 'Số lần mua',
  Average_Order_Value: 'Giá trị đơn trung bình (đơn vị nguồn)',
  Days_Since_Last_Purchase: 'Ngày từ lần mua gần nhất',
  Discount_Usage_Rate: 'Tỷ lệ dùng giảm giá (%)',
  Mobile_App_Usage: 'Mức sử dụng ứng dụng',
};
const titles = {
  overview: 'Tổng quan',
  notable_factors: 'Điểm đáng chú ý',
  interpretation: 'Diễn giải',
  limitations: 'Giới hạn',
  reference_suggestions: 'Gợi ý tham khảo',
};
const statusLabels: Record<string, string> = {
  queued: 'Chờ xử lý',
  running: 'Đang xử lý',
  completed: 'Hoàn tất',
  failed: 'Có lỗi',
};

export default function BatchAnalyticsPage() {
  const { revision } = useWorkspace();
  const location = useLocation();
  return <Workspace key={`${revision}:${location.key}`} />;
}

function Workspace() {
  const { session, status, revision, hasCapability } = useWorkspace();
  const allowed =
    session.accountMode &&
    status === 'connected' &&
    ['history.read', 'customers.read', 'models.read'].every((c) =>
      hasCapability(c as 'history.read' | 'customers.read' | 'models.read'),
    );
  const location = useLocation(),
    navigate = useNavigate();
  let parsed: ReturnType<typeof readFilters> | undefined;
  let urlError = '';
  try {
    parsed = readFilters(new URLSearchParams(location.search), location.state?.batchCustomerQuery);
  } catch (error) {
    urlError = error instanceof Error ? error.message : 'Đường dẫn bộ lọc không hợp lệ.';
  }
  const applied = parsed?.draft ?? initialDraft;
  const offset = parsed?.offset ?? 0;
  const [draft, setDraft] = useState<Draft>(applied);
  const [inputError, setInputError] = useState('');
  const [filterNotice, setFilterNotice] = useState('');
  const [featureChoice, setFeatureChoice] = useState('');
  const filters = filterRequest(applied);
  const options = useQuery({
    queryKey: ['batch-analytics-options', revision, draft.import_job_id],
    enabled: allowed && !urlError,
    queryFn: ({ signal }) =>
      session.client.batchAnalyticsOptions(draft.import_job_id || undefined, signal),
  });
  const query = useQuery({
    queryKey: ['batch-analytics', revision, filters, offset],
    enabled: allowed && !urlError,
    queryFn: async ({ signal }) =>
      checkedView(await session.client.batchAnalytics(filters, offset, signal), filters, offset),
  });
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied);
  const featureKeys = query.data ? supportedFeatures(query.data.cluster_profiles) : [];
  const selectedFeature = featureKeys.find((key) => key === featureChoice) ?? featureKeys[0];
  function showEvidence(target: InsightTarget) {
    if (target.feature_key) setFeatureChoice(target.feature_key);
    const element = document.getElementById(`batch-evidence-${target.section}`);
    element?.focus({ preventScroll: true });
    element?.scrollIntoView({ block: 'start' });
  }
  const scope =
    query.data && !query.isFetching && !query.isError
      ? segmentationScope(query.data, applied)
      : null;
  const currentLocation = filterLocation(applied, offset);
  function go(next: Draft, nextOffset = 0) {
    const destination = filterLocation(next, nextOffset);
    navigate(
      { pathname: '/batch-analytics', search: destination.search ? '?' + destination.search : '' },
      { state: destination.state },
    );
  }
  function change(name: keyof Draft, value: string) {
    setDraft((old) => ({
      ...old,
      [name]: value,
      ...(name === 'import_job_id' ? { analysis_job_id: '' } : {}),
      ...(name === 'segmentation_model' ? { cluster: '' } : {}),
    }));
    setInputError('');
    setFilterNotice(
      name === 'segmentation_model' && draft.cluster !== ''
        ? 'Đã xóa cluster cũ khi đổi mô hình phân nhóm. Hãy chọn nhóm trong phạm vi mô hình mới.'
        : '',
    );
  }
  function apply(event: React.FormEvent) {
    event.preventDefault();
    try {
      filterRequest(draft);
      go({ ...draft });
      setInputError('');
    } catch (e) {
      setInputError(e instanceof Error ? e.message : 'Bộ lọc chưa hợp lệ.');
    }
  }
  if (!allowed)
    return (
      <EmptyState
        title="Cần đăng nhập workspace"
        description="Dashboard dùng chung dành cho tài khoản có quyền đọc khách hàng và lịch sử. Không cấp quyền nhập hoặc sửa dữ liệu."
      />
    );
  if (urlError)
    return (
      <section className="panel">
        <h1>Bộ lọc đường dẫn chưa hợp lệ</h1>
        <p role="alert">{urlError}</p>
        <button className="button" onClick={() => go(initialDraft)}>
          Đặt lại bộ lọc an toàn
        </button>
      </section>
    );
  return (
    <div className="batch-analytics">
      <div className="page-heading">
        <div>
          <span className="eyebrow">GÓC NHÌN DỮ LIỆU DOANH NGHIỆP</span>
          <h1>Phân tích hàng loạt</h1>
        </div>
        <BarChart3 aria-hidden="true" />
      </div>
      <PendingLots />
      <section className="panel">
        <h2>Phạm vi phân tích</h2>

        <form onSubmit={apply} className="batch-filters">
          <label>
            Lô nhập
            <select
              value={draft.import_job_id}
              onChange={(e) => change('import_job_id', e.target.value)}
            >
              <option value="">Tất cả lô có tác vụ</option>
              {draft.import_job_id &&
                !options.data?.imports.some((j) => j.job_id === draft.import_job_id) && (
                  <option value={draft.import_job_id}>
                    Lô {draft.import_job_id.slice(0, 8)} · ngoài danh sách gần nhất
                  </option>
                )}
              {options.data?.imports.map((j) => (
                <option key={j.job_id} value={j.job_id}>
                  {j.filename} · {vietnamDateTime(j.created_at)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tác vụ
            <select
              value={draft.analysis_job_id}
              onChange={(e) => change('analysis_job_id', e.target.value)}
            >
              <option value="">Tất cả tác vụ phù hợp</option>
              {draft.analysis_job_id &&
                !options.data?.analyses.some((j) => j.id === draft.analysis_job_id) && (
                  <option value={draft.analysis_job_id}>
                    Tác vụ {draft.analysis_job_id.slice(0, 8)} · ngoài danh sách gần nhất
                  </option>
                )}
              {options.data?.analyses.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.task === 'classification' ? 'Mức mua' : 'Phân nhóm'} ·{' '}
                  {statusLabels[j.status] ?? 'Chưa rõ trạng thái'} · {j.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          {(['classification', 'segmentation'] as const).map((task) => (
            <label key={task}>
              {task === 'classification' ? 'Mô hình mức mua' : 'Mô hình phân nhóm'}
              <select
                value={draft[`${task}_model`]}
                onChange={(e) => change(`${task}_model`, e.target.value)}
              >
                <option value="1.0.0||">Bản ban đầu (1.0.0)</option>
                {draft[`${task}_model`] !== '1.0.0||' &&
                  !options.data?.models.some(
                    (m) =>
                      m.task === task &&
                      `${m.model_version}|${m.artifact_sha256}|${m.metadata_sha256}` ===
                        draft[`${task}_model`],
                  ) && (
                    <option value={draft[`${task}_model`]}>
                      Danh tính từ đường dẫn · cần đối chiếu kết quả
                    </option>
                  )}
                {options.data?.models
                  .filter((m) => m.task === task)
                  .map((m) => (
                    <option
                      key={`${m.model_version}|${m.artifact_sha256}|${m.metadata_sha256}`}
                      value={`${m.model_version}|${m.artifact_sha256}|${m.metadata_sha256}`}
                    >
                      {m.model_version === '1.0.0'
                        ? 'Bản ban đầu'
                        : 'Bản nâng cao · không lưu kết quả'}{' '}
                      · {m.artifact_sha256.slice(0, 8)}
                    </option>
                  ))}
              </select>
            </label>
          ))}
          <label>
            Từ ngày tạo tác vụ (giờ VN)
            <input
              type="date"
              value={draft.date_from}
              onChange={(e) => change('date_from', e.target.value)}
            />
          </label>
          <label>
            Đến hết ngày (giờ VN)
            <input
              type="date"
              value={draft.date_to}
              onChange={(e) => change('date_to', e.target.value)}
            />
          </label>
          <label>
            Mức mua
            <select
              value={draft.purchase_level}
              onChange={(e) => change('purchase_level', e.target.value)}
            >
              <option value="">Tất cả</option>
              {['Low', 'Medium', 'High'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Nhóm khách hàng
            <select value={draft.cluster} onChange={(e) => change('cluster', e.target.value)}>
              <option value="">Tất cả</option>
              {[0, 1, 2].map((v) => (
                <option key={v} value={v}>
                  Nhóm {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tìm mã khách hàng
            <input
              value={draft.customer_query}
              maxLength={100}
              onChange={(e) => change('customer_query', e.target.value)}
              placeholder="UUID, mã nguồn hoặc mã KH…"
            />
          </label>
          <div className="bulk-actions">
            <button className="button" type="submit">
              Áp dụng bộ lọc
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                go(initialDraft);
              }}
            >
              Đặt lại
            </button>
          </div>
        </form>
        {inputError && <p role="alert">{inputError}</p>}
        {filterNotice && <p role="status">{filterNotice}</p>}
        {applied.cluster !== '' && (
          <div className="bulk-actions">
            <span>Đang xem nhóm {applied.cluster} theo mô hình đã chọn.</span>
            <button
              className="button button-secondary"
              disabled={dirty}
              onClick={() => go({ ...applied, cluster: '' })}
            >
              Bỏ lọc nhóm
            </button>
          </div>
        )}
        {dirty && <p role="status">Bấm Áp dụng để cập nhật bộ lọc.</p>}
        {options.data && Object.values(options.data.truncated).some(Boolean) && (
          <p>
            Danh sách lựa chọn giới hạn {options.data.limit} mục gần nhất. Có thể lọc lô nhập trước
            để thu hẹp tác vụ.
          </p>
        )}
        {options.isError && <ErrorState error={options.error} />}
      </section>
      <div className="bulk-actions">
        <button
          className="button button-secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCw size={16} /> Tải lại số liệu
        </button>
        <Link to="/bulk-import">Mở nhập dữ liệu và chạy phân tích</Link>
      </div>
      {query.isFetching && <LoadingState label="Đang tổng hợp dữ liệu theo bộ lọc…" />}
      {query.isError && <ErrorState error={query.error} />}
      {!query.isError && !query.isFetching && query.data && (
        <>
          <p>
            Mốc đọc: {vietnamDateTime(query.data.as_of)} ·{' '}
            {query.data.total_rows.toLocaleString('vi-VN')} dòng kết quả/trạng thái sau chống trùng.
          </p>
          <div className="dashboard-stats">
            {Object.entries(cards).map(([key, label]) => (
              <article
                className="dashboard-stat"
                key={key}
                title={productText(query.data.definitions[key] ?? '')}
              >
                <span>{label}</span>
                <strong>{query.data.kpis[key]?.toLocaleString('vi-VN')}</strong>
              </article>
            ))}
          </div>
          <p>
            Tiến độ xử lý: {query.data.kpis.successful_items} lượt thành công, trong đó{' '}
            {query.data.kpis.preview_success_items} lượt chỉ xem trước;{' '}
            {query.data.kpis.queued_items} dòng chưa xử lý; {query.data.kpis.failed_jobs} tác vụ có
            lỗi. Preview không được coi là kết quả đã lưu.
          </p>
          <Actions
            key={`${revision}:${JSON.stringify(draft)}:${query.data.fingerprint}`}
            data={query.data}
            disabled={dirty}
          />
          {!dirty && (
            <InsightPanel
              key={`${revision}:${query.data.fingerprint}`}
              data={query.data}
              applied={applied}
              feature={selectedFeature}
              onEvidence={showEvidence}
            />
          )}
          {query.data.kpis.analysis_jobs === 0 ? (
            <div id="batch-evidence-results" tabIndex={-1}>
              <EmptyState
                title="Chưa có dữ liệu trong phạm vi này"
                description="Thử bộ lọc khác hoặc hoàn tất phân tích lô."
              />
            </div>
          ) : (
            <>
              <div className="batch-charts">
                <div id="batch-evidence-purchase_distribution" tabIndex={-1}>
                  <Distribution
                    title="Mức độ mua hàng"
                    rows={query.data.purchase_distribution.map((r) => ({
                      label: r.label,
                      count: r.count,
                      share: r.share_percent,
                    }))}
                  />
                </div>
                <div id="batch-evidence-segment_distribution" tabIndex={-1}>
                  <Distribution
                    title="Phân nhóm khách hàng"
                    rows={
                      scope
                        ? query.data.cluster_distribution.map((r) => ({
                            label: `Nhóm ${r.cluster}: ${r.segment_name}`,
                            count: r.count,
                            share: r.share_percent,
                            cluster: r.cluster,
                          }))
                        : []
                    }
                    scope={
                      scope
                        ? `${scope.task} · ${scope.model_version} · artifact ${scope.artifact_sha256.slice(0, 8)} · metadata ${scope.metadata_sha256.slice(0, 8)}`
                        : undefined
                    }
                    unavailable={!scope && query.data.cluster_distribution.length > 0}
                    selected={applied.cluster}
                    disabled={dirty}
                    onCluster={(cluster) => {
                      if (!scope || dirty || ![0, 1, 2].includes(cluster)) return;
                      go({
                        ...applied,
                        cluster: String(cluster),
                        segmentation_model: `${scope.model_version}|${scope.artifact_sha256}|${scope.metadata_sha256}`,
                      });
                    }}
                  />
                </div>
              </div>
              <div id="batch-evidence-comparison" tabIndex={-1}>
                <FeatureComparison
                  data={query.data}
                  applied={applied}
                  selectedFeature={selectedFeature}
                  onFeatureChange={setFeatureChoice}
                />
              </div>
              <section className="panel">
                <h2>Đặc điểm hành vi theo nhóm</h2>
                <p>
                  Giá trị trung bình từ dữ liệu gốc; cần ít nhất hai bản ghi. Đơn vị tiền tệ theo
                  nguồn.
                </p>
                {!scope && query.data.cluster_profiles.length ? (
                  <p>
                    Chưa xác minh được danh tính mô hình phân nhóm; không gộp đặc điểm các cluster.
                  </p>
                ) : !query.data.cluster_profiles.length ? (
                  <p>Chưa có kết quả phân nhóm đã lưu phù hợp.</p>
                ) : (
                  <div className="bulk-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Đặc trưng</th>
                          <th>Toàn phạm vi</th>
                          {query.data.cluster_profiles.map((p) => (
                            <th key={p.cluster}>
                              Nhóm {p.cluster} · {p.records} bản ghi kết quả
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(featureLabels).map(([feature, label]) => (
                          <tr key={feature}>
                            <td>{label}</td>
                            <td>{numeric(query.data.overall_means[feature])}</td>
                            {query.data.cluster_profiles.map((p) => (
                              <td key={p.cluster}>{numeric(p.means[feature])}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              <section className="panel">
                <h2>Tác vụ theo ngày Việt Nam</h2>
                {!query.data.trend_available ? (
                  <p>Chưa đủ ít nhất hai ngày có tác vụ để trình bày xu hướng.</p>
                ) : (
                  <div className="bulk-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Ngày</th>
                          <th>Số tác vụ</th>
                          <th>Có lỗi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {query.data.trend.map((day) => (
                          <tr key={day.day}>
                            <td>{day.day}</td>
                            <td>
                              <meter
                                min={0}
                                max={Math.max(1, ...query.data.trend.map((d) => d.analysis_jobs))}
                                value={day.analysis_jobs}
                              />{' '}
                              {day.analysis_jobs}
                            </td>
                            <td>{day.failed_jobs}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              <section className="panel" id="batch-evidence-results" tabIndex={-1}>
                <h2>Kết quả có thể truy vết</h2>
                <p>Mỗi dòng là một kết quả phân tích, không phải một khách hàng duy nhất.</p>
                <div className="bulk-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Khách hàng / snapshot</th>
                        <th>Bài toán / mô hình</th>
                        <th>Kết quả</th>
                        <th>Thời gian</th>
                        <th>Lưu trữ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {query.data.rows.map((row) => (
                        <tr key={row.item_id}>
                          <td>
                            {profileLink(row.customer_id, row.snapshot_id) ? (
                              <Link
                                to={`${profileLink(row.customer_id, row.snapshot_id)}${row.snapshot_id ? '&' : '?'}batch_filters=${encodeURIComponent(currentLocation.search)}`}
                                state={currentLocation.state}
                              >
                                {customerCode(row.external_id)}
                              </Link>
                            ) : (
                              <span>
                                {customerCode(row.external_id)} · liên kết dữ liệu không hợp lệ
                              </span>
                            )}
                            <details>
                              <summary>Liên kết dữ liệu</summary>
                              <p>Khách: {row.customer_id}</p>
                              <p>
                                Snapshot: {row.snapshot_id} · quan sát{' '}
                                {vietnamDateTime(row.captured_at)}
                              </p>
                              <p>Lô: {row.import_job_id}</p>
                              <p>Tác vụ: {row.analysis_job_id}</p>
                            </details>
                          </td>
                          <td>
                            {row.task === 'classification' ? 'Mức độ mua hàng' : 'Phân nhóm'}
                            <p>{row.model_version === '1.0.0' ? 'Bản ban đầu' : 'Bản nâng cao'}</p>
                            <details>
                              <summary>Phiên bản</summary>
                              {row.task} · {row.model_version} · {row.artifact_sha256} ·{' '}
                              {row.metadata_sha256}
                            </details>
                          </td>
                          <td>
                            {row.saved ? (
                              <>
                                {row.purchase_level ?? `Nhóm ${row.cluster}: ${row.segment_name}`}
                                {row.probabilities && (
                                  <p>
                                    {Object.entries(row.probabilities)
                                      .map(([k, v]) => `${k}: ${(v * 100).toFixed(2)}%`)
                                      .join(' · ')}
                                  </p>
                                )}
                                {row.distance_to_centroid !== null && (
                                  <p>
                                    Khoảng cách: {numeric(row.distance_to_centroid)} · không phải
                                    xác suất
                                  </p>
                                )}
                              </>
                            ) : (
                              <>
                                {row.item_status === 'success'
                                  ? 'Đã xử lý, đầu ra không lưu'
                                  : row.item_status === 'queued'
                                    ? 'Chưa xử lý'
                                    : row.item_status === 'skipped'
                                      ? 'Bỏ qua'
                                      : 'Lỗi'}{' '}
                                {row.error_code}
                              </>
                            )}
                          </td>
                          <td>
                            {vietnamDateTime(row.result_created_at)}
                            {!row.saved && (
                              <p>Thời gian tạo tác vụ, không phải thời điểm dự đoán đã lưu.</p>
                            )}
                          </td>
                          <td>
                            {row.saved ? 'Đã lưu' : 'Không có đầu ra lưu'}
                            <p>{row.reference_count} tham chiếu trong phạm vi</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="bulk-actions">
                  <button
                    className="button button-secondary"
                    disabled={offset === 0 || dirty}
                    onClick={() => go(applied, Math.max(0, offset - 50))}
                  >
                    Trang trước
                  </button>
                  <span>
                    {query.data.rows.length
                      ? `${offset + 1}–${offset + query.data.rows.length} / ${query.data.total_rows}`
                      : query.data.total_rows === 0
                        ? 'Không có dòng kết quả trong phạm vi lọc.'
                        : 'Trang này không còn dòng; hãy quay về trang đầu.'}
                  </span>
                  <button
                    className="button button-secondary"
                    disabled={offset + 50 >= query.data.total_rows || dirty}
                    onClick={() => go(applied, offset + 50)}
                  >
                    Trang sau
                  </button>
                  {offset > 0 && !query.data.rows.length && (
                    <button
                      className="button button-secondary"
                      disabled={dirty}
                      onClick={() => go(applied)}
                    >
                      Về trang đầu
                    </button>
                  )}
                </div>
                <p>50 kết quả/trang, mới nhất trước.</p>
              </section>
            </>
          )}
          <section className="panel">
            <h2>Nguồn dữ liệu và giới hạn</h2>
            <p>
              Nguồn khai báo khi nhập:{' '}
              {query.data.data_origins.length
                ? query.data.data_origins.join(', ')
                : 'Chưa có thông tin nguồn trong phạm vi này'}
              . Dữ liệu demo/nghiên cứu được nhập vẫn giữ tính chất demo/nghiên cứu, không trở thành
              bằng chứng vận hành thật.
            </p>
            <p>
              Phân tích dữ liệu hiện tại, không dự báo giao dịch tương lai. Nhóm không phải thứ
              hạng; khoảng cách không phải xác suất.
            </p>
            <details className="technical-details">
              <summary>Nguồn và mô hình</summary>
              {query.data.models.map((m) => (
                <div key={`${m.task}:${m.artifact_sha256}`}>
                  <p>
                    {m.task === 'classification' ? 'Mức mua' : 'Phân nhóm'} · {m.model_version}
                  </p>
                  <details>
                    <summary>Danh tính mô hình</summary>
                    {m.artifact_sha256} · {m.metadata_sha256}
                  </details>
                </div>
              ))}
              {query.data.warnings.map((w) => (
                <p key={w}>{productText(w)}</p>
              ))}
            </details>
          </section>
        </>
      )}
    </div>
  );
}

function numeric(value: number | null | undefined) {
  return value == null
    ? 'Chưa đủ dữ liệu'
    : value.toLocaleString('vi-VN', { maximumFractionDigits: 4 });
}
function Distribution({
  title,
  rows,
  scope,
  unavailable,
  selected,
  disabled,
  onCluster,
}: {
  title: string;
  rows: { label: string; count: number; share: number; cluster?: number }[];
  scope?: string;
  unavailable?: boolean;
  selected?: string;
  disabled?: boolean;
  onCluster?: (cluster: number) => void;
}) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {scope && (
        <details className="technical-details">
          <summary>Thông tin mô hình</summary>
          <p className="batch-model-scope">
            {scope}
            <br />
            Namespace riêng chưa được API cung cấp; cluster chỉ có ý nghĩa trong danh tính mô hình
            này.
          </p>
        </details>
      )}
      {unavailable && (
        <p role="status">
          Thiếu hoặc không tương thích danh tính mô hình phân nhóm; chưa thể mở chi tiết cluster an
          toàn.
        </p>
      )}
      {!rows.length ? (
        <p>Chưa có kết quả đã lưu phù hợp.</p>
      ) : (
        rows.map((r) => (
          <div className="batch-bar" key={r.label}>
            <div>
              <span>{r.label}</span>
              <strong>
                {r.count} · {r.share.toFixed(2)}%
              </strong>
            </div>
            <progress aria-label={r.label} value={r.share} max={100} />
            {onCluster && scope && r.cluster !== undefined && (
              <button
                className="button button-secondary"
                disabled={disabled}
                aria-pressed={selected === String(r.cluster)}
                onClick={() => onCluster(r.cluster!)}
              >
                Xem danh sách
              </button>
            )}
          </div>
        ))
      )}
      <small>Đơn vị: kết quả đã lưu.</small>
    </section>
  );
}

function Actions({ data, disabled }: { data: BatchView; disabled: boolean }) {
  const { session } = useWorkspace();
  const [busy, setBusy] = useState(''),
    [error, setError] = useState<unknown>(null),
    [narrative, setNarrative] = useState<BatchNarrative | null>(null),
    [done, setDone] = useState('');
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function run(kind: 'pdf' | 'xlsx' | 'ai') {
    if (active.current || disabled) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(kind);
    setError(null);
    setDone('');
    try {
      const target = { filters: data.filters, fingerprint: data.fingerprint };
      if (kind === 'ai') {
        setNarrative(null);
        const result = await session.client.batchAnalyticsNarrative(target, controller.signal);
        if (
          result.result_fingerprint !== data.fingerprint ||
          result.source !== 'verified_batch_aggregates'
        )
          throw new ApiError('protocol');
        if (!controller.signal.aborted) setNarrative(result);
      } else {
        const file = await session.client.requestReport(
          { ...target, source: 'batch_analytics', format: kind },
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          downloadBlob(file.blob, file.filename);
          setDone('Đã tải báo cáo theo bộ lọc đang áp dụng.');
        }
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e);
    } finally {
      if (!controller.signal.aborted) {
        active.current = null;
        setBusy('');
      }
    }
  }
  return (
    <section className="panel">
      <div className="bulk-actions">
        <button
          className="button button-secondary"
          disabled={disabled || !!busy}
          onClick={() => void run('pdf')}
        >
          <Download size={16} /> Xuất PDF
        </button>
        <button
          className="button button-secondary"
          disabled={disabled || !!busy}
          onClick={() => void run('xlsx')}
        >
          <Download size={16} /> Xuất Excel
        </button>
        <button
          className="button"
          disabled={disabled || !!busy || data.kpis.stored_results === 0}
          onClick={() => void run('ai')}
        >
          <Sparkles size={16} /> AI nhận xét tổng hợp
        </button>
      </div>
      <p>Xuất theo bộ lọc, tối đa 5.000 dòng; không kèm nhận xét AI.</p>
      {busy && (
        <LoadingState
          label={busy === 'ai' ? 'AI đang nhận xét số liệu đã xác minh…' : 'Đang tạo báo cáo…'}
        />
      )}{' '}
      {!!error && (
        <>
          {error instanceof ApiError && /^(GEMINI|ASSISTANT|NARRATIVE)_/.test(error.code) ? (
            <p role="alert">{assistantError(error)}</p>
          ) : (
            <ErrorState error={error} />
          )}
          <p>Dữ liệu có thể đã thay đổi. Hãy tải lại trước khi thử lại.</p>
        </>
      )}
      {done && <p role="status">{done}</p>}
      {narrative && (
        <div className="batch-narrative">
          <h3>Nhận xét được tạo bởi AI</h3>
          {Object.entries(titles).map(([key, title]) => (
            <section key={key}>
              <h4>{title}</h4>
              {(Array.isArray(narrative.narrative[key as keyof typeof titles])
                ? (narrative.narrative[key as keyof typeof titles] as string[])
                : [narrative.narrative[key as keyof typeof titles] as string]
              ).map((text, index) => (
                <SafeMarkdown key={index} text={productText(narrativeText(text))} />
              ))}
            </section>
          ))}
          <button
            className="button button-secondary"
            onClick={() =>
              void navigator.clipboard
                .writeText(
                  productText(narrativeText(Object.values(narrative.narrative).flat().join('\n'))),
                )
                .then(() => setDone('Đã sao chép nhận xét AI.'))
                .catch(() => setDone('Không sao chép được; bạn có thể chọn văn bản trực tiếp.'))
            }
          >
            Sao chép nhận xét
          </button>
        </div>
      )}
    </section>
  );
}
