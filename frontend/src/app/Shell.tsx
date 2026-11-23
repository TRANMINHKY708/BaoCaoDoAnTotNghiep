import { roleLabel as accountRoleLabel } from '../features/auth/accounts';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Boxes,
  ChevronRight,
  CircleHelp,
  Cpu,
  Menu,
  Moon,
  PlugZap,
  Search,
  Sun,
  X,
} from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { modules, researchModules } from '../routes/modules';
import { useWorkspace } from './context';
import { useTheme } from './theme';
import { AssistantDock } from '../features/assistant/AssistantDock';

export function Shell() {
  const { status, mode, role, user, authState, hasCapability } = useWorkspace();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigation =
    // Operational modules: the first eight entries (K6 added /churn after What-if).
    mode === 'accounts' && authState !== 'authenticated' ? [] : modules.slice(0, 8);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const closeButton = useRef<HTMLButtonElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  // Whole path segments only: /churn must not match /churn-report.
  const current = modules.find(
    (item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`),
  );
  useEffect(() => {
    if (open) closeButton.current?.focus();
    // Restore focus only after React removes inert from the main column.
    else if (wasOpen.current) menuButton.current?.focus();
    wasOpen.current = open;
    const previousOverflow = document.body.style.overflow;
    if (open) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);
  const close = () => {
    setOpen(false);
  };
  useEffect(() => {
    if (!open) return;
    // CSS visibility may not yet be applied when the opening effect runs.
    const frame = requestAnimationFrame(() => closeButton.current?.focus());
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key === 'Tab') {
        const sidebar = closeButton.current?.closest('aside');
        const controls = Array.from(
          sidebar?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') ?? [],
        );
        const first = controls[0],
          last = controls.at(-1);
        if (
          !sidebar?.contains(document.activeElement) ||
          (event.shiftKey && document.activeElement === first)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', keyboard);
    };
  }, [open]);
  const roleLabel =
    status !== 'connected'
      ? 'Chưa kết nối'
      : mode === 'accounts'
        ? accountRoleLabel(user?.role)
        : mode === 'local'
          ? 'Trên máy · không xác thực'
          : role === 'operator'
            ? 'Quyền vận hành'
            : 'Quyền xem';
  const matches = search.trim()
    ? modules.filter((item) =>
        item.label.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')),
      )
    : [];
  return (
    <AssistantDock>
      <div className="app-shell">
        <a href="#main-content" className="skip-link">
          Đến nội dung chính
        </a>
        {open && (
          <button className="nav-backdrop" aria-label="Đóng menu điều hướng" onClick={close} />
        )}
        <aside
          className={`sidebar ${open ? 'sidebar-open' : ''}`}
          aria-label="Điều hướng workspace"
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
          }}
        >
          <div className="brand-row">
            <Link className="brand" to="/dashboard" onClick={() => setOpen(false)}>
              <span className="brand-mark">
                <Cpu size={23} />
              </span>
              <span>
                MK <span className="brand-ai">eAI</span>
              </span>
            </Link>
            <button
              className="icon-button mobile-only"
              ref={closeButton}
              aria-label="Đóng menu"
              onClick={close}
            >
              <X size={20} />
            </button>
          </div>
          <p className="nav-label">KHÔNG GIAN PHÂN TÍCH</p>
          <nav>
            {navigation.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}
                onClick={() => setOpen(false)}
              >
                <item.icon size={19} />
                <span>{item.label}</span>
              </NavLink>
            ))}
            {navigation.length > 0 && (
              <>
                <p className="nav-label nav-label-group">NGHIÊN CỨU</p>
                {researchModules.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}
                    onClick={() => setOpen(false)}
                  >
                    <item.icon size={19} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </>
            )}
          </nav>
          {mode === 'accounts' && authState === 'authenticated' && (
            <nav aria-label="Tài khoản">
              <NavLink className="nav-item" to="/account" onClick={() => setOpen(false)}>
                Tài khoản của tôi
              </NavLink>
              {hasCapability('users.manage') && (
                <>
                  <NavLink className="nav-item" to="/admin/overview" onClick={() => setOpen(false)}>
                    Tổng quan quản trị
                  </NavLink>
                  <NavLink className="nav-item" to="/admin/users" onClick={() => setOpen(false)}>
                    Quản lý người dùng
                  </NavLink>
                  <NavLink className="nav-item" to="/admin/sessions" onClick={() => setOpen(false)}>
                    Phiên đăng nhập
                  </NavLink>
                  <NavLink className="nav-item" to="/admin/audit" onClick={() => setOpen(false)}>
                    Nhật ký hoạt động
                  </NavLink>
                </>
              )}
            </nav>
          )}
          <div className="sidebar-bottom">
            <NavLink className="nav-item" to="/models" onClick={() => setOpen(false)}>
              <Boxes size={18} />
              Quản lý mô hình
            </NavLink>
            <NavLink className="nav-item" to="/system" onClick={() => setOpen(false)}>
              <CircleHelp size={18} />
              Hệ thống & mô hình
            </NavLink>
            <Link
              className="connection-indicator"
              to={mode === 'accounts' ? '/account' : '/connect'}
              onClick={() => setOpen(false)}
            >
              <span className={`status-dot ${status === 'connected' ? 'online' : ''}`} />
              <span>
                {roleLabel}
                <small>Không gian làm việc chung</small>
              </span>
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </aside>
        <div className="main-column" inert={open}>
          <header className="topbar">
            <div className="breadcrumbs">
              <button
                className="icon-button mobile-menu"
                ref={menuButton}
                onClick={() => setOpen(true)}
                aria-label="Mở menu"
                aria-expanded={open}
              >
                <Menu size={21} />
              </button>
              <span>Không gian làm việc</span>
              <ChevronRight size={14} />
              <strong>
                {current?.label ||
                  (location.pathname === '/connect'
                    ? 'Kết nối'
                    : location.pathname === '/login'
                      ? 'Đăng nhập'
                      : location.pathname === '/account'
                        ? 'Tài khoản'
                        : location.pathname === '/change-password'
                          ? 'Đổi mật khẩu'
                          : location.pathname === '/admin/overview'
                            ? 'Tổng quan quản trị'
                            : location.pathname === '/admin/users'
                              ? 'Quản lý người dùng'
                              : location.pathname === '/admin/sessions'
                                ? 'Phiên đăng nhập'
                                : location.pathname === '/admin/audit'
                                  ? 'Nhật ký hoạt động'
                                  : 'Trang không tồn tại')}
              </strong>
            </div>
            <div className="topbar-actions">
              <div className="module-search">
                <Search size={16} />
                <input
                  aria-label="Tìm chức năng"
                  placeholder="Tìm chức năng…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setSearch('');
                    if (event.key === 'Enter' && matches[0]) {
                      void navigate(matches[0].path);
                      setSearch('');
                    }
                  }}
                />
                {search && (
                  <div className="search-results">
                    {matches.length ? (
                      matches.map((item) => (
                        <Link key={item.path} to={item.path} onClick={() => setSearch('')}>
                          {item.label}
                          <ChevronRight size={13} />
                        </Link>
                      ))
                    ) : (
                      <p>Không tìm thấy chức năng</p>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="icon-button theme-toggle"
                onClick={toggleTheme}
                aria-pressed={theme === 'dark'}
                aria-label={
                  theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'
                }
                title={theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
              >
                {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <Link className="header-connect" to={mode === 'accounts' ? '/account' : '/connect'}>
                <PlugZap size={16} />
                <span>
                  {mode === 'accounts'
                    ? status === 'connected'
                      ? 'Tài khoản'
                      : 'Đăng nhập'
                    : status === 'connected'
                      ? 'Đã kết nối'
                      : 'Kết nối hệ thống'}
                </span>
              </Link>
            </div>
          </header>
          <main id="main-content" className="page-content" tabIndex={-1}>
            <Outlet />
          </main>
          <footer className="app-footer">
            <span>
              MK eAI <span className="footer-dot">·</span> Phân tích hành vi khách hàng
            </span>
          </footer>
        </div>
      </div>
    </AssistantDock>
  );
}
