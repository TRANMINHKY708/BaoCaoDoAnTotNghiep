import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useWorkspace } from '../../app/context';
import { ErrorState } from '../../components/states';
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  passwordFailure,
  passwordIssue,
  passwordLength,
  roleLabel,
  safeDestination,
} from './accounts';
import './accounts.css';

export function PasswordField({
  label,
  value,
  setValue,
  autoComplete = 'current-password',
  disabled = false,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  autoComplete?: string;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="account-field">
      {label}
      <span className="password-control">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          required
          maxLength={512}
          spellCheck={false}
        />
        <button
          type="button"
          className="icon-button"
          aria-label={`${visible ? 'Ẩn' : 'Hiện'} ${label.toLowerCase()}`}
          aria-pressed={visible}
          disabled={disabled}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}

/** K18: live feedback while a new password is typed; silent until the user starts typing. */
export function PasswordRules({ value, confirm }: { value: string; confirm?: string }) {
  if (!value && !confirm) return null;
  const size = passwordLength(value);
  const length =
    size > PASSWORD_MAX
      ? { ok: false, text: `Dài quá ${PASSWORD_MAX} ký tự.` }
      : size < PASSWORD_MIN
        ? {
            ok: false,
            text: `Còn thiếu ${PASSWORD_MIN - size} ký tự (cần ít nhất ${PASSWORD_MIN}).`,
          }
        : !value.trim()
          ? { ok: false, text: 'Không được chỉ có khoảng trắng.' }
          : { ok: true, text: `Đủ độ dài (${size} ký tự).` };
  const match =
    confirm === undefined || !confirm
      ? null
      : value.normalize('NFC') === confirm.normalize('NFC')
        ? { ok: true, text: 'Mật khẩu xác nhận đã khớp.' }
        : { ok: false, text: 'Mật khẩu xác nhận chưa khớp.' };
  return (
    <ul className="password-rules" aria-live="polite">
      {[length, match].map(
        (rule) =>
          rule && (
            <li key={rule.text} className={rule.ok ? 'is-ok' : 'is-bad'}>
              {rule.ok ? '✓' : '•'} {rule.text}
            </li>
          ),
      )}
    </ul>
  );
}

export function LoginPage() {
  const { session, status, authState, notice } = useWorkspace();
  const [username, setUsername] = useState(''),
    [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(),
    [validation, setValidation] = useState('');
  const location = useLocation(),
    navigate = useNavigate();
  const destination = safeDestination((location.state as { from?: unknown } | null)?.from);
  const busy = status === 'connecting';
  if (!session.accountMode) return <Navigate to="/connect" replace />;
  if (status === 'connected')
    return (
      <Navigate
        to={authState === 'password_change_required' ? '/change-password' : destination}
        replace
      />
    );
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username.trim().toLowerCase()) || !password) {
      setValidation('Nhập tên đăng nhập và mật khẩu hợp lệ.');
      return;
    }
    // A password below the policy can never match; say so instead of spending a login attempt.
    if (passwordLength(password) < PASSWORD_MIN) {
      setValidation(
        `Mật khẩu có ít nhất ${PASSWORD_MIN} ký tự, bạn mới nhập ${passwordLength(password)} ký tự. Kiểm tra lại mật khẩu.`,
      );
      return;
    }
    setValidation('');
    const entered = password;
    setPassword('');
    try {
      await session.login(username, entered);
      void navigate(
        session.getSnapshot().user?.must_change_password ? '/change-password' : destination,
        { replace: true },
      );
    } catch (failure) {
      setError(failure);
    }
  }
  return (
    <section className="account-entry">
      <div className="account-intro">
        <span className="account-brand">
          MK <b>eAI</b>
        </span>
        <h1>Chào mừng bạn trở lại</h1>

        <div className="account-security">
          <ShieldCheck size={22} />
          <span>
            Không gian phân tích của bạn
            <br />
          </span>
        </div>
      </div>
      <div className="account-card">
        <LockKeyhole className="account-emblem" size={28} />
        <h2>Đăng nhập</h2>

        {notice && (
          <p role="status" className="inline-note">
            {notice}
          </p>
        )}
        {authState === 'session_unknown' && (
          <p role="alert">
            Chưa thể xác minh phiên. Không có dữ liệu tài khoản nào được hiển thị.
            <button
              type="button"
              className="button button-secondary"
              disabled={busy}
              onClick={() => {
                void session.restore().catch(setError);
              }}
            >
              Kiểm tra lại phiên
            </button>
          </p>
        )}
        <form
          onSubmit={(e) => {
            void submit(e);
          }}
        >
          <label className="account-field">
            Tên đăng nhập
            <input
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={64}
              disabled={busy}
              required
            />
          </label>
          <PasswordField label="Mật khẩu" value={password} setValue={setPassword} disabled={busy} />
          {validation && <p role="alert">{validation}</p>}
          {passwordFailure(error, 'login') ? (
            <p role="alert">{passwordFailure(error, 'login')}</p>
          ) : error ? (
            <ErrorState error={error} />
          ) : null}
          <button className="button button-primary button-full" disabled={busy} type="submit">
            {busy ? 'Đang xác minh…' : 'Đăng nhập'}
          </button>
        </form>
        <small>Nếu cần tài khoản hoặc hỗ trợ mật khẩu, hãy liên hệ quản trị viên.</small>
      </div>
    </section>
  );
}

