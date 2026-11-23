import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { FileDown } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../../app/context';
import { ApiError } from '../../api/errors';
import { ErrorState, LoadingState } from '../../components/states';
import { downloadBlob } from '../predictions/csv';
import { dateTime } from '../customers/customers';
import { roleLabel } from './accounts';
import {
  categoryLabel,
  checkedAuditPage,
  eventLabel,
  filtersFrom,
  outcomeLabel,
  personName,
  resourceLabel,
  type AuditCategory,
  type AuditEvent,
  type AuditFilters,
  type AuditOutcome,
  type AuditPage,
} from './audit';
import '../customers/customers.css';
import '../reports/reports.css';
import './audit.css';

const PAGE = 50;

/** K13: download the log as Excel with exactly the filters on screen (Admin only, read-only). */
function AuditExport({ filters }: { filters: AuditFilters }) {
  const { session, revision } = useWorkspace();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState('');
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function run() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError('');
    setDone('');
    try {
      const file = await session.client.exportAuditLog(
        { ...filters, timezone: 'Asia/Ho_Chi_Minh' },
        { signal: controller.signal },
      );
      if (controller.signal.aborted || session.getSnapshot().revision !== revision) return;
      downloadBlob(file.blob, file.filename);
      setDone('Đã tải tệp Excel theo bộ lọc hiện tại.');
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof ApiError
            ? failure.message
            : 'Chưa thể xuất nhật ký. Vui lòng thử lại.',
        );
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <div className="audit-export">
      <button
        type="button"
        className="button button-secondary"
        disabled={busy}
        onClick={() => void run()}
      >
        <FileDown size={16} />
        {busy ? 'Đang xuất Excel…' : 'Xuất Excel'}
      </button>
      <small>Theo bộ lọc đang chọn, mới nhất trước, tối đa 5.000 sự kiện.</small>
      {error && (
        <p role="alert" className="report-export-error">
          {error}
        </p>
      )}
      {done && <small role="status">{done}</small>}
    </div>
  );
}

function target(event: AuditEvent) {
  if (event.subject && event.subject.id !== event.actor?.id) return personName(event.subject);
  if (event.resource_type)
    return `${resourceLabel[event.resource_type] ?? event.resource_type} ${event.resource_id?.slice(0, 8) ?? ''}`;
  return event.subject ? 'Chính mình' : '—';
}

