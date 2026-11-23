import { customerCode } from '../../components/customerIdentity';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../api/errors';
import { useWorkspace } from '../../app/context';
import { ErrorState } from '../../components/states';
import { CustomerDialog } from './CustomerShared';
import { externalIdError, isStrongEtag, type Customer } from './customers';

type Props = {
  kind: 'create' | 'edit' | 'deactivate';
  customer?: Customer;
  etag?: string | null;
  onClose: () => void;
  onDone: (customer?: Customer) => void;
  onReload: () => void;
};

export function CustomerEditor({ kind, customer, etag = null, onClose, onDone, onReload }: Props) {
  const { session, revision, canWrite } = useWorkspace();
  const cache = useQueryClient();
  const [externalId, setExternalId] = useState(customer?.external_id ?? '');
  const [active, setActive] = useState(customer?.is_active ?? true);
  const [validation, setValidation] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const mutation = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!canWrite) throw new ApiError('http', 403);
      controller.current = new AbortController();
      const signal = controller.current.signal;
      if (kind === 'create')
        return (
          await session.client.request('post', '/api/v1/customers', {
            body: { external_id: externalId },
            signal,
          })
        ).data;
      if (!customer || !isStrongEtag(etag)) throw new ApiError('protocol');
      const options = {
        params: { customer_id: customer.id },
        headers: { 'If-Match': etag },
        signal,
      };
      if (kind === 'deactivate') {
        await session.client.request('delete', '/api/v1/customers/{customer_id}', options);
        return undefined;
      }
      return (
        await session.client.request('patch', '/api/v1/customers/{customer_id}', {
          ...options,
          body: {
            ...(externalId !== customer.external_id ? { external_id: externalId } : {}),
            ...(active !== customer.is_active ? { is_active: active } : {}),
          },
        })
      ).data;
    },
    onSuccess: (value) => {
      if (session.getSnapshot().revision !== revision) return;
      void cache.invalidateQueries({
        predicate: (query) =>
          ['customers', 'customer-detail', 'customer-records', 'dashboard-overview'].includes(
            String(query.queryKey[0]),
          ),
      });
      onDone(value);
    },
  });
  const stale = mutation.error instanceof ApiError && mutation.error.status === 412;
  const uncertain =
    mutation.error instanceof ApiError &&
    (['network', 'timeout', 'cancelled', 'protocol'].includes(mutation.error.kind) ||
      mutation.error.status >= 500);
  const noEtag = kind !== 'create' && !isStrongEtag(etag);
  const unchanged =
    kind === 'edit' && externalId === customer?.external_id && active === customer?.is_active;
  const title =
    kind === 'create'
      ? 'Thêm khách hàng'
      : kind === 'edit'
        ? 'Chỉnh sửa khách hàng'
        : 'Ngưng hoạt động khách hàng?';
  return (
    <CustomerDialog title={title} onClose={onClose} busy={mutation.isPending}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const error = kind === 'deactivate' ? '' : externalIdError(externalId);
          setValidation(error);
          if (!error && !stale && !uncertain && !noEtag && !unchanged) mutation.mutate();
        }}
        noValidate
      >
        {kind === 'deactivate' ? (
          <div className="customer-delete-note">
            <p>
              Bạn sắp ngưng hoạt động <strong>{customerCode(customer?.external_id ?? '')}</strong>.
            </p>
            <p>Hồ sơ và lịch sử được giữ lại. Bạn có thể kích hoạt lại khách hàng.</p>
          </div>
        ) : (
          <>
            <label className="customer-field">
              Mã khách hàng
              <input
                autoComplete="off"
                value={externalId}
                aria-invalid={!!validation}
                aria-describedby="customer-id-help"
                disabled={mutation.isPending || stale || uncertain}
                onChange={(e) => {
                  setExternalId(e.target.value);
                  setValidation('');
                }}
              />
            </label>
            <p className="customer-help" id="customer-id-help">
              Từ 1–100 ký tự. Không dùng thông tin nhạy cảm làm mã khách hàng.
            </p>
            {validation && (
              <p className="customer-form-error" role="alert">
                {validation}
              </p>
            )}
            {kind === 'edit' && (
              <label className="customer-field">
                Trạng thái
                <select
                  value={active ? 'true' : 'false'}
                  disabled={mutation.isPending || stale || uncertain}
                  onChange={(e) => setActive(e.target.value === 'true')}
                >
                  <option value="true">Đang hoạt động</option>
                  <option value="false">Ngưng hoạt động</option>
                </select>
              </label>
            )}
            {kind === 'create' && null}
          </>
        )}
        {mutation.isError && <ErrorState error={mutation.error} />}
        {(stale || uncertain || noEtag) && (
          <div className="customer-conflict" role="alert">
            <strong>
              {stale
                ? 'Có người đã cập nhật hồ sơ này.'
                : noEtag
                  ? 'Thiếu ETag hợp lệ từ máy chủ.'
                  : 'Chưa xác định được kết quả thao tác.'}
            </strong>
            <p>
              {stale
                ? 'Bản nháp chưa được ghi. Tải bản mới rồi kiểm tra và nhập lại thay đổi cần thiết. Không tự ghi đè hoặc gửi lại.'
                : 'Không gửi lại tự động. Đóng và đọc lại danh sách/hồ sơ để kiểm tra trạng thái trước khi quyết định.'}
            </p>
            <button type="button" className="button button-secondary" onClick={onReload}>
              Đóng và tải bản mới
            </button>
          </div>
        )}
        {mutation.error instanceof ApiError && mutation.error.status === 409 && (
          <p className="customer-form-error">
            Mã có thể đã được sử dụng. Kiểm tra danh sách hoặc chọn mã khác; không tạo mã tự động để
            né xung đột.
          </p>
        )}
        <div className="customer-form-actions">
          <button
            className="button button-secondary"
            type="button"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            className={`button ${kind === 'deactivate' ? 'customer-danger' : 'button-primary'}`}
            type="submit"
            disabled={!canWrite || mutation.isPending || stale || uncertain || noEtag || unchanged}
          >
            {mutation.isPending
              ? 'Đang gửi…'
              : kind === 'create'
                ? 'Tạo khách hàng'
                : kind === 'edit'
                  ? 'Lưu thay đổi'
                  : 'Xác nhận ngưng hoạt động'}
          </button>
        </div>
      </form>
    </CustomerDialog>
  );
}
