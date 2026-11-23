import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../../app/context';
import { isCustomerId } from '../customers/customers';
import { useAssistant } from './AssistantContext';

export default function AssistantPage() {
  const { session, status, authState, hasCapability } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const openAssistant = useAssistant()?.open;
  const customerId = params.get('customer_id') ?? '';
  const allowed =
    session.accountMode &&
    status === 'connected' &&
    authState === 'authenticated' &&
    hasCapability('models.read');
  useEffect(() => {
    if (allowed && (!customerId || isCustomerId(customerId)))
      openAssistant?.(customerId || undefined);
  }, [allowed, customerId, openAssistant]);
  useEffect(
    () =>
      session.subscribe(() => {
        if (session.getSnapshot().status !== 'connected' && customerId)
          setParams({}, { replace: true });
      }),
    [session, customerId, setParams],
  );
  if (!allowed)
    return (
      <section className="account-card">
        <h1>Trợ lý MK eAI</h1>
        <p>
          {status === 'connected'
            ? 'Không có quyền sử dụng trợ lý'
            : 'Vui lòng đăng nhập bằng tài khoản để sử dụng trợ lý.'}
        </p>
        {status !== 'connected' && (
          <Link className="button button-primary" to="/login">
            Đăng nhập
          </Link>
        )}
      </section>
    );
  if (customerId && !isCustomerId(customerId))
    return (
      <section className="account-card">
        <h1>Ngữ cảnh khách hàng chưa hợp lệ</h1>
        <button className="button button-secondary" onClick={() => setParams({})}>
          Bỏ ngữ cảnh khách hàng
        </button>
      </section>
    );
  return (
    <section className="account-card">
      <h1>Trợ lý MK eAI luôn bên bạn</h1>

      <button
        className="button button-primary"
        onClick={() => openAssistant?.(customerId || undefined)}
      >
        Mở hộp chat
      </button>
      <Link className="button button-secondary" to="/dashboard">
        Về tổng quan
      </Link>
    </section>
  );
}
