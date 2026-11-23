import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, LockKeyhole, X } from 'lucide-react';
import { useWorkspace } from '../../app/context';
import { number } from './customers';

export function WriteNotice() {
  const { canWrite, mode } = useWorkspace();
  if (canWrite) return null;
  return (
    <div className="customer-notice">
      <LockKeyhole size={16} />
      <p>
        {mode === 'local'
          ? 'Kết nối trên máy chỉ hỗ trợ xem trên giao diện. Cần quyền vận hành đã xác thực để thêm hoặc chỉnh sửa.'
          : 'Bạn đang có quyền xem. Cần quyền vận hành để thêm, chỉnh sửa hoặc ngưng hoạt động khách hàng.'}{' '}
      </p>
    </div>
  );
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`customer-status ${active ? 'active' : ''}`}>
      <span />
      {active ? 'Đang hoạt động' : 'Ngưng hoạt động'}
    </span>
  );
}

export function Pagination({
  offset,
  limit,
  total,
  count,
  busy,
  onChange,
}: {
  offset: number;
  limit: number;
  total: number;
  count: number;
  busy?: boolean;
  onChange: (offset: number) => void;
}) {
  return (
    <nav className="customer-pagination" aria-label="Phân trang dữ liệu">
      <span>
        {count ? `${number(offset + 1)}–${number(offset + count)}` : '0'} / {number(total)} bản ghi
        theo bộ lọc
      </span>
      <div>
        <button
          className="button button-secondary"
          disabled={busy || offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          <ChevronLeft size={15} /> Trang trước
        </button>
        <span>Trang {number(Math.floor(offset / limit) + 1)}</span>
        <button
          className="button button-secondary"
          disabled={busy || offset + limit >= total}
          onClick={() => onChange(offset + limit)}
        >
          Trang sau <ChevronRight size={15} />
        </button>
      </div>
    </nav>
  );
}

export function CustomerDialog({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const pending = useRef(busy);
  useEffect(() => {
    close.current = onClose;
    pending.current = busy;
  }, [onClose, busy]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const shell = document.querySelector('.app-shell');
    shell?.setAttribute('inert', '');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () =>
      Array.from(
        container.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
        ) ?? [],
      );
    (
      container.current?.querySelector<HTMLElement>('input') ??
      focusable()[0] ??
      container.current
    )?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!pending.current) close.current();
      }
      if (event.key === 'Tab') {
        const elements = focusable();
        const first = elements[0],
          last = elements.at(-1);
        if (!elements.length) {
          event.preventDefault();
          container.current?.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === container.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('keydown', keyboard);
      shell?.removeAttribute('inert');
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <div className="customer-dialog-backdrop">
      <div
        className="customer-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-dialog-title"
        tabIndex={-1}
        ref={container}
      >
        <div className="customer-dialog-heading">
          <h2 id="customer-dialog-title">{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Đóng hộp thoại"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