export function PasswordPage() {
  const { session, user, status } = useWorkspace();
  const [current, setCurrent] = useState(''),
    [replacement, setReplacement] = useState(''),
    [confirm, setConfirm] = useState('');
  const [error, setError] = useState<unknown>(),
    [validation, setValidation] = useState('');
  const navigate = useNavigate();
  const busy = status === 'connecting';
  async function submit(event: FormEvent) {
    event.preventDefault();
    const issue =
      (passwordLength(current) < PASSWORD_MIN
        ? `Mật khẩu hiện tại chưa đúng (mật khẩu có ít nhất ${PASSWORD_MIN} ký tự).`
        : '') ||
      passwordIssue(replacement) ||
      (replacement.normalize('NFC') !== confirm.normalize('NFC')
        ? 'Mật khẩu xác nhận chưa khớp.'
        : '') ||
      (current.normalize('NFC') === replacement.normalize('NFC')
        ? 'Mật khẩu mới phải khác mật khẩu hiện tại.'
        : '');
    setValidation(issue);
    if (issue) return;
    const old = current,
      next = replacement;
    setCurrent('');
    setReplacement('');
    setConfirm('');
    setError(undefined);
    try {
      await session.changePassword(old, next);
      void navigate('/login', { replace: true });
    } catch (failure) {
      setError(failure);
    }
  }
  return (
    <section className="account-card account-password">
      <h1>{user?.must_change_password ? 'Thiết lập mật khẩu của bạn' : 'Đổi mật khẩu'}</h1>
      <p>
        {user?.must_change_password
          ? 'Bạn cần đổi mật khẩu lần đầu trước khi sử dụng các chức năng.'
          : 'Sau khi đổi, tất cả phiên đăng nhập sẽ được thu hồi.'}
      </p>
      <form
        onSubmit={(e) => {
          void submit(e);
        }}
      >
        <PasswordField
          label="Mật khẩu hiện tại"
          value={current}
          setValue={setCurrent}
          disabled={busy}
        />
        <PasswordField
          label="Mật khẩu mới"
          autoComplete="new-password"
          value={replacement}
          setValue={setReplacement}
          disabled={busy}
        />
        <PasswordField
          label="Xác nhận mật khẩu mới"
          autoComplete="new-password"
          value={confirm}
          setValue={setConfirm}
          disabled={busy}
        />
        <p className="muted">
          {PASSWORD_MIN}–{PASSWORD_MAX} ký tự; không dùng mật khẩu phổ biến.
        </p>
        <PasswordRules value={replacement} confirm={confirm} />
        {validation && <p role="alert">{validation}</p>}
        {passwordFailure(error, 'change') ? (
          <p role="alert">{passwordFailure(error, 'change')}</p>
        ) : error ? (
          <ErrorState error={error} />
        ) : null}
        <button type="submit" className="button button-primary" disabled={busy}>
          {busy ? 'Đang xử lý…' : 'Đổi mật khẩu và đăng nhập lại'}
        </button>
      </form>
      {user?.must_change_password ? (
        <button
          type="button"
          className="button button-secondary"
          disabled={busy}
          onClick={() => {
            void session.logout().catch(setError);
          }}
        >
          Đăng xuất
        </button>
      ) : (
        <Link to="/account">Về tài khoản</Link>
      )}
    </section>
  );
}

export function AccountPage() {
  const { session, user } = useWorkspace();
  const [error, setError] = useState<unknown>();
  return (
    <section className="account-card">
      <h1>Tài khoản của tôi</h1>
      <dl className="account-facts">
        <dt>Tên đăng nhập</dt>
        <dd>{user?.username}</dd>
        <dt>Tên hiển thị</dt>
        <dd>{user?.display_name}</dd>
        <dt>Vai trò</dt>
        <dd>{roleLabel(user?.role)}</dd>
        <dt>Phiên</dt>
        <dd>Được máy chủ xác minh; tự hết hạn khi không hoạt động.</dd>
      </dl>
      <div className="account-actions">
        <Link to="/change-password" className="button button-secondary">
          Đổi mật khẩu
        </Link>
        <button
          type="button"
          className="button button-primary"
          onClick={() => {
            void session.logout().catch(setError);
          }}
        >
          Đăng xuất
        </button>
      </div>
      {error ? <ErrorState error={error} /> : null}
    </section>
  );
}
