import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { LifeBuoy, RefreshCw } from 'lucide-react';
import { useWorkspace } from '../../app/context';
import { ApiError } from '../../api/errors';
import { customerCode } from '../../components/customerIdentity';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { Pagination } from '../customers/CustomerShared';
import { ExportButtons } from '../reports/ExportButtons';
import { dateTime } from '../customers/customers';
import { Kpi } from '../insights/charts';
import { fixed, num, pct } from '../insights/insights';
import { RISK_ORDER, churnReport, riskColor, riskLabel, type RiskLevel } from './churn';
import {
  MAX_CUSTOMERS,
  counts,
  pooled,
  profileLink,
  scoreLatest,
  type WatchCustomer,
  type Watchlist,
} from './watchlist';
import '../insights/insights.css';
import '../explorer/explorer.css';
import './churn.css';

const PAGE = 20;
const { model, holdout } = churnReport;
const highBand = holdout.risk_bands as Record<string, { churn_rate_percent: number }>;
type Filter = RiskLevel | 'recorded' | 'no-snapshot';
const FILTER_LABEL: Record<Filter, string> = {
  high: 'Rủi ro Cao',
  medium: 'Rủi ro Trung bình',
  low: 'Rủi ro Thấp',
  recorded: 'Đã ghi nhận rời bỏ',
  'no-snapshot': 'Chưa có snapshot',
};

