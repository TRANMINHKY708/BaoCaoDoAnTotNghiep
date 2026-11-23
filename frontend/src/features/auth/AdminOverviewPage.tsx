import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useWorkspace } from '../../app/context';
import { ErrorState, LoadingState } from '../../components/states';
import { dateTime } from '../customers/customers';
import { Kpi } from '../insights/charts';
import { roleLabel } from './accounts';
import { eventLabel, outcomeLabel, personName, type AuditPerson } from './audit';
import {
  checkedOverview,
  reasonLabel,
  type AdminOverview,
  type OverviewEvent,
} from './adminOverview';
import '../insights/insights.css';
import '../customers/customers.css';
import './audit.css';

const auditLink = (person: AuditPerson) => `/admin/audit?user_id=${encodeURIComponent(person.id)}`;

function EventTable({
  label,
  rows,
  empty,
}: {
  label: string;
  rows: OverviewEvent[];
  empty: string;
}) {
  if (!rows.length) return <p className="insight-note">{empty}</p>;
  return (
    <div className="insight-table" role="region" aria-label={label} tabIndex={0}>
      <table>
        <thead>
          <tr>
            <th>Thời gian (TP.HCM)</th>
            <th>Hành động</th>
            <th>Người thực hiện</th>
            <th>Đối tượng</th>
            <th>Kết quả</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{dateTime(row.occurred_at)}</td>
              <td>{eventLabel[row.event_code] ?? row.event_code}</td>
              <td>
                {row.actor ? (
                  <Link className="text-link" to={auditLink(row.actor)}>
                    {personName(row.actor)}
                  </Link>
                ) : (
                  '—'
                )}
              </td>
              <td>
                {row.subject ? (
                  <Link className="text-link" to={auditLink(row.subject)}>
                    {personName(row.subject)}
                  </Link>
                ) : (
                  '—'
                )}
              </td>
              <td>
                <span className={`audit-outcome ${row.outcome}`}>{outcomeLabel[row.outcome]}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminOverviewPage() {
  const { session, revision, hasCapability } = useWorkspace();
  const allowed = hasCapability('users.manage');
  const query = useQuery({
    queryKey: ['admin-overview', revision],
    enabled: allowed,
    retry: false,
    queryFn: async ({ signal }): Promise<AdminOverview> =>
      checkedOverview(await session.client.adminOverview(signal)),
  });
  if (!allowed)
    return (
      <div className="permission-panel">
        <h1>Không có quyền truy cập</h1>
        <p>Chỉ quản trị viên được xem trang tổng quan quản trị.</p>
      </div>
    );
  const data = query.data;
  return (
    <section className="audit-page insights-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">QUẢN TRỊ</span>
          <h1>Tổng quan quản trị</h1>
          <p>
            Tình trạng tài khoản, phiên đăng nhập và các sự kiện an toàn trong 24 giờ qua. Chỉ đọc;
            giờ hiển thị theo TP.HCM (UTC+7).
          </p>
        </div>
        <button
          className="button button-small button-secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>
      {query.isPending ? (
        <LoadingState label="Đang tổng hợp tình trạng hệ thống…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        data && (
          <>
            <section className="insight-kpis" aria-label="Tài khoản và phiên đăng nhập">
              <Kpi
                label="Tài khoản đang hoạt động"
                value={data.users.active}
                hint={`${data.users.by_role.ADMIN} ${roleLabel('ADMIN')} · ${data.users.by_role.OPERATOR} ${roleLabel('OPERATOR')} · ${data.users.by_role.VIEWER} ${roleLabel('VIEWER')}`}
              />
              <Kpi
                label="Đang đăng nhập"
                value={data.sessions.users_online}
                hint={`${data.sessions.active} phiên còn hiệu lực`}
              />
              <Kpi
                label="Cần chú ý"
                value={data.users.locked + data.users.must_change_password}
                hint={`${data.users.locked} bị khóa tạm · ${data.users.must_change_password} chưa đổi mật khẩu`}
              />
              <Kpi
                label="Đã ngưng hoạt động"
                value={data.users.inactive}
                hint={`${data.users.never_logged_in} tài khoản chưa từng đăng nhập`}
              />
            </section>
            <section className="insight-kpis" aria-label={`Hoạt động ${data.window_hours} giờ qua`}>
              <Kpi
                label="Đăng nhập thành công"
                value={data.last_24h.logins_succeeded}
                hint={`${data.window_hours} giờ qua`}
              />
              <Kpi
                label="Đăng nhập thất bại"
                value={data.last_24h.logins_failed}
                hint="Sai mật khẩu hoặc tài khoản bị khóa"
              />
              <Kpi
                label="Thay đổi tài khoản"
                value={data.last_24h.user_changes}
                hint="Tạo, khóa, đổi vai trò, cập nhật"
              />
              <Kpi
                label="Thao tác bị từ chối"
                value={data.last_24h.denied}
                hint={`${data.last_24h.business_writes} thao tác ghi dữ liệu nghiệp vụ`}
              />
            </section>
            <section className="panel insight-section" aria-labelledby="admin-attention">
              <div className="panel-heading">
                <h2 id="admin-attention">Tài khoản cần chú ý</h2>
                <Link className="text-link" to="/admin/users">
                  Mở Quản lý người dùng
                </Link>
              </div>
              {data.attention.length ? (
                <div
                  className="insight-table"
                  role="region"
                  aria-label="Danh sách tài khoản cần chú ý"
                  tabIndex={0}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Tài khoản</th>
                        <th>Vai trò</th>
                        <th>Lý do</th>
                        <th>Khóa đến (TP.HCM)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.attention.map((item) => (
                        <tr key={item.user.id}>
                          <td>
                            <Link className="text-link" to={auditLink(item.user)}>
                              {personName(item.user)}
                            </Link>
                          </td>
                          <td>{roleLabel(item.user.role)}</td>
                          <td>{item.reasons.map((r) => reasonLabel[r]).join(', ')}</td>
                          <td>{item.locked_until ? dateTime(item.locked_until) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="insight-note">
                  Không có tài khoản nào bị khóa hoặc đang chờ đổi mật khẩu.
                </p>
              )}
            </section>
            <section className="panel insight-section" aria-labelledby="admin-failed">
              <div className="panel-heading">
                <h2 id="admin-failed">Đăng nhập thất bại gần đây</h2>
                <Link className="text-link" to="/admin/audit?category=auth&outcome=denied">
                  Xem trong nhật ký
                </Link>
              </div>
              <EventTable
                label="Danh sách đăng nhập thất bại"
                rows={data.recent_failed_logins}
                empty="Chưa có lần đăng nhập thất bại nào."
              />
            </section>
            <section className="panel insight-section" aria-labelledby="admin-actions">
              <div className="panel-heading">
                <h2 id="admin-actions">Thao tác quản trị gần đây</h2>
                <Link className="text-link" to="/admin/audit?category=users">
                  Xem trong nhật ký
                </Link>
              </div>
              <EventTable
                label="Danh sách thao tác quản trị"
                rows={data.recent_admin_actions}
                empty="Chưa có thao tác quản trị nào."
              />
            </section>
            <p className="insight-note">Cập nhật lúc {dateTime(data.generated_at)}.</p>
          </>
        )
      )}
    </section>
  );
}
