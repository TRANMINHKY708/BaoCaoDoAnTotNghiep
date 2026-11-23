import { ResearchProfiles } from './ResearchProfiles';
import { ModelDetails } from '../../components/presentation';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Network, Play, X } from 'lucide-react';
import { useWorkspace } from '../../app/context';
import { ApiError } from '../../api/errors';
import type { paths } from '../../api/generated';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import type { Snapshot } from '../customers/customers';
import {
  adaptSnapshot,
  batchCustomers,
  formCustomer,
  InputError,
  labels,
  type Spec,
} from '../predictions/prediction';
import { downloadBlob, emptyTemplate, inspectCsv } from '../predictions/csv';
import { SnapshotPicker } from '../predictions/SnapshotPicker';
import { contextKey, requestedContext } from '../customer-analysis/contextNavigation';
import { segmentCsv, segmentSpec, verifySegment, VERSIONS, type Version } from './segmentation';
import { SegmentDistribution } from './SegmentDistribution';
import { SegmentResults, type SegmentOutput } from './SegmentResults';
import '../predictions/predictions.css';
import './segmentation.css';
type SingleBody =
  paths['/api/v1/predict/segment']['post']['requestBody']['content']['application/json'];
type BatchBody =
  paths['/api/v1/predict/batch/segment']['post']['requestBody']['content']['application/json'];
type Mode = 'single' | 'batch' | 'csv';

export default function SegmentationPage() {
  const { revision } = useWorkspace();
  return <Segmentation key={revision} />;
}
function Segmentation() {
  const [contextParams] = useSearchParams();
  const { session, status, revision } = useWorkspace(),
    [version, setVersion] = useState<Version>(VERSIONS[0]),
    [locked, setLocked] = useState(false);
  const query = useQuery({
      queryKey: ['segmentation-catalog', revision],
      enabled: status === 'connected',
      queryFn: async ({ signal }) => {
        const data = (await session.client.request('get', '/api/v1/model-info', { signal })).data;
        if (!Array.isArray(data.models)) throw new ApiError('protocol');
        return VERSIONS.map((v) => {
          const model = data.models.find((m) => m.task === 'segmentation' && m.model_version === v);
          if (!model) throw new ApiError('protocol');
          return segmentSpec(model);
        });
      },
    }),
    spec = query.data?.find((item) => item.model.model_version === version);
  return (
    <div className="predictions-workspace segmentation-workspace">
      <div className="page-heading">
        <div>
          <span className="eyebrow">KHÁM PHÁ HÀNH VI KHÁCH HÀNG</span>
          <h1>Phân nhóm khách hàng</h1>
        </div>
        <span className="prediction-product-badge">
          <Network size={18} />
          K-Means · K=3
        </span>
      </div>
      <div className="prediction-scope">
        <Network size={20} />
        <p>Phân nhóm hành vi hiện tại, khác mức độ mua hàng. Khoảng cách không phải xác suất.</p>
      </div>
      {status !== 'connected' ? (
        <section className="panel">
          <EmptyState
            title="Kết nối để phân nhóm khách hàng"
            description="Kết nối không gian làm việc để xem dữ liệu và sử dụng phân nhóm."
            connection
          />
        </section>
      ) : query.isPending ? (
        <LoadingState label="Đang tải thông tin phân nhóm…" />
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        spec && (
          <>
            <section className="panel prediction-model">
              <div>
                <span className="eyebrow">01 / PHIÊN BẢN MÔ HÌNH</span>
                <label htmlFor="segment-version">Mô hình phân nhóm</label>
                <select
                  id="segment-version"
                  value={version}
                  disabled={locked}
                  onChange={(e) => setVersion(e.target.value as Version)}
                >
                  <option value="1.0.0">Phân nhóm · bản ban đầu</option>
                  <option value="2.0.0-snapshot-k3">Phân nhóm tương tác · bản chọn lọc</option>
                </select>
              </div>
              <div className="prediction-model-facts">
                <span className="prediction-count demo-secondary">
                  10<small>BIẾN ĐẦU VÀO</small>
                </span>
                <div>
                  <strong>
                    {spec.model.persistence_supported
                      ? 'Có thể lưu khi bạn có quyền vận hành'
                      : 'Chỉ hỗ trợ phân tích, chưa hỗ trợ lưu kết quả'}
                  </strong>

                  <ModelDetails model={spec.model} />
                </div>
              </div>
            </section>
            <p className="prediction-model-limit">
              {version === '1.0.0'
                ? 'Tên nhóm theo phiên bản ban đầu được giữ nguyên. “Tiềm năng” không có nghĩa là khả năng mua trong tương lai đã được kiểm chứng.'
                : 'Các nhóm tương tác thấp, trung bình, cao được xác định tương đối so với dữ liệu nghiên cứu.'}{' '}
              Nhóm khách hàng không đồng nghĩa với nhãn Low, Medium, High của mức độ mua hàng.
            </p>
            {spec.model.available ? (
              <>
                <ResearchProfiles
                  key={`research:${version}:${spec.model.artifact_sha256}`}
                  spec={spec}
                />
                <SegmentDistribution key={version} spec={spec} />
                <SegmentWorkbench
                  key={`${version}:${spec.model.artifact_sha256}:${contextKey(contextParams)}`}
                  spec={spec}
                  onLock={setLocked}
                />
              </>
            ) : (
              <EmptyState
                title="Phiên bản K-Means chưa sẵn sàng"
                description="Bạn có thể chủ động chọn một phiên bản khả dụng khác."
              />
            )}
          </>
        )
      )}
    </div>
  );
}

