import { useEffect } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useWorkspace } from '../../app/context';
import { LoadingState } from '../../components/states';
import type { Capability } from './accounts';

export function AccountBootstrap() {
  const { session } = useWorkspace();
  useEffect(() => {
    if (session.accountMode) void session.restore().catch(() => {});
  }, [session]);
  return null;
}

export function AccountsGate() {
  const { session, status, authState, notice } = useWorkspace();
  const location = useLocation();
  if (!session.accountMode) return <Outlet />;
  if (status === 'connecting') {
    if (location.pathname === '/change-password' && authState === 'authenticating')
      return <Outlet />;
    return (
      <LoadingState
        label={authState === 'signing_out' ? 'Đang đăng xuất…' : 'Đang xác minh phiên…'}
      />
    );
  }
  if (authState === 'session_unknown')
    return (
      <section className="account-card">
        <h1>Chưa thể xác minh phiên</h1>
        <p>{notice}</p>
        <button
          className="button button-primary"
          onClick={() => {
            void session.restore().catch(() => {});
          }}
        >
          Kiểm tra lại phiên
        </button>
        <Link className="button button-secondary" to="/login">
          Về đăng nhập
        </Link>
      </section>
    );
  if (status !== 'connected')
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (authState === 'password_change_required' && location.pathname !== '/change-password')
    return <Navigate to="/change-password" replace />;
  const required: [RegExp, Capability][] = [
    [/^\/admin\//, 'users.manage'],
    [/^\/dashboard/, 'dashboard.read'],
    [/^\/customers/, 'customers.read'],
    [/^\/predictions|^\/segmentation/, 'inference.json.run'],
    [/^\/what-if/, 'what_if.preview_compare'],
    [/^\/history/, 'history.read'],
    [/^\/system/, 'models.read'],
  ];
  const capability = required.find(([pattern]) => pattern.test(location.pathname))?.[1];
  if (capability && !session.getSnapshot().capabilities?.includes(capability))
    return (
      <section className="permission-panel">
        <h1>Không có quyền truy cập</h1>
        <p>Tài khoản hiện tại không được sử dụng chức năng này.</p>
        <Link className="button button-secondary" to="/account">
          Về tài khoản
        </Link>
      </section>
    );
  return <Outlet />;
}