export default function ChurnWatchPage() {
  const { session, status, revision } = useWorkspace();
  const [filters, setFilters] = useState<Filter[]>(['high', 'medium']);
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ['churn-watchlist', revision],
    enabled: status === 'connected',
    retry: false,
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<Watchlist> => {
      const customers: WatchCustomer[] = [];
      let total: number;
      for (;;) {
        const page = (
          await session.client.request('get', '/api/v1/customers', {
            query: { offset: customers.length, limit: 100 },
            signal,
          })
        ).data;
        if (!Array.isArray(page.items) || page.offset !== customers.length)
          throw new ApiError('protocol');
        total = page.total;
        customers.push(...page.items.map((c) => ({ id: c.id, external_id: c.external_id })));
        if (!page.items.length || customers.length >= Math.min(total, MAX_CUSTOMERS)) break;
      }
      const scoped = customers.slice(0, MAX_CUSTOMERS);
      const latest = await pooled(scoped, async (customer) => {
        const page = (
          await session.client.request('get', '/api/v1/customers/{customer_id}/behaviors', {
            params: { customer_id: customer.id },
            query: { offset: 0, limit: 1 },
            signal,
          })
        ).data;
        return { customer, snapshot: page.items[0] ?? null };
      });
      const rows = await scoreLatest(latest, (items) => session.client.churnBatch(items, signal));
      return { rows, totalCustomers: total, truncated: total > MAX_CUSTOMERS };
    },
  });
  const rows = query.data?.rows;
  const tally = useMemo(() => (rows ? counts(rows) : null), [rows]);
  const visible = useMemo(
    () =>
      (rows ?? []).filter((row) =>
        filters.includes(row.kind === 'scored' ? row.prediction.risk_level : row.kind),
      ),
    [rows, filters],
  );
  const toggle = (value: Filter) => {
    setOffset(0);
    setFilters((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    );
  };
  // K12: the export lists the risk levels currently shown; with none selected it lists all three.
  const exportLevels = useMemo(() => {
    const chosen = (['high', 'medium', 'low'] as const).filter((level) => filters.includes(level));
    return chosen.length ? chosen : (['high', 'medium', 'low'] as RiskLevel[]);
  }, [filters]);
  const unavailable = query.error instanceof ApiError && query.error.status === 503;
  const scored = tally ? tally.low + tally.medium + tally.high : 0;
  return (
    <div className="insights-page churn-page churn-watch">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PHÂN TÍCH AI · RỜI BỎ</span>
          <h1>Khách hàng cần giữ chân</h1>
          <p>
            Dự báo nguy cơ rời bỏ từ snapshot mới nhất của từng khách hàng, xếp từ cao xuống thấp để
            ưu tiên chăm sóc. Kết quả tính lại mỗi lần mở trang và không được lưu.
          </p>
        </div>
        <button
          className="button button-small button-secondary"
          disabled={status !== 'connected' || query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCw size={14} /> Tính lại
        </button>
      </div>
      {status !== 'connected' ? (
        <EmptyState
          title="Kết nối để xem khách hàng cần giữ chân"
          description="Đăng nhập để dự báo nguy cơ rời bỏ cho khách hàng trong không gian làm việc."
          connection
        />
      ) : query.isPending ? (
        <LoadingState label="Đang lấy snapshot mới nhất và tính nguy cơ rời bỏ…" />
      ) : query.isError ? (
        unavailable ? (
          <EmptyState
            title="Mô hình rời bỏ chưa sẵn sàng"
            description="Máy chủ chưa nạp được mô hình rời bỏ. Các chức năng khác vẫn dùng bình thường."
          />
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        )
      ) : !rows?.length ? (
        <EmptyState
          title="Chưa có khách hàng"
          description="Thêm khách hàng và snapshot hành vi để dự báo nguy cơ rời bỏ."
        />
      ) : (
        <>
          <section className="insight-kpis" aria-label="Tổng hợp nguy cơ rời bỏ">
            <Kpi
              label="Khách được dự báo"
              value={num(scored, 0)}
              hint={`${num(rows.length, 0)} khách đang hoạt động`}
            />
            {RISK_ORDER.slice()
              .reverse()
              .map((level) => (
                <Kpi
                  key={level}
                  label={`Rủi ro ${riskLabel[level]}`}
                  value={num(tally![level], 0)}
                  hint={`${pct((100 * tally![level]) / Math.max(1, scored), 0)} số khách được dự báo`}
                />
              ))}
            <Kpi
              label="Đã ghi nhận rời bỏ"
              value={num(tally!.recorded, 0)}
              hint={`${num(tally!['no-snapshot'], 0)} khách chưa có snapshot`}
            />
          </section>
          {query.data.truncated && (
            <p role="status" className="insight-note">
              Không gian làm việc có {num(query.data.totalCustomers, 0)} khách; trang này dự báo{' '}
              {num(MAX_CUSTOMERS, 0)} khách đầu tiên theo ngày tạo mới nhất. Dùng Phân tích hàng
              loạt cho tập lớn hơn.
            </p>
          )}
          <section className="panel insight-section" aria-labelledby="churn-list">
            <div className="panel-heading">
              <h2 id="churn-list">
                <LifeBuoy size={16} /> Danh sách ưu tiên
              </h2>
              <span className="subtle-tag">{num(visible.length, 0)} khách theo bộ lọc</span>
            </div>
            <div className="x-chips" role="group" aria-label="Lọc theo mức rủi ro">
              <span className="x-chips-label">Hiện</span>
              {(['high', 'medium', 'low', 'recorded', 'no-snapshot'] as Filter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  className="x-chip"
                  aria-pressed={filters.includes(value)}
                  onClick={() => toggle(value)}
                >
                  {value in riskColor && (
                    <i style={{ background: riskColor[value as RiskLevel] }} />
                  )}
                  {FILTER_LABEL[value]} ({num(tally![value], 0)})
                </button>
              ))}
            </div>
            <ExportButtons target={{ source: 'churn_watchlist', risk_levels: exportLevels }} />
            {visible.length ? (
              <div
                className="insight-table"
                role="region"
                aria-label="Khách hàng theo nguy cơ rời bỏ"
                tabIndex={0}
              >
                <table>
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Khách hàng</th>
                      <th scope="col">Xác suất rời bỏ</th>
                      <th scope="col">Mức</th>
                      <th scope="col">Snapshot</th>
                      <th scope="col">Hồ sơ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.slice(offset, offset + PAGE).map((row, i) => (
                      <tr key={row.customer.id}>
                        <td>{offset + i + 1}</td>
                        <th scope="row" title={row.customer.external_id}>
                          {customerCode(row.customer.external_id)}
                        </th>
                        <td>
                          {row.kind === 'scored' ? (
                            <span className="churn-prob">
                              <span
                                className="churn-prob-bar"
                                aria-hidden="true"
                                style={{
                                  width: `${Math.max(2, 60 * row.prediction.churn_probability)}px`,
                                  background: riskColor[row.prediction.risk_level],
                                }}
                              />
                              {pct(100 * row.prediction.churn_probability, 1)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {row.kind === 'scored' ? (
                            <>
                              <span
                                className="churn-risk-dot"
                                style={{ background: riskColor[row.prediction.risk_level] }}
                              />
                              {riskLabel[row.prediction.risk_level]}
                              {row.missing > 0 && (
                                <small className="churn-direction">
                                  thiếu {row.missing} thuộc tính
                                </small>
                              )}
                            </>
                          ) : row.kind === 'recorded' ? (
                            'Đã rời bỏ (ghi nhận)'
                          ) : (
                            'Chưa có snapshot'
                          )}
                        </td>
                        <td>
                          {row.kind === 'no-snapshot' ? '—' : dateTime(row.snapshot.captured_at)}
                        </td>
                        <td>
                          <Link
                            className="text-link"
                            to={profileLink(
                              row.customer.id,
                              row.kind === 'no-snapshot' ? undefined : row.snapshot.id,
                            )}
                          >
                            Xem hồ sơ
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="Không có khách theo bộ lọc"
                description="Bật thêm mức rủi ro để xem các khách còn lại."
              />
            )}
            {visible.length > PAGE && (
              <Pagination
                offset={offset}
                limit={PAGE}
                total={visible.length}
                count={visible.slice(offset, offset + PAGE).length}
                onChange={setOffset}
              />
            )}
            <p className="insight-note">
              Mô hình XGBoost {model.input_features.length} thuộc tính (ROC-AUC{' '}
              {fixed(holdout.primary.roc_auc, 3)} trên tập kiểm tra). Mức Cao: xác suất từ{' '}
              {fixed(model.risk_thresholds.high_from, 2)}; trên tập kiểm tra{' '}
              {pct(highBand.high?.churn_rate_percent, 0)} khách ở mức này thật sự rời bỏ. Đây là dự
              báo trạng thái của snapshot, không phải thời điểm khách rời đi. Xem{' '}
              <Link to="/churn-report">Dự báo nguy cơ rời bỏ</Link>.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
