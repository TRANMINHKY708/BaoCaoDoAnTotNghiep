import { useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle2, KeyRound, LockKeyhole, LogOut, PlugZap, ShieldCheck } from 'lucide-react';
import { useWorkspace } from '../../app/context';
import { ErrorState } from '../../components/states';
import { ApiError } from '../../api/errors';

export default function ConnectPage() {
  const { session, status, role, mode: connectedMode } = useWorkspace();
  const [mode, setMode] = useState<'local' | 'secured'>('secured');
  const [token, setToken] = useState('');
  const [error, setError] = useState<unknown>(null);
  async function connect(event: FormEvent) {
    event.preventDefault();
    const entered = token;
    setToken('');
    setError(null);
    try {
      await session.connect(mode, entered);
    } catch (cause) {
      if (!(cause instanceof ApiError && cause.kind === 'cancelled')) setError(cause);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">KẾT NỐI AN TOÀN</span>
          <h1>Kết nối không gian làm việc</h1>
        </div>
        <span className="scope-badge">
          <ShieldCheck size={14} /> Kết nối trong phiên làm việc
        </span>
      </div>
      <div className="connect-grid">
        <section className="panel connect-panel">
          <div className="connect-panel-heading">
            <span className="big-icon">
              <PlugZap size={25} />
            </span>
            <h2>
              {status === 'connected' ? 'Đã kết nối không gian làm việc' : 'Bắt đầu phiên làm việc'}
            </h2>
            <p>Dùng mã do người quản trị cung cấp. Đây chưa phải tài khoản cá nhân.</p>
          </div>
          {status === 'connected' ? (
            <div className="connected-details" role="status">
              <CheckCircle2 size={34} />
              <h3>
                {connectedMode === 'local'
                  ? 'Kết nối trên máy · không xác thực'
                  : role === 'operator'
                    ? 'Quyền vận hành'
                    : 'Quyền xem'}
              </h3>
              <p>
                {connectedMode === 'local'
                  ? 'Chỉ dùng trên máy này. Quyền vận hành chưa được xác thực.'
                  : 'Quyền đã được hệ thống xác minh. Dữ liệu thuộc không gian làm việc chung.'}
              </p>
              <button className="button button-secondary" onClick={session.disconnect}>
                <LogOut size={16} />
                Ngắt kết nối
              </button>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                void connect(event);
              }}
            >
              <fieldset className="connection-modes" disabled={status === 'connecting'}>
                <legend>Chế độ kết nối</legend>
                <label className={mode === 'secured' ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="mode"
                    value="secured"
                    checked={mode === 'secured'}
                    onChange={() => setMode('secured')}
                  />
                  <LockKeyhole size={17} />
                  <span>
                    Bảo mật<small>Mã kết nối · quyền xem / vận hành</small>
                  </span>
                </label>
                <label className={mode === 'local' ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="mode"
                    value="local"
                    checked={mode === 'local'}
                    onChange={() => {
                      setMode('local');
                      setToken('');
                    }}
                  />
                  <PlugZap size={17} />
                  <span>
                    Trên máy này<small>Kết nối cục bộ · không xác thực</small>
                  </span>
                </label>
              </fieldset>
              {mode === 'secured' ? (
                <div className="form-field">
                  <label htmlFor="workspace-token">Mã kết nối</label>
                  <input
                    id="workspace-token"
                    type="password"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Nhập mã kết nối được cấp"
                    disabled={status === 'connecting'}
                    aria-describedby="token-help"
                    required
                  />
                  <small id="token-help">
                    Mã chỉ được giữ trong thẻ trình duyệt này và bị xóa khi tải lại, ngắt kết nối
                    hoặc phiên không còn hợp lệ.
                  </small>
                </div>
              ) : (
                <div className="inline-note">
                  Kết nối trên máy không xác thực danh tính. Chỉ dùng với dịch vụ cục bộ đáng tin
                  cậy.
                </div>
              )}
              <button
                className="button button-primary button-full"
                disabled={status === 'connecting'}
                type="submit"
              >
                <PlugZap size={17} />
                {status === 'connecting' ? 'Đang kiểm tra kết nối…' : 'Kết nối không gian làm việc'}
              </button>
              {status === 'connecting' && (
                <button
                  className="button button-plain button-full"
                  type="button"
                  onClick={session.disconnect}
                >
                  Hủy kết nối
                </button>
              )}
            </form>
          )}
          {error !== null && <ErrorState error={error} />}
        </section>
        <aside className="connection-guide">
          <span className="eyebrow">BẢO MẬT THEO THIẾT KẾ</span>
          <h2>
            Quyền rõ ràng.
            <br />
            Dữ liệu được tôn trọng.
          </h2>
          <div className="guide-item">
            <KeyRound size={20} />
            <div>
              <h3>Chỉ dùng trong phiên làm việc</h3>
            </div>
          </div>
          <div className="guide-item">
            <ShieldCheck size={20} />
            <div>
              <h3>Quyền truy cập rõ ràng</h3>
              <p>
                Quyền xem cho phép phân tích và đọc lịch sử. Quyền vận hành cho phép quản lý và lưu
                dữ liệu.
              </p>
            </div>
          </div>
          <div className="guide-item">
            <LockKeyhole size={20} />
            <div>
              <h3>Dữ liệu dùng chung</h3>
              <p>
                Chưa có tài khoản cá nhân hoặc quyền sở hữu dữ liệu riêng. Những người được cấp
                quyền cùng sử dụng một không gian làm việc.
              </p>
            </div>
          </div>
          <div className="research-callout">
            Ngắt kết nối khi rời máy. Việc triển khai ra bên ngoài cần cấu hình bảo mật riêng.
          </div>
        </aside>
      </div>
    </>
  );
}
