import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../app/context';
import { ApiError } from '../../api/errors';
import { productText } from '../../utils/productText';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import type { BulkConfig, Dataset, Filter, Inspection, Manifest, Preview, Stats } from './types';
import { ImportConfirmation } from './ImportConfirmation';
import { ImportHistory } from './ImportHistory';
import { ReadinessPanel, type ReadinessState } from './ReadinessPanel';
import { vietnamDateTime } from './time';
import './bulk.css';

const notices =
  'Các bước đọc CSV, kiểm tra và chuẩn bị không ghi dữ liệu. Chỉ ghi vào hệ thống sau khi bạn xác nhận nhập dữ liệu ở bước cuối.';
const labels: Record<keyof Stats, string> = {
  total: 'Tổng số dòng',
  valid: 'Hợp lệ',
  error: 'Có lỗi',
  warning: 'Có cảnh báo',
  duplicate: 'Trùng khóa',
  skipped: 'Bỏ qua do trùng',
  snapshot_eligible: 'Đủ dữ liệu snapshot',
  snapshot_ineligible: 'Chưa đủ snapshot',
};
const statuses = {
  all: 'Tất cả',
  valid: 'Hợp lệ',
  error: 'Có lỗi',
  warning: 'Có cảnh báo',
  duplicate: 'Trùng',
  skipped: 'Bị bỏ qua',
};
function Counts({ stats }: { stats: Stats }) {
  return (
    <dl className="bulk-counts">
      {Object.entries(stats).map(([k, n]) => (
        <div key={k}>
          <dt>{labels[k as keyof Stats]}</dt>
          <dd>{n.toLocaleString('vi-VN')}</dd>
        </div>
      ))}
    </dl>
  );
}
export default function BulkPage() {
  const { revision } = useWorkspace();
  return <BulkWorkspace key={revision} />;
}
function BulkWorkspace() {
  const { session, status, hasCapability } = useWorkspace();
  const [dataset, setDataset] = useState<Dataset>('behavior');
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [config, setConfig] = useState<BulkConfig>({
    mapping: {},
    profile: 'snapshot',
    models: [],
  });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [busy, setBusy] = useState('');
  const [importLocked, setImportLocked] = useState(false);
  const locked = !!busy || importLocked;
  const [error, setError] = useState<unknown>(null);
  const [localError, setLocalError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [reviewed, setReviewed] = useState(false);
  const [partial, setPartial] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const active = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      active.current?.abort();
    };
  }, []);
  const authorized =
    status === 'connected' && session.accountMode && hasCapability('inference.csv.run');
  // K11: every role that reads customers and history can review past imports and batch results.
  const canReadHistory =
    status === 'connected' &&
    session.accountMode &&
    hasCapability('customers.read') &&
    hasCapability('history.read');
  const expired =
    !!inspection &&
    (now >= Date.parse(inspection.expires_at) ||
      (error instanceof ApiError && error.status === 410));
  // Only invalidate the displayed assessment; keep confirmation/import rules unchanged.
  const readinessState: ReadinessState =
    expired || (preview && now >= Date.parse(preview.expires_at))
      ? 'expired'
      : busy
        ? 'loading'
        : error
          ? 'error'
          : 'ready';
  const fields = inspection
    ? dataset === 'behavior'
      ? [
          ...inspection.contract.behavior_required_metadata,
          ...inspection.contract.behavior_optional_metadata,
          ...inspection.contract.behavior_features.map((f) => f.name),
        ]
      : Object.keys(inspection.contract.order_schema.properties)
    : [];
  const selected = Object.values(config.mapping);
  const mappingReady =
    inspection &&
    inspection.headers.every((h) => !!config.mapping[h]) &&
    new Set(selected).size === selected.length;
  function invalidate() {
    setPreview(null);
    setManifest(null);
    setReviewed(false);
    setPartial(false);
    setError(null);
  }
  function reset() {
    epoch.current++;
    active.current?.abort();
    setBusy('');
    setInspection(null);
    invalidate();
    setLocalError('');
  }
  async function run(label: string, task: (signal: AbortSignal) => Promise<void>) {
    const id = ++epoch.current;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(label);
    setError(null);
    setLocalError('');
    try {
      await task(controller.signal);
    } catch (e) {
      if (
        id === epoch.current &&
        !controller.signal.aborted &&
        !(e instanceof ApiError && e.kind === 'cancelled')
      )
        setError(e);
    } finally {
      if (id === epoch.current && !controller.signal.aborted) setBusy('');
    }
  }
  function inspect() {
    if (!file) return;
    if (!file.size || file.size > 10 * 1024 * 1024) {
      setLocalError('Chọn CSV không rỗng, tối đa 10 MiB.');
      return;
    }
    invalidate();
    setInspection(null);
    void run('Đang đọc CSV…', async (signal) => {
      const body = new FormData();
      body.append('file', file);
      body.append('dataset_type', dataset);
      const data = await session.client.requestBulk('inspect', body, signal);
      if (signal.aborted) return;
      setInspection(data);
      const allowed =
        dataset === 'behavior'
          ? [
              ...data.contract.behavior_required_metadata,
              ...data.contract.behavior_optional_metadata,
              ...data.contract.behavior_features.map((f) => f.name),
            ]
          : Object.keys(data.contract.order_schema.properties);
      setConfig({
        mapping: Object.fromEntries(data.headers.map((h) => [h, allowed.includes(h) ? h : ''])),
        profile: 'snapshot',
        models: [],
      });
    });
  }
  function validate(page = 1, nextFilter = filter) {
    if (!inspection) return;
    setManifest(null);
    setReviewed(false);
    setPartial(false);
    void run('Đang kiểm tra dữ liệu…', async (signal) => {
      const data = await session.client.requestBulk(
        'preview',
        {
          upload_reference: inspection.upload_reference,
          ...config,
          page,
          page_size: 25,
          status: nextFilter,
        },
        signal,
      );
      if (!signal.aborted) setPreview(data);
    });
  }
  function prepare() {
    if (!inspection || !preview) return;
    void run('Đang chuẩn bị xác nhận…', async (signal) => {
      const data = await session.client.requestBulk(
        'prepare-confirmation',
        {
          upload_reference: inspection.upload_reference,
          preview_reference: preview.preview_reference,
          acknowledge_review: reviewed,
          accept_partial: partial,
        },
        signal,
      );
      if (!signal.aborted) setManifest(data);
    });
  }
  return (
    <div className="bulk-workspace">
      <div className="page-heading">
        <div>
          <span className="eyebrow">DỮ LIỆU DOANH NGHIỆP</span>
          <h1>Nhập dữ liệu &amp; Phân tích hàng loạt</h1>
        </div>
      </div>
      <p className="bulk-notice">{notices} Chức năng này chưa chạy mô hình AI.</p>
      {!authorized ? (
        <>
          <EmptyState
            title="Cần quyền vận hành dữ liệu"
            description={
              canReadHistory
                ? 'Tải CSV và nhập dữ liệu cần tài khoản vận hành hoặc quản trị. Bạn vẫn xem được lịch sử nhập và kết quả phân tích lô bên dưới.'
                : 'Đăng nhập bằng tài khoản quản trị hoặc vận hành để chuẩn bị CSV. Tài khoản chỉ xem không được tải dữ liệu lên.'
            }
          />
          {canReadHistory && <ImportHistory />}
        </>
      ) : (
        <>
          <section className="panel bulk-section">
            <h2>1. Chọn dữ liệu</h2>
            <label>
              Loại dữ liệu
              <select
                aria-label="Loại dữ liệu"
                disabled={locked}
                value={dataset}
                onChange={(e) => {
                  reset();
                  setDataset(e.target.value as Dataset);
                }}
              >
                <option value="behavior">Dữ liệu hành vi khách hàng</option>
                <option value="orders">Dữ liệu đơn hàng</option>
              </select>
            </label>
            <label>
              Tệp CSV
              <input
                aria-label="Tệp CSV"
                type="file"
                accept=".csv,text/csv"
                disabled={locked}
                onChange={(e) => {
                  reset();
                  setFile(e.target.files?.[0] ?? null);
                }}
              />
            </label>
            {file && (
              <p role="status">
                Đã chọn: {file.name} · {(file.size / 1024).toFixed(1)} KiB
              </p>
            )}
            <p>
              UTF-8, dấu phẩy · tối đa 10 MiB / 1.000 dòng. Định danh = nguồn dữ liệu + mã khách
              hàng. Không tự gộp theo tên hoặc email.
            </p>
            <button className="button button-primary" disabled={!file || locked} onClick={inspect}>
              Đọc tệp CSV
            </button>
          </section>
          {localError && <p role="alert">{localError}</p>}
          {error && <ErrorState error={error} />}
          {busy && <LoadingState label={busy} />}
          {inspection && (
            <section className="panel bulk-section">
              <h2>2. Ánh xạ cột</h2>
              <p>
                {inspection.filename} · {inspection.total_rows} dòng ·{' '}
                {(inspection.size / 1024).toFixed(1)} KiB. Hết hạn lúc{' '}
                {vietnamDateTime(inspection.expires_at)}.
              </p>
              {expired && <p role="alert">Lô tạm đã hết hạn. Hãy đọc lại tệp.</p>}
              {dataset === 'behavior' && (
                <label>
                  Phạm vi kiểm tra
                  <select
                    aria-label="Phạm vi kiểm tra"
                    disabled={locked}
                    value={
                      config.profile === 'snapshot'
                        ? 'snapshot'
                        : `${config.models[0]?.task}|${config.models[0]?.version}`
                    }
                    onChange={(e) => {
                      invalidate();
                      const [task, version] = e.target.value.split('|');
                      setConfig((c) => ({
                        ...c,
                        profile: e.target.value === 'snapshot' ? 'snapshot' : 'model_input',
                        models: version
                          ? [{ task: task as 'classification' | 'segmentation', version }]
                          : [],
                      }));
                    }}
                  >
                    <option value="snapshot">Dữ liệu hành vi đầy đủ — 25 đặc trưng</option>
                    {inspection.contract.models.map((m) => (
                      <option key={`${m.task}${m.version}`} value={`${m.task}|${m.version}`}>
                        {m.task === 'classification' ? 'Dự đoán mức mua' : 'Phân nhóm'} ·{' '}
                        {m.version} · {m.features.length} đặc trưng
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p>
                Thiếu feature không được tự điền. Đầu vào 12/10 feature chưa đủ để tạo snapshot. Đơn
                hàng chỉ được kiểm tra, chưa chuyển thành dữ liệu ML.
              </p>
              <div className="bulk-mapping">
                {inspection.headers.map((h) => (
                  <label key={h}>
                    <span>{h}</span>
                    <select
                      aria-label={`Ánh xạ ${h}`}
                      value={config.mapping[h] ?? ''}
                      disabled={locked}
                      onChange={(e) => {
                        invalidate();
                        setConfig((c) => ({
                          ...c,
                          mapping: { ...c.mapping, [h]: e.target.value },
                        }));
                      }}
                    >
                      <option value="">Chọn trường chuẩn</option>
                      {fields.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              {!mappingReady && null}
              <button
                className="button button-primary"
                disabled={!mappingReady || locked || expired}
                onClick={() => {
                  setFilter('all');
                  setPreview(null);
                  validate(1, 'all');
                }}
              >
                Kiểm tra dữ liệu
              </button>
            </section>
          )}
          {inspection && !preview && (busy || error || expired) && (
            <ReadinessPanel
              dataset={dataset}
              config={config}
              preview={null}
              state={readinessState}
            />
          )}
          {preview && (
            <section className="panel bulk-section">
              <h2>3. Xem trước và kiểm tra</h2>
              <ReadinessPanel
                dataset={dataset}
                config={config}
                preview={preview}
                state={readinessState}
              />
              <Counts stats={preview.stats} />
              <p>
                Một dòng có thể vừa hợp lệ vừa có cảnh báo. Số dòng trùng nằm trong số dòng lỗi; tất
                cả dòng trùng đều bị cách ly. Các số đếm không cộng độc lập.
              </p>
              <label>
                Lọc trạng thái
                <select
                  aria-label="Lọc trạng thái"
                  value={filter}
                  disabled={locked || expired}
                  onChange={(e) => {
                    const f = e.target.value as Filter;
                    setFilter(f);
                    validate(1, f);
                  }}
                >
                  {Object.entries(statuses).map(([k, v]) => (
                    <option value={k} key={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <div className="bulk-table">
                <table>
                  <thead>
                    <tr>
                      <th>Dòng</th>
                      <th>Định danh</th>
                      <th>Trạng thái</th>
                      <th>Snapshot</th>
                      <th>Giá trị nguồn / trường thiếu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.row}>
                        <td>{r.row}</td>
                        <td>
                          {r.identity
                            ? `${r.identity.source_system} / ${r.identity.external_customer_id}`
                            : 'Chưa hợp lệ'}
                        </td>
                        <td>
                          {r.duplicate
                            ? 'Trùng — cách ly'
                            : r.error
                              ? 'Có lỗi'
                              : r.warning
                                ? 'Hợp lệ, có cảnh báo'
                                : 'Hợp lệ'}
                        </td>
                        <td>
                          {dataset === 'orders'
                            ? 'Không áp dụng'
                            : r.snapshot_eligible
                              ? 'Đủ dữ liệu'
                              : 'Chưa đủ'}
                        </td>
                        <td>
                          <details>
                            <summary>Xem dữ liệu</summary>
                            <dl>
                              {Object.entries(r.values).map(([k, v]) => (
                                <div key={k}>
                                  <dt>{k}</dt>
                                  <dd>{v || 'Trống'}</dd>
                                </div>
                              ))}
                            </dl>
                            {r.missing_features.length > 0 && (
                              <p>Thiếu: {r.missing_features.join(', ')}</p>
                            )}
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!preview.rows.length && <p>Không có dòng thuộc trạng thái này.</p>}
              <div className="bulk-actions">
                <button
                  className="button button-secondary"
                  disabled={preview.page <= 1 || locked || expired}
                  onClick={() => validate(preview.page - 1)}
                >
                  Trang trước
                </button>
                <span>
                  Trang {preview.page} /{' '}
                  {Math.max(1, Math.ceil(preview.filtered_rows / preview.page_size))}
                </span>
                <button
                  className="button button-secondary"
                  disabled={
                    preview.page * preview.page_size >= preview.filtered_rows || locked || expired
                  }
                  onClick={() => validate(preview.page + 1)}
                >
                  Trang sau
                </button>
              </div>
              <h3>Lỗi và cảnh báo của trang đang xem</h3>
              <ul className="bulk-issues">
                {preview.issues.map((i, index) => (
                  <li key={index}>
                    <strong>
                      {i.row === null ? 'Toàn lô' : `Dòng ${i.row}`} ·{' '}
                      {i.severity === 'error' ? 'Lỗi' : 'Cảnh báo'}
                    </strong>{' '}
                    {i.source_column || i.field ? `(${i.source_column ?? i.field})` : ''}:{' '}
                    {productText(i.message)}
                    {i.value !== null && <span> Giá trị: {i.value || 'Trống'}</span>}
                    <small>{i.code}</small>
                  </li>
                ))}
              </ul>
              <label className="bulk-check">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                Tôi đã xem số lượng, lỗi và cảnh báo của lô.
              </label>
              {preview.stats.error > 0 && (
                <label className="bulk-check">
                  <input
                    type="checkbox"
                    checked={partial}
                    onChange={(e) => setPartial(e.target.checked)}
                  />
                  Tôi xác nhận chỉ chuyển {preview.stats.valid} dòng hợp lệ; cách ly{' '}
                  {preview.stats.error} dòng lỗi, bao gồm {preview.stats.duplicate} dòng trùng.
                </label>
              )}
              <button
                className="button button-primary"
                disabled={
                  locked ||
                  expired ||
                  !preview.mapping_valid ||
                  !preview.stats.valid ||
                  !reviewed ||
                  (preview.stats.error > 0 && !partial)
                }
                onClick={prepare}
              >
                Chuẩn bị xác nhận
              </button>
            </section>
          )}
          {manifest && (
            <section className="panel bulk-section" role="status">
              <h2>Đã chuẩn bị dữ liệu cho bước tiếp theo</h2>
              <Counts stats={manifest.stats} />
              <p>{notices}</p>

              <details>
                <summary>Thông tin kỹ thuật</summary>
                <p>Fingerprint file: {inspection?.file_fingerprint}</p>
                <p>Digest bản chuẩn bị: {manifest.manifest_digest}</p>
              </details>
              <ImportConfirmation
                key={manifest.manifest_digest}
                manifest={manifest}
                dataset={dataset}
                expired={expired}
                onLock={setImportLocked}
              />
            </section>
          )}
          <ImportHistory />
        </>
      )}
    </div>
  );
}