function SegmentWorkbench({ spec, onLock }: { spec: Spec; onLock: (busy: boolean) => void }) {
  const workspace = useWorkspace();
  const { session, mode: workspaceMode, hasCapability } = workspace;
  const canWrite =
    workspaceMode === 'accounts' ? hasCapability('analysis.legacy.save') : workspace.canWrite;
  const canCsv = workspaceMode === 'accounts' ? hasCapability('inference.csv.run') : canWrite;
  const queries = useQueryClient(),
    [params] = useSearchParams();
  const context = requestedContext(params);
  const [mode, setMode] = useState<Mode>('single'),
    [origin, setOrigin] = useState(
      context.customerId || context.snapshotId ? 'customer' : 'manual',
    );
  const [draft, setDraft] = useState<Record<string, string>>({}),
    [nulls, setNulls] = useState<Set<string>>(new Set()),
    [source, setSource] = useState<{ snapshot: Snapshot; dirty: boolean } | null>(null);
  const [json, setJson] = useState(''),
    [file, setFile] = useState<File | null>(null),
    [save, setSave] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null),
    [output, setOutput] = useState<SegmentOutput | null>(null),
    [attempt, setAttempt] = useState<{ count: number; sent: boolean; saving: boolean } | null>(
      null,
    );
  const pending = useRef<AbortController | null>(null),
    alive = useRef(true),
    canSave = canWrite && spec.model.model_version === '1.0.0' && spec.model.persistence_supported;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      pending.current?.abort();
      onLock(false);
    };
  }, [onLock]);
  const changed = () => {
    setError(null);
    setOutput(null);
    setAttempt(null);
    if (source) setSource({ ...source, dirty: true });
  };
  const clear = () => {
    setDraft({});
    setNulls(new Set());
    setSource(null);
    setOutput(null);
    setError(null);
    setAttempt(null);
    setSave(false);
  };
  const pick = (snapshot: Snapshot) => {
    clear();
    try {
      const values = adaptSnapshot(snapshot, spec);
      setDraft(
        Object.fromEntries(
          Object.entries(values).map(([key, v]) => [key, v === null ? '' : String(v)]),
        ),
      );
      setNulls(new Set(Object.keys(values).filter((k) => values[k] === null)));
      setSource({ snapshot, dirty: false });
    } catch (caught) {
      setError(caught);
    }
  };
  const run = async () => {
    if (pending.current || (mode === 'csv' && !canCsv)) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    onLock(true);
    setError(null);
    setOutput(null);
    const info = { count: mode === 'single' ? 1 : 0, sent: false, saving: save && canSave };
    setAttempt({ ...info });
    try {
      let completed: SegmentOutput;
      if (mode === 'csv') {
        if (!file) throw new InputError([{ message: 'Chọn file CSV trước khi phân nhóm.' }]);
        const inspected = await inspectCsv(file, spec);
        info.count = inspected.total;
        if (controller.signal.aborted) throw new ApiError('cancelled');
        info.sent = true;
        setAttempt({ ...info });
        const response = await session.client.requestSegmentCsv(file, {
          modelVersion: spec.model.model_version as Version,
          saveResults: info.saving,
          signal: controller.signal,
          timeoutMs: 60000,
        });
        completed = {
          results: segmentCsv(await response.blob.text(), spec, info.count),
          blob: response.blob,
          saved: info.saving,
        };
      } else {
        const rows =
          mode === 'single' ? [formCustomer(draft, nulls, spec)] : batchCustomers(json, spec);
        info.count = rows.length;
        const links =
          mode === 'single' && info.saving && source
            ? {
                customer_id: source.snapshot.customer_id,
                ...(!source.dirty ? { behavior_snapshot_id: source.snapshot.id } : {}),
              }
            : {};
        const body =
          mode === 'single'
            ? {
                model_version: spec.model.model_version,
                customer: rows[0],
                save_result: info.saving,
                ...links,
              }
            : {
                model_version: spec.model.model_version,
                customers: rows,
                save_results: info.saving,
              };
        if (new TextEncoder().encode(JSON.stringify(body)).byteLength > 1024 * 1024)
          throw new InputError([{ message: 'Request JSON tối đa 1 MiB, gồm envelope.' }]);
        info.sent = true;
        setAttempt({ ...info });
        if (mode === 'single') {
          const response = await session.client.request('post', '/api/v1/predict/segment', {
            body: body as SingleBody,
            signal: controller.signal,
            timeoutMs: 60000,
          });
          completed = {
            narrativeReceipt: response.meta.analysisReceipt,
            results: [verifySegment(response.data, spec)],
            saved: info.saving,
            customerId: source?.snapshot.customer_id,
          };
        } else {
          const response = await session.client.request('post', '/api/v1/predict/batch/segment', {
            body: body as BatchBody,
            signal: controller.signal,
            timeoutMs: 60000,
          });
          if (
            response.data.total !== rows.length ||
            !Array.isArray(response.data.results) ||
            response.data.results.length !== rows.length
          )
            throw new ApiError('protocol');
          completed = {
            results: response.data.results.map((r) => verifySegment(r, spec)),
            saved: info.saving,
          };
        }
      }
      if (!controller.signal.aborted && alive.current) {
        setOutput(completed);
        if (info.saving) void queries.invalidateQueries({ queryKey: ['segment-distribution'] });
      }
    } catch (caught) {
      if (alive.current) setError(caught);
    } finally {
      if (alive.current) {
        setBusy(false);
        onLock(false);
      }
      pending.current = null;
    }
  };
  const uncertain =
    error &&
    attempt?.sent &&
    attempt.saving &&
    !(error instanceof ApiError && error.status >= 400 && error.status < 500);
  return (
    <>
      <section className="panel prediction-input" aria-label="Dữ liệu phân nhóm">
        <div className="prediction-section-heading">
          <span className="eyebrow">02 / PHÂN KHÚC TỪ DỮ LIỆU</span>
          <span className="prediction-help">Không điền giả giá trị thiếu · không làm tròn</span>
        </div>
        <div className="prediction-modes" aria-label="Chọn luồng phân nhóm">
          {(
            [
              ['single', 'Một khách hàng'],
              ['batch', 'Danh sách JSON'],
              ['csv', 'Nhập tệp CSV'],
            ] as const
          ).map(([key, label]) => (
            <button
              type="button"
              key={key}
              aria-pressed={mode === key}
              disabled={busy}
              className={mode === key ? 'selected' : ''}
              onClick={() => {
                setMode(key);
                setSave(false);
                setOutput(null);
                setError(null);
                setAttempt(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <fieldset className="prediction-fieldset" disabled={busy}>
          {mode === 'single' && (
            <>
              <div className="prediction-source-toggle">
                <button
                  type="button"
                  aria-pressed={origin === 'manual'}
                  className={origin === 'manual' ? 'selected' : ''}
                  onClick={() => setOrigin('manual')}
                >
                  Nhập thủ công
                </button>
                <button
                  type="button"
                  aria-pressed={origin === 'customer'}
                  className={origin === 'customer' ? 'selected' : ''}
                  onClick={() => setOrigin('customer')}
                >
                  Khách hàng có sẵn
                </button>
              </div>
              {origin === 'customer' && (
                <SnapshotPicker
                  initialId={context.customerId}
                  initialSnapshotId={context.snapshotId}
                  onPick={pick}
                  onCustomerChange={clear}
                />
              )}
              {source && (
                <div className="prediction-imported">
                  <p>
                    {source.dirty
                      ? 'Đã chỉnh dữ liệu: nếu lưu chỉ liên kết khách hàng, không liên kết bản ghi gốc.'
                      : 'Đã lấy 10 chỉ số từ bản ghi đã chọn; chưa chạy phân tích hoặc lưu.'}
                  </p>
                  <button className="button button-secondary" onClick={clear}>
                    Xóa dữ liệu & liên kết
                  </button>
                </div>
              )}
              <div className="prediction-feature-grid">
                {spec.features.map((f) => (
                  <div className="prediction-field" key={f.name}>
                    <label htmlFor={`segment-feature-${f.name}`}>
                      {labels[f.name] ?? f.name}
                      <small>
                        {f.name}
                        {f.min !== undefined ? ` · ≥ ${f.min}` : ''}
                        {f.max !== undefined ? ` · ≤ ${f.max}` : ''}
                      </small>
                    </label>
                    <input
                      id={`segment-feature-${f.name}`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={draft[f.name] ?? ''}
                      disabled={nulls.has(f.name)}
                      onChange={(e) => {
                        changed();
                        setDraft({ ...draft, [f.name]: e.target.value });
                      }}
                    />
                    {f.nullable && (
                      <label className="prediction-null">
                        <input
                          type="checkbox"
                          checked={nulls.has(f.name)}
                          aria-label={`Không có dữ liệu (null) cho ${f.name}`}
                          onChange={(e) => {
                            changed();
                            const next = new Set(nulls);
                            if (e.target.checked) next.add(f.name);
                            else next.delete(f.name);
                            setNulls(next);
                          }}
                        />
                        Không có dữ liệu (null)
                      </label>
                    )}
                  </div>
                ))}
              </div>
              <p className="prediction-help">
                Đơn vị giữ như nguồn, không tự gán tiền tệ/thời lượng. Phiên bản chọn lọc cho phép
                khai báo giá trị còn thiếu; tỷ lệ ngoài 0–100 được xử lý thành giá trị thiếu, các
                chỉ số còn lại phải không âm. Bản ghi gốc không bị sửa.{' '}
                {source
                  ? 'Nếu chọn lưu sẽ liên kết khách hàng đã chọn.'
                  : 'Nhập tay và lưu: kết quả không liên kết hồ sơ khách hàng.'}
              </p>
            </>
          )}
          {mode === 'batch' && (
            <div className="prediction-batch">
              <h3>Danh sách JSON · 1–100 bản ghi</h3>
              <p className="prediction-help">
                Nhập danh sách gồm đúng 10 biến cho mỗi bản ghi; không kèm mã hệ thống,
                Purchase_Level, Lifetime_Value hoặc Churned. Dùng giá trị số JSON, không dùng
                đúng/sai hoặc chuỗi số. Nếu lưu, kết quả không liên kết hồ sơ khách hàng.
              </p>
              <label htmlFor="segment-json">Dữ liệu JSON phân nhóm</label>
              <textarea
                id="segment-json"
                value={json}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => {
                  setJson(e.target.value);
                  changed();
                }}
              />
            </div>
          )}
          {mode === 'csv' && (
            <div className="prediction-upload">
              <Network size={34} />
              <h3>Phân nhóm từ file CSV</h3>
              <p>.csv UTF-8/BOM · ≤10MiB · 1–1.000 dòng</p>
              <p className="prediction-help">
                Cần đủ 10 cột dữ liệu theo mẫu. Mã khách hàng trong CSV không tự liên kết với hồ sơ;
                nếu chọn lưu, kết quả không liên kết hồ sơ khách hàng.
              </p>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => downloadBlob(emptyTemplate(spec), 'segmentation_headers.csv')}
              >
                Tải header mẫu phân nhóm
              </button>
              {canCsv ? (
                <label className="prediction-file-label">
                  Chọn file CSV phân nhóm
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null);
                      changed();
                    }}
                  />
                </label>
              ) : (
                <p className="prediction-role-note">
                  Nhập CSV cần quyền vận hành đã xác thực, kể cả khi không lưu. Quyền xem hoặc kết
                  nối trên máy vẫn có thể phân nhóm bằng JSON mà không lưu.
                </p>
              )}
              {file && (
                <p className="prediction-file-name">
                  {file.name} · {(file.size / 1024).toFixed(1)}KiB
                </p>
              )}
            </div>
          )}
          <div className="prediction-save-choice">
            {(workspaceMode !== 'accounts' || canWrite) && (
              <label>
                <input
                  type="checkbox"
                  disabled={!canSave}
                  checked={save && canSave}
                  onChange={(e) => setSave(e.target.checked)}
                />
                Lưu kết quả phân nhóm vào lịch sử
              </label>
            )}
            <p>
              {spec.model.model_version !== '1.0.0'
                ? 'Phiên bản này chỉ hỗ trợ phân tích, chưa hỗ trợ lưu kết quả.'
                : !canWrite
                  ? 'Cần quyền vận hành đã xác thực để lưu.'
                  : 'Mặc định không lưu; chỉ ghi khi bạn chọn và bấm chạy. Không tự sửa hồ sơ hoặc bản ghi gốc.'}
            </p>
          </div>
        </fieldset>
        <div className="prediction-run">
          <div>
            {busy && (
              <button className="button button-secondary" onClick={() => pending.current?.abort()}>
                <X size={15} />
                Hủy chờ kết quả
              </button>
            )}
            <button
              className="button button-primary"
              disabled={busy || (mode === 'csv' && !canCsv)}
              onClick={() => {
                void run();
              }}
            >
              <Play size={15} />
              {busy
                ? 'Đang phân nhóm…'
                : save && canSave
                  ? 'Chạy phân nhóm và lưu'
                  : 'Chạy phân nhóm'}
            </button>
          </div>
        </div>
      </section>
      {busy && <LoadingState label="Đang chạy K-Means…" />}
      {!!error && (
        <section className="panel prediction-error" aria-label="Lỗi phân nhóm">
          {error instanceof InputError ? (
            <div role="alert">
              <h3>Kiểm tra dữ liệu phân nhóm</h3>
              <p>{error.message}</p>
              <ul>
                {error.issues.slice(0, 30).map((issue, i) => (
                  <li key={i}>
                    {issue.row !== undefined ? `Dòng ${issue.row} · ` : ''}
                    {issue.field ? `${issue.field}: ` : ''}
                    {issue.message}
                  </li>
                ))}
              </ul>
              {error.issues.length > 30 && <p>Hiển thị30lỗi đầu; cần sửa toàn bộ trước khi gửi.</p>}
            </div>
          ) : (
            <>
              <ErrorState error={error} />
              {error instanceof ApiError && error.issues.length > 0 && (
                <ul>
                  {error.issues.slice(0, 30).map((issue, i) => (
                    <li key={i}>
                      {issue.row !== undefined ? `Dòng ${issue.row}` : 'Single'}
                      {issue.field ? ` · ${issue.field}` : ''}: không hợp lệ theo backend.
                    </li>
                  ))}
                </ul>
              )}
              {error instanceof ApiError && error.code === 'MODEL_PERSISTENCE_UNSUPPORTED' && (
                <p>Phiên bản này chưa hỗ trợ lưu kết quả.</p>
              )}
            </>
          )}
          {attempt?.sent && (
            <p>
              0 kết quả được hiển thị / {attempt.count} bản ghi đã gửi; không trả kết quả từng phần.
            </p>
          )}
          {!!uncertain && (
            <p className="prediction-uncertain" role="alert">
              Chưa xác định trạng thái ghi PostgreSQL. Hủy chờ/timeout/lỗi mạng không đảm bảo hủy
              ghi ở server. Không tự gửi lại; hãy kiểm tra lịch sử trước khi chủ động chạy lần nữa.
            </p>
          )}
        </section>
      )}
      {output && <SegmentResults key={output.results[0]?.generated_at} output={output} />}
      {!output && !error && !busy && (
        <section className="panel">
          <EmptyState
            title="Chưa chạy phân nhóm mới"
            description="Chọn mô hình, kiểm tra dữ liệu rồi bấm chạy. Việc mở hồ sơ hoặc chọn bản ghi không tự chạy phân tích hay lưu lịch sử."
          />
        </section>
      )}
    </>
  );
}
