import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../../app/context';
import { ErrorState, LoadingState } from '../../components/states';
import { ApiError } from '../../api/errors';
import type { AccountUser } from './accounts';
import {
  PASSWORD_MIN,
  passwordFailure,
  passwordIssue,
  passwordLength,
  roleLabel,
} from './accounts';
import { PasswordField, PasswordRules } from './AccountPages';
import { CustomerDialog } from '../customers/CustomerShared';
import '../customers/customers.css';

type Action = 'create' | 'edit' | 'toggle' | 'reset' | 'revoke';
const statusLabel = (value: string) =>
  value === 'DISABLED'
    ? 'Ngưng hoạt động'
    : value === 'TEMPORARILY_LOCKED'
      ? 'Tạm khóa đăng nhập'
      : 'Đang hoạt động';

export default function AdminUsersPage() {
  const { session, revision, hasCapability } = useWorkspace();
  const [q, setQ] = useState(''),
    [search, setSearch] = useState('');
  const [role, setRole] = useState<'' | AccountUser['role']>('');
  const [filter, setFilter] = useState<'' | AccountUser['status']>('');
  const [sort, setSort] = useState<'created_at' | 'username'>('created_at'),
    [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [offset, setOffset] = useState(0),
    [selected, setSelected] = useState<string>();
  const [action, setAction] = useState<Action>(),
    [success, setSuccess] = useState('');
  const cache = useQueryClient();
  const list = useQuery({
    queryKey: ['admin-users', revision, search, role, filter, sort, direction, offset],
    enabled: hasCapability('users.manage'),
    queryFn: async ({ signal }) =>
      (
        await session.client.request('get', '/api/v1/admin/users', {
          signal,
          query: {
            q: search || undefined,
            role: role || undefined,
            status: filter || undefined,
            sort,
            direction,
            limit: 20,
            offset,
          },
        })
      ).data,
  });
  const detail = useQuery({
    queryKey: ['admin-user', revision, selected],
    enabled: !!selected && hasCapability('users.manage'),
    queryFn: ({ signal }) =>
      session.client.request('get', '/api/v1/admin/users/{user_id}', {
        params: { user_id: selected! },
        signal,
      }),
  });
  const chosen = detail.data?.data;
  const etag = detail.data?.meta.etag;
  if (!hasCapability('users.manage'))
    return (
      <div className="permission-panel">
        <h1>Không có quyền truy cập</h1>
        <p>Chỉ quản trị viên được quản lý tài khoản.</p>
      </div>
    );
  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">QUẢN TRỊ</span>
          <h1>Quản lý người dùng</h1>
        </div>
        <button
          type="button"
          className="button button-primary"
          onClick={() => {
            setSuccess('');
            setAction('create');
          }}
        >
          Tạo tài khoản
        </button>
      </div>
      {success && (
        <div role="status" className="account-toast">
          {success}
        </div>
      )}
      <form
        className="account-filter"
        onSubmit={(e) => {
          e.preventDefault();
          setOffset(0);
          setSearch(q.trim());
        }}
      >
        <label className="account-field">
          Tìm tài khoản
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={100}
            placeholder="Tên đăng nhập hoặc tên hiển thị"
          />
        </label>
        <label className="account-field">
          Vai trò
          <select
            aria-label="Vai trò"
            value={role}
            onChange={(e) => {
              setRole(e.target.value as typeof role);
              setOffset(0);
            }}
          >
            <option value="">Tất cả</option>
            {(['ADMIN', 'OPERATOR', 'VIEWER'] as const).map((value) => (
              <option key={value} value={value}>
                {roleLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="account-field">
          Trạng thái
          <select
            aria-label="Trạng thái"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as typeof filter);
              setOffset(0);
            }}
          >
            <option value="">Tất cả</option>
            {(['ACTIVE', 'DISABLED', 'TEMPORARILY_LOCKED'] as const).map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="account-field">
          Sắp xếp
          <select
            aria-label="Sắp xếp"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as typeof sort);
              setOffset(0);
            }}
          >
            <option value="created_at">Ngày tạo</option>
            <option value="username">Tên đăng nhập</option>
          </select>
        </label>
        <label className="account-field">
          Thứ tự
          <select
            aria-label="Thứ tự"
            value={direction}
            onChange={(e) => {
              setDirection(e.target.value as typeof direction);
              setOffset(0);
            }}
          >
            <option value="desc">Giảm dần</option>
            <option value="asc">Tăng dần</option>
          </select>
        </label>
        <button type="submit" className="button button-secondary">
          Tìm kiếm
        </button>
      </form>
      {list.isPending ? (
        <LoadingState label="Đang tải tài khoản…" />
      ) : list.isError ? (
        <ErrorState
          error={list.error}
          onRetry={() => {
            void list.refetch();
          }}
        />
      ) : (
        <>
          {!list.data.items.length ? (
            <div className="state-panel">
              <h2>Chưa có tài khoản phù hợp</h2>
              <p>Thử thay đổi bộ lọc hoặc tạo tài khoản mới.</p>
            </div>
          ) : (
            <div
              className="account-table-wrap"
              role="region"
              aria-label="Danh sách tài khoản"
              tabIndex={0}
            >
              <table className="account-table">
                <thead>
                  <tr>
                    <th>Tài khoản</th>
                    <th>Tên hiển thị</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((user) => (
                    <tr key={user.id}>
                      <td>{user.username}</td>
                      <td>{user.display_name}</td>
                      <td>{roleLabel(user.role)}</td>
                      <td>
                        <span className="account-status">{statusLabel(user.status)}</span>
                        {user.must_change_password && <small> · Cần đổi mật khẩu</small>}
                      </td>
                      <td>
                        <button
                          className="button button-secondary"
                          onClick={() => {
                            setSelected(user.id);
                            setSuccess('');
                          }}
                        >
                          Xem tài khoản
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="account-pagination">
            <span>{list.data.total} tài khoản phù hợp</span>
            <button
              className="button button-secondary"
              disabled={!offset || list.isFetching}
              onClick={() => setOffset(Math.max(0, offset - 20))}
            >
              Trang trước
            </button>
            <span>Trang {offset / 20 + 1}</span>
            <button
              className="button button-secondary"
              disabled={offset + 20 >= list.data.total || list.isFetching}
              onClick={() => setOffset(offset + 20)}
            >
              Trang sau
            </button>
          </div>
        </>
      )}
      {selected && (
        <section className="account-card">
          <h2>Thông tin tài khoản</h2>
          {detail.isPending ? (
            <LoadingState />
          ) : detail.isError ? (
            <ErrorState
              error={detail.error}
              onRetry={() => {
                void detail.refetch();
              }}
            />
          ) : (
            chosen && (
              <>
                <dl className="account-facts">
                  <dt>Tên đăng nhập</dt>
                  <dd>{chosen.username}</dd>
                  <dt>Tên hiển thị</dt>
                  <dd>{chosen.display_name}</dd>
                  <dt>Vai trò</dt>
                  <dd>{roleLabel(chosen.role)}</dd>
                  <dt>Trạng thái</dt>
                  <dd>{statusLabel(chosen.status)}</dd>
                </dl>
                <div className="account-actions">
                  {(['edit', 'toggle', 'reset', 'revoke'] as const).map((value) => (
                    <button
                      key={value}
                      className="button button-secondary"
                      disabled={
                        !etag ||
                        (chosen.id === session.getSnapshot().user?.id &&
                          (value === 'reset' || value === 'toggle'))
                      }
                      onClick={() => setAction(value)}
                    >
                      {
                        {
                          edit: 'Chỉnh sửa',
                          toggle:
                            chosen.is_active && chosen.status !== 'TEMPORARILY_LOCKED'
                              ? 'Khóa tài khoản'
                              : 'Mở khóa tài khoản',
                          reset: 'Đặt lại mật khẩu',
                          revoke: 'Thu hồi mọi phiên',
                        }[value]
                      }
                    </button>
                  ))}
                </div>
                <Link className="text-link" to={`/admin/audit?user_id=${chosen.id}`}>
                  Xem nhật ký của người này
                </Link>
                <p className="muted">
                  Hệ thống bảo vệ tài khoản quản trị cuối cùng. Thay đổi quyền hoặc khóa tài khoản
                  sẽ thu hồi các phiên liên quan.
                </p>
              </>
            )
          )}
        </section>
      )}
      {action && (action === 'create' || (chosen && etag)) && (
        <AdminMutation
          key={`${action}:${chosen?.id ?? ''}`}
          action={action}
          user={action === 'create' ? undefined : chosen}
          etag={etag ?? undefined}
          onClose={() => setAction(undefined)}
          onReload={async () => {
            await detail.refetch();
          }}
          onDone={() => {
            setAction(undefined);
            setSuccess('Thao tác đã hoàn tất. Trạng thái tài khoản được cập nhật từ máy chủ.');
            void cache.invalidateQueries({ queryKey: ['admin-users'] });
            void cache.invalidateQueries({ queryKey: ['admin-user'] });
            session.notifyRoleChange();
          }}
        />
      )}
    </section>
  );
}

function AdminMutation({
  action,
  user,
  etag,
  onClose,
  onDone,
  onReload,
}: {
  action: Action;
  user?: AccountUser;
  etag?: string;
  onClose: () => void;
  onDone: () => void;
  onReload: () => Promise<void>;
}) {
  const { session, revision } = useWorkspace();
  const [username, setUsername] = useState(''),
    [display, setDisplay] = useState(user?.display_name ?? '');
  const [role, setRole] = useState<AccountUser['role']>(user?.role ?? 'VIEWER');
  const [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [adminPassword, setAdminPassword] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [validation, setValidation] = useState('');
  const stale = error instanceof ApiError && [412, 428].includes(error.status);
  const uncertain =
    error instanceof ApiError &&
    (['network', 'timeout', 'cancelled', 'protocol'].includes(error.kind) || error.status >= 500);
  const self = action !== 'create' && user?.id === session.getSnapshot().user?.id;
  const title = {
    create: 'Tạo tài khoản mới',
    edit: 'Chỉnh sửa tài khoản',
    toggle:
      user?.is_active && user.status !== 'TEMPORARILY_LOCKED'
        ? 'Xác nhận khóa tài khoản'
        : 'Xác nhận mở khóa',
    reset: 'Đặt lại mật khẩu',
    revoke: 'Thu hồi toàn bộ phiên đăng nhập',
  }[action];
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || stale || uncertain) return;
    let issue = !adminPassword
      ? 'Nhập mật khẩu của bạn để xác nhận.'
      : passwordLength(adminPassword) < PASSWORD_MIN
        ? `Mật khẩu quản trị của bạn chưa đúng (mật khẩu có ít nhất ${PASSWORD_MIN} ký tự).`
        : '';
    if (action === 'create' && !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username))
      issue = 'Tên đăng nhập cần 3–64 ký tự thường, chữ số, dấu chấm, gạch ngang hoặc gạch dưới.';
    if ((action === 'create' || action === 'edit') && !display.trim()) issue = 'Nhập tên hiển thị.';
    if (action === 'create' || action === 'reset')
      issue =
        issue ||
        passwordIssue(password) ||
        (password.normalize('NFC') !== confirm.normalize('NFC')
          ? 'Mật khẩu xác nhận chưa khớp.'
          : '');
    setValidation(issue);
    if (issue) return;
    const secret = adminPassword,
      initial = password;
    setAdminPassword('');
    setPassword('');
    setConfirm('');
    setBusy(true);
    setError(undefined);
    try {
      if (action === 'create')
        await session.client.request('post', '/api/v1/admin/users', {
          body: {
            username,
            display_name: display,
            role,
            initial_password: initial,
            admin_password: secret,
          },
        });
      else {
        if (!user || !etag) throw new ApiError('http', 428);
        const common = { params: { user_id: user.id }, headers: { 'If-Match': etag } };
        if (action === 'edit')
          await session.client.request('patch', '/api/v1/admin/users/{user_id}', {
            ...common,
            body: { admin_password: secret, display_name: display, ...(self ? {} : { role }) },
          });
        if (action === 'toggle')
          await session.client.request('patch', '/api/v1/admin/users/{user_id}', {
            ...common,
            body: {
              admin_password: secret,
              is_active: !user.is_active || user.status === 'TEMPORARILY_LOCKED',
            },
          });
        if (action === 'reset')
          await session.client.request('post', '/api/v1/admin/users/{user_id}/reset-password', {
            ...common,
            body: { admin_password: secret, initial_password: initial },
          });
        if (action === 'revoke')
          await session.client.request('post', '/api/v1/admin/users/{user_id}/revoke-sessions', {
            ...common,
            body: { admin_password: secret },
          });
      }
      if (session.getSnapshot().revision !== revision) return;
      if (self && action === 'revoke') {
        await session.restore().catch(() => {});
        return;
      }
      onDone();
      if (self) await session.restore().catch(() => {});
    } catch (failure) {
      if (session.getSnapshot().revision === revision) setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <CustomerDialog title={title} busy={busy} onClose={onClose}>
      <div className="account-modal">
        <form
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          {user && (
            <p>
              Tài khoản: <strong>{user.username}</strong>
            </p>
          )}
          {action === 'create' && (
            <label className="account-field">
              Tên đăng nhập mới
              <input
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                maxLength={64}
              />
            </label>
          )}
          {(action === 'create' || action === 'edit') && (
            <>
              <label className="account-field">
                Tên hiển thị
                <input
                  value={display}
                  onChange={(e) => setDisplay(e.target.value)}
                  required
                  maxLength={100}
                />
              </label>
              <label className="account-field">
                Vai trò
                <select
                  aria-label="Vai trò"
                  value={role}
                  disabled={self}
                  onChange={(e) => setRole(e.target.value as AccountUser['role'])}
                >
                  {(['ADMIN', 'OPERATOR', 'VIEWER'] as const).map((value) => (
                    <option key={value} value={value}>
                      {roleLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {(action === 'create' || action === 'reset') && (
            <>
              <PasswordField
                label="Mật khẩu ban đầu"
                autoComplete="new-password"
                value={password}
                setValue={setPassword}
                disabled={busy}
              />
              <PasswordField
                label="Xác nhận mật khẩu ban đầu"
                autoComplete="new-password"
                value={confirm}
                setValue={setConfirm}
                disabled={busy}
              />
              <PasswordRules value={password} confirm={confirm} />
              <p>
                Người dùng phải đổi mật khẩu trong lần đăng nhập tiếp theo. Reset không tự kích hoạt
                tài khoản đang khóa.
              </p>
            </>
          )}
          {(action === 'toggle' || action === 'revoke') && (
            <p>
              Thao tác này có thể thu hồi các phiên đăng nhập của tài khoản. Dữ liệu nghiệp vụ và
              lịch sử được giữ nguyên.
            </p>
          )}
          <PasswordField
            label="Mật khẩu quản trị của bạn"
            value={adminPassword}
            setValue={setAdminPassword}
            disabled={busy}
          />
          {validation && <p role="alert">{validation}</p>}
          {passwordFailure(error, 'admin') ? (
            <p role="alert">{passwordFailure(error, 'admin')}</p>
          ) : error ? (
            <ErrorState error={error} />
          ) : null}
          {stale && (
            <p role="alert">
              Tài khoản đã thay đổi từ nơi khác. Bản nháp không được gửi lại.{' '}
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  void onReload().then(onClose);
                }}
              >
                Tải lại dữ liệu
              </button>
            </p>
          )}
          {uncertain && (
            <p role="alert">
              Chưa xác nhận kết quả. Không gửi lại tự động; đóng hộp thoại và kiểm tra danh sách
              hoặc chi tiết tài khoản.
            </p>
          )}
          <div className="account-actions">
            <button
              type="button"
              className="button button-secondary"
              disabled={busy}
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={busy || stale || uncertain}
            >
              {busy ? 'Đang xử lý…' : 'Xác nhận'}
            </button>
          </div>
        </form>
      </div>
    </CustomerDialog>
  );
}
