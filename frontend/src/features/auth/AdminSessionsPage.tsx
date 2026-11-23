import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useWorkspace } from '../../app/context';
import { ApiError } from '../../api/errors';
import { ErrorState, LoadingState } from '../../components/states';
import { CustomerDialog } from '../customers/CustomerShared';
import { dateTime } from '../customers/customers';
import { PasswordField } from './AccountPages';
import { roleLabel } from './accounts';
import { personName } from './audit';
import { checkedSessions, type ActiveSession, type ActiveSessions } from './adminSessions';
import '../insights/insights.css';
import '../customers/customers.css';
import './accounts.css';
import './audit.css';

function RevokeDialog({
  target,
  onClose,
  onDone,
}: {
  target: ActiveSession;
  onClose: () => void;
  onDone: () => void;
}) {
  const { session, revision } = useWorkspace();
  const [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [validation, setValidation] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!password) {
      setValidation('Nhập mật khẩu của bạn để xác nhận.');
      return;
    }
    const secret = password;
    setPassword('');
    setValidation('');
    setBusy(true);
    setError(undefined);
    try {
      await session.client.revokeSession(target.id, secret);
      if (session.getSnapshot().revision === revision) onDone();
    } catch (failure) {
      if (session.getSnapshot().revision === revision) setError(failure);
    } finally {
      setBusy(false);
    }
  }
  const gone = error instanceof ApiError && error.status === 404;
  return (
    <CustomerDialog title="Thu hồi phiên đăng nhập" busy={busy} onClose={onClose}>
      <div className="account-modal">
        <form onSubmit={(event) => void submit(event)}>
          <p>
            Đăng xuất <strong>{personName(target.user)}</strong> khỏi phiên bắt đầu lúc{' '}
            {dateTime(target.created_at)}. Các phiên khác của người này vẫn giữ nguyên; người dùng
            có thể đăng nhập lại bình thường.
          </p>
          <PasswordField
            label="Mật khẩu quản trị của bạn"
            value={password}
            setValue={setPassword}
            disabled={busy}
          />
          {validation && <p role="alert">{validation}</p>}
          {gone ? (
            <p role="alert">Phiên này đã kết thúc hoặc đã bị thu hồi. Hãy tải lại danh sách.</p>
          ) : error ? (
            <ErrorState error={error} />
          ) : null}
          <div className="account-actions">
            <button type="button" className="button button-secondary" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="button" disabled={busy || gone}>
              {busy ? 'Đang thu hồi…' : 'Thu hồi phiên'}
            </button>
          </div>
        </form>
      </div>
    </CustomerDialog>
  );
}

export default function AdminSessionsPage() {
  const { session, revision, hasCapability } = useWorkspace();
  const allowed = hasCapability('users.manage');
  const [target, setTarget] = useState<ActiveSession | null>(null);
  const [notice, setNotice] = useState('');
  const query = useQuery({
    queryKey: ['admin-sessions', revision],
    enabled: allowed,
    retry: false,
    queryFn: async ({ signal }): Promise<ActiveSessions> =>
      checkedSessions(await session.client.adminSessions(signal)),
  });
  if (!allowed)
    return (
      <div className="permission-panel">
        <h1>Không có quyền truy cập</h1>
        <p>Chỉ quản trị viên được xem và thu hồi phiên đăng nhập.</p>
      </div>
    );
  const items = query.data?.items ?? [];
  const people = new Set(items.map((item) => item.user.id)).size;
  return (
    <section className="audit-page insights-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">QUẢN TRỊ</span>
          <h1>Phiên đăng nhập</h1>
          <p>
            Các phiên còn hiệu lực, hoạt động gần nhất trước. Thu hồi một phiên khi nghi tài khoản
            bị dùng trái phép hoặc người dùng quên đăng xuất ở máy khác. Giờ theo TP.HCM (UTC+7).
          </p>
        </div>
        <button
          className="button button-small button-secondary"
          disabled={query.isFetching}
          onClick={() => {
            setNotice('');
            void query.refetch();
          }}
        >
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>
      {notice && (
        <p role="status" className="insight-note">
          {notice}
        </p>
      )}
      {query.isPending ? (
        <LoadingState label="Đang tải phiên đăng nhập…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <section className="panel insight-section" aria-labelledby="sessions-title">
          <div className="panel-heading">
            <h2 id="sessions-title">
              {items.length} phiên của {people} người dùng
            </h2>
            <Link className="text-link" to="/admin/audit?category=auth">
              Xem nhật ký đăng nhập
            </Link>
          </div>
          {query.data.truncated && (
            <p className="insight-note">Chỉ hiển thị 200 phiên hoạt động gần nhất.</p>
          )}
          <div
            className="insight-table"
            role="region"
            aria-label="Danh sách phiên đăng nhập"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Vai trò</th>
                  <th>Đăng nhập lúc</th>
                  <th>Hoạt động gần nhất</th>
                  <th>Hết hạn lúc</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link
                        className="text-link"
                        to={`/admin/audit?user_id=${encodeURIComponent(item.user.id)}`}
                      >
                        {personName(item.user)}
                      </Link>
                      {item.current && <span className="subtle-tag">Phiên hiện tại của bạn</span>}
                    </td>
                    <td>{roleLabel(item.user.role)}</td>
                    <td>{dateTime(item.created_at)}</td>
                    <td>{dateTime(item.last_seen_at)}</td>
                    <td>{dateTime(item.expires_at)}</td>
                    <td>
                      {item.current ? (
                        <small>Dùng nút Đăng xuất</small>
                      ) : (
                        <button
                          type="button"
                          className="button button-small button-secondary"
                          aria-label={`Thu hồi phiên của ${personName(item.user)}`}
                          onClick={() => {
                            setNotice('');
                            setTarget(item);
                          }}
                        >
                          Thu hồi
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {target && (
        <RevokeDialog
          target={target}
          onClose={() => setTarget(null)}
          onDone={() => {
            setNotice(`Đã thu hồi phiên của ${personName(target.user)}.`);
            setTarget(null);
            void query.refetch();
          }}
        />
      )}
    </section>
  );
}