export default function AdminAuditPage() {
  const { session, revision, hasCapability } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const filters = filtersFrom(params);
  const allowed = hasCapability('users.manage');
  const update = (key: keyof AuditFilters, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const person = useQuery({
    queryKey: ['audit-person', revision, filters.user_id],
    enabled: allowed && !!filters.user_id,
    queryFn: async ({ signal }) =>
      (
        await session.client.request('get', '/api/v1/admin/users/{user_id}', {
          params: { user_id: filters.user_id! },
          signal,
        })
      ).data,
  });
  const events = useInfiniteQuery({
    queryKey: ['admin-audit', revision, filters],
    enabled: allowed,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: AuditPage) => last.next_cursor ?? undefined,
    queryFn: async ({ pageParam, signal }): Promise<AuditPage> =>
      checkedAuditPage(
        await session.client.auditEvents(
          { ...filters, timezone: 'Asia/Ho_Chi_Minh', limit: PAGE, cursor: pageParam },
          signal,
        ),
      ),
  });
  if (!allowed)
    return (
      <div className="permission-panel">
        <h1>Không có quyền truy cập</h1>
        <p>Chỉ quản trị viên được xem nhật ký hoạt động.</p>
      </div>
    );
  const rows = events.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section className="audit-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">QUẢN TRỊ</span>
          <h1>Nhật ký hoạt động</h1>
          <p>
            Ai đã làm gì, lúc nào: đăng nhập, quản lý tài khoản và thay đổi dữ liệu nghiệp vụ. Chỉ
            đọc; giờ hiển thị theo TP.HCM (UTC+7).
          </p>
        </div>
      </div>
      <form className="account-filter" onSubmit={(e) => e.preventDefault()}>
        <label className="account-field">
          Nhóm sự kiện
          <select
            aria-label="Nhóm sự kiện"
            value={filters.category ?? ''}
            onChange={(e) => update('category', e.target.value)}
          >
            <option value="">Tất cả</option>
            {(Object.keys(categoryLabel) as AuditCategory[]).map((value) => (
              <option key={value} value={value}>
                {categoryLabel[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="account-field">
          Kết quả
          <select
            aria-label="Kết quả"
            value={filters.outcome ?? ''}
            onChange={(e) => update('outcome', e.target.value)}
          >
            <option value="">Tất cả</option>
            {(Object.keys(outcomeLabel) as AuditOutcome[]).map((value) => (
              <option key={value} value={value}>
                {outcomeLabel[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="account-field">
          Từ ngày
          <input
            type="date"
            aria-label="Từ ngày"
            value={filters.date_from ?? ''}
            max={filters.date_to}
            onChange={(e) => update('date_from', e.target.value)}
          />
        </label>
        <label className="account-field">
          Đến ngày
          <input
            type="date"
            aria-label="Đến ngày"
            value={filters.date_to ?? ''}
            min={filters.date_from}
            onChange={(e) => update('date_to', e.target.value)}
          />
        </label>
        {params.size > 0 && (
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setParams(new URLSearchParams(), { replace: true })}
          >
            Xóa bộ lọc
          </button>
        )}
      </form>
      <AuditExport filters={filters} />
      {filters.user_id && (
        <p className="audit-person" role="status">
          Đang xem nhật ký của{' '}
          <strong>
            {person.data
              ? `${person.data.display_name} (${person.data.username}) · ${roleLabel(person.data.role)}`
              : 'người dùng đã chọn'}
          </strong>{' '}
          — gồm việc người này làm và việc người khác làm với tài khoản này.{' '}
          <button type="button" className="text-link" onClick={() => update('user_id', '')}>
            Bỏ lọc người dùng
          </button>
        </p>
      )}
      {events.isPending ? (
        <LoadingState label="Đang tải nhật ký…" />
      ) : events.isError ? (
        <ErrorState error={events.error} onRetry={() => void events.refetch()} />
      ) : !rows.length ? (
        <div className="state-panel">
          <h2>Chưa có sự kiện phù hợp</h2>
          <p>Thử bỏ bớt bộ lọc hoặc mở rộng khoảng ngày.</p>
        </div>
      ) : (
        <>
          <div
            className="account-table-wrap"
            role="region"
            aria-label="Nhật ký hoạt động"
            tabIndex={0}
          >
            <table className="account-table audit-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Người thực hiện</th>
                  <th>Hành động</th>
                  <th>Đối tượng</th>
                  <th>Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((event) => (
                  <tr key={event.id}>
                    <td>{dateTime(event.occurred_at)}</td>
                    <td>
                      {event.actor ? (
                        <Link className="text-link" to={`/admin/audit?user_id=${event.actor.id}`}>
                          {personName(event.actor)}
                        </Link>
                      ) : (
                        <span className="muted">Chưa xác thực</span>
                      )}
                    </td>
                    <td>
                      {eventLabel[event.event_code] ?? event.event_code}
                      <small className="audit-code">{categoryLabel[event.category]}</small>
                    </td>
                    <td>{target(event)}</td>
                    <td>
                      <span className={`audit-outcome ${event.outcome}`}>
                        {outcomeLabel[event.outcome]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="account-pagination">
            <span>Đang hiện {rows.length} sự kiện mới nhất</span>
            {events.hasNextPage && (
              <button
                type="button"
                className="button button-secondary"
                disabled={events.isFetchingNextPage}
                onClick={() => void events.fetchNextPage()}
              >
                {events.isFetchingNextPage ? 'Đang tải…' : 'Tải thêm'}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
