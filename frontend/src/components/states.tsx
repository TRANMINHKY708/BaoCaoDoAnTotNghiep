import { AlertCircle, ArrowRight, Database, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/errors';

export function LoadingState({ label = 'Đang tải dữ liệu…' }: { label?: string }) {
  return (
    <div className="state-panel" role="status">
      <LoaderCircle className="spin" size={26} />
      <p>{label}</p>
    </div>
  );
}
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const known = error instanceof ApiError;
  return (
    <div className="state-panel state-error" role="alert">
      <AlertCircle size={28} />
      <h3>Chưa thể hoàn thành yêu cầu</h3>
      <p>
        {known ? error.message : 'Đã xảy ra lỗi. Vui lòng thử lại hoặc quay về trang tổng quan.'}
      </p>
      {known && error.retryAfterSeconds !== undefined && (
        <small>Thử lại sau khoảng {error.retryAfterSeconds} giây. Không tự gửi lại yêu cầu.</small>
      )}
      {known && error.requestId && (
        <details className="technical-details">
          <summary>Thông tin kỹ thuật</summary>
          <small>Mã hỗ trợ: {error.requestId}</small>
        </details>
      )}
      {onRetry && (
        <button className="button button-secondary" onClick={onRetry}>
          Thử lại
        </button>
      )}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  connection = false,
}: {
  title: string;
  description: string;
  connection?: boolean;
}) {
  return (
    <div className="state-panel">
      <div className="state-icon">
        <Database size={25} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {connection && (
        <Link className="button button-secondary" to="/connect">
          Kết nối không gian làm việc <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
