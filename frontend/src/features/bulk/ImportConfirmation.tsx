import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../app/context';
import { ErrorState, LoadingState } from '../../components/states';
import type { Dataset, Manifest } from './types';
import type { ImportIntent, ImportJob } from './importTypes';

const names: Record<string, string> = {
  customers_created: 'Khách tạo mới',
  customers_matched: 'Khách đã có',
  customers_updated: 'Khách cập nhật',
  snapshots_created: 'Snapshot mới',
  snapshots_skipped: 'Snapshot dùng lại',
  snapshots_ineligible: 'Không tạo snapshot do thiếu dữ liệu',
};
export function JobResult({ job }: { job: ImportJob }) {
  return (
    <div aria-label="Kết quả nhập dữ liệu">
      <h3>
        {job.status === 'completed'
          ? 'Nhập dữ liệu hoàn tất'
          : job.status === 'failed'
            ? 'Nhập thất bại — đã rollback dữ liệu nghiệp vụ'
            : 'Job chưa hoàn tất — chưa xác nhận thành công'}
      </h3>
      <p>Mã job: {job.job_id}</p>
      {job.status === 'completed' && (
        <dl className="bulk-counts">
          {Object.entries(names).map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{job.counts[key] ?? 0}</dd>
            </div>
          ))}
        </dl>
      )}
      {job.status === 'failed' && (
        <p role="alert">
          Không có khách hàng hoặc snapshot nào của lần thử này được giữ lại. Lịch sử lỗi vẫn được
          lưu. Mã lỗi: {job.error_code}
          {job.error_row ? ` · dòng ${job.error_row}` : ''}.
        </p>
      )}
    </div>
  );
}

export function ImportConfirmation({
  manifest,
  dataset,
  expired,
  onLock,
}: {
  manifest: Manifest;
  dataset: Dataset;
  expired: boolean;
  onLock: (value: boolean) => void;
}) {
  const { session, hasCapability } = useWorkspace();
  const [checked, setChecked] = useState(false);
  const [intent, setIntent] = useState<ImportIntent | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [lookupNotice, setLookupNotice] = useState('');
  const active = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  useEffect(
    () => () => {
      active.current?.abort();
      onLock(false);
    },
    [onLock],
  );
  const allowed =
    hasCapability('customers.write') &&
    hasCapability('snapshots.create') &&
    hasCapability('inference.csv.run');
  async function confirm() {
    if (inFlight.current || !checked || expired || !allowed || dataset !== 'behavior') return;
    inFlight.current = true;
    const body = intent ?? {
      manifest_reference: manifest.manifest_reference,
      manifest_digest: manifest.manifest_digest,
      idempotency_key: crypto.randomUUID(),
      acknowledge_import: true as const,
      accept_partial: manifest.stats.error > 0,
    };
    setIntent(body);
    setBusy(true);
    setError(null);
    setLookupNotice('');
    onLock(true);
    const controller = new AbortController();
    active.current = controller;
    try {
      const result = await session.client.confirmImport(body, controller.signal);
      if (controller.signal.aborted) return;
      setJob(result);
      setUnknown(result.status === 'pending');
      onLock(result.status === 'pending');
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e);
      setUnknown(true);
      onLock(true);
    } finally {
      inFlight.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  async function lookup() {
    if (!intent || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    active.current = controller;
    try {
      const result = await session.client.listImports(intent.idempotency_key, controller.signal);
      if (controller.signal.aborted) return;
      const found = result.items[0];
      setJob(found ?? null);
      setUnknown(false);
      onLock(false);
      setLookupNotice(
        found
          ? ''
          : 'Chưa tìm thấy job đã lưu cho mã yêu cầu này. Có thể gửi lại cùng mã, không tạo mã mới.',
      );
    } catch (e) {
      if (!controller.signal.aborted) setError(e);
    } finally {
      inFlight.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="bulk-section" aria-label="Xác nhận import PostgreSQL">
      <h3>4. Xác nhận nhập vào hệ thống</h3>
      {dataset !== 'behavior' ? (
        <p>Đơn hàng hiện chỉ hỗ trợ kiểm tra và xem trước, chưa nhập hồ sơ hoặc snapshot.</p>
      ) : (
        <>
          <p>
            Chỉ ghi {manifest.stats.valid} dòng hợp lệ; cách ly {manifest.stats.error} dòng lỗi,
            trong đó {manifest.stats.duplicate} dòng trùng. Dự kiến{' '}
            {manifest.stats.snapshot_eligible} dòng đủ snapshot;{' '}
            {manifest.stats.snapshot_ineligible} dòng chỉ đối chiếu/tạo hồ sơ, không tự điền dữ liệu
            thiếu. Số tạo mới/dùng lại được xác định khi đối chiếu database.
          </p>
          <label className="bulk-check">
            <input
              type="checkbox"
              checked={checked}
              disabled={busy || !!intent}
              onChange={(e) => setChecked(e.target.checked)}
            />
            Tôi xác nhận ghi các dòng hợp lệ vào PostgreSQL và chấp nhận chính sách nhập một phần
            nêu trên.
          </label>
          {!allowed && <p role="alert">Bạn chưa có đủ quyền ghi khách hàng và snapshot.</p>}
          {expired && (
            <p role="alert">Bản chuẩn bị đã hết hạn. Vẫn có thể kiểm tra kết quả job đã gửi.</p>
          )}
          <button
            className="button button-primary"
            disabled={
              !checked ||
              !allowed ||
              expired ||
              busy ||
              unknown ||
              job?.status === 'completed' ||
              job?.status === 'failed'
            }
            onClick={() => void confirm()}
          >
            {intent ? 'Gửi lại cùng mã yêu cầu' : 'Xác nhận nhập dữ liệu'}
          </button>
          {intent && (
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={() => void lookup()}
            >
              Kiểm tra kết quả đã gửi
            </button>
          )}
          {unknown && (
            <p role="alert">
              Trạng thái ghi chưa rõ. Hãy kiểm tra kết quả trước; hệ thống không tự gửi lại hoặc tạo
              mã mới.
            </p>
          )}
          {lookupNotice && <p role="status">{lookupNotice}</p>}
          {!!error && <ErrorState error={error} />}
          {busy && <LoadingState label="Đang đối chiếu và xử lý yêu cầu…" />}
          {job && <JobResult job={job} />}
          {job?.status === 'failed' && !busy && !expired && (
            <button
              className="button button-secondary"
              onClick={() => {
                setIntent(null);
                setJob(null);
                setChecked(false);
                setUnknown(false);
                onLock(false);
                setError(null);
              }}
            >
              Chuẩn bị lần thử mới sau rollback
            </button>
          )}
        </>
      )}
    </div>
  );
}
