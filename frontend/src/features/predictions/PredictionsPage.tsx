import { ModelDetails } from '../../components/presentation';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  BrainCircuit,
  ChevronRight,
  FileJson,
  FileSpreadsheet,
  Play,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { useWorkspace } from '../../app/context';
import { ApiError } from '../../api/errors';
import type { paths } from '../../api/generated';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { dateTime, type Snapshot } from '../customers/customers';
import {
  adaptSnapshot,
  batchCustomers,
  formCustomer,
  InputError,
  labels,
  modelSpec,
  VERSIONS,
  verifyResult,
  type Spec,
  type Version,
} from './prediction';
import { csvPredictions, downloadBlob, emptyTemplate, inspectCsv } from './csv';
import { PredictionResults, type PredictionOutput } from './PredictionResults';
import { SnapshotPicker } from './SnapshotPicker';
import { contextKey, requestedContext } from '../customer-analysis/contextNavigation';
import './predictions.css';

type SingleBody =
  paths['/api/v1/predict/purchase-level']['post']['requestBody']['content']['application/json'] & {
    explain?: boolean;
  };
type BatchBody =
  paths['/api/v1/predict/batch/purchase-level']['post']['requestBody']['content']['application/json'];
type Mode = 'single' | 'batch' | 'csv';
const modes = [
  ['single', 'Một khách hàng', UserRound],
  ['batch', 'Danh sách JSON', FileJson],
  ['csv', 'Nhập tệp CSV', FileSpreadsheet],
] as const;

export default function PredictionsPage() {
  const { revision } = useWorkspace();
  return <Predictions key={revision} />;
}

function Predictions() {
  const [contextParams] = useSearchParams();
  const { session, status, revision } = useWorkspace();
  const [version, setVersion] = useState<Version>(VERSIONS[0]);
  const [locked, setLocked] = useState(false);
  const catalog = useQuery({
    queryKey: ['prediction-model-catalog', revision],
    enabled: status === 'connected',
    queryFn: async ({ signal }) => {
      const response = await session.client.request('get', '/api/v1/model-info', { signal });
      if (!Array.isArray(response.data.models)) throw new ApiError('protocol');
      return VERSIONS.map((v) => {
        const model = response.data.models.find(
          (m) => m.task === 'classification' && m.model_version === v,
        );
        if (!model) throw new ApiError('protocol');
        return modelSpec(model);
      });
    },
  });
  const spec = catalog.data?.find((item) => item.model.model_version === version);
  return (
    <div className="predictions-workspace">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PHÂN TÍCH MỨC ĐỘ MUA HÀNG</span>
          <h1>Dự đoán mức độ mua hàng</h1>
        </div>
        <span className="prediction-product-badge">
          <BrainCircuit size={17} />
          XGBoost
        </span>
      </div>
      <div className="prediction-scope">
        <ShieldCheck size={21} />
        <p>Phân loại mức mua từ dữ liệu hiện có, không dự báo giao dịch tương lai.</p>
      </div>
      {status !== 'connected' ? (
        <section className="panel">
          <EmptyState
            title="Kết nối để chạy dự đoán"
            description="Chọn workspace trước khi tải schema và sử dụng mô hình AI. Không chạy dự đoán hoặc gửi dữ liệu khi chưa kết nối."
            connection
          />
        </section>
      ) : catalog.isPending ? (
        <LoadingState label="Đang tải thông tin mô hình…" />
      ) : catalog.isError ? (
        <ErrorState
          error={catalog.error}
          onRetry={() => {
            void catalog.refetch();
          }}
        />
      ) : (
        spec && (
          <>
            <section className="panel prediction-model" aria-label="Chọn phiên bản XGBoost">
              <div>
                <span className="eyebrow">01 / PHIÊN BẢN MÔ HÌNH</span>
                <label htmlFor="prediction-model-version">Mô hình phân loại</label>
                <select
                  id="prediction-model-version"
                  value={version}
                  disabled={locked}
                  onChange={(e) => setVersion(e.target.value as Version)}
                >
                  <option value={VERSIONS[0]}>Mức mua · bản đầy đủ</option>
                  <option value={VERSIONS[1]}>Mức mua · bản chọn lọc</option>
                </select>
              </div>
              <div className="prediction-model-facts">
                <span className="prediction-count demo-secondary">
                  {spec.model.feature_count}
                  <small>BIẾN ĐẦU VÀO</small>
                </span>
                <div>
                  <strong>
                    {spec.model.persistence_supported
                      ? 'Có thể lưu khi bạn có quyền vận hành'
                      : 'Chỉ hỗ trợ phân tích, chưa hỗ trợ lưu kết quả'}
                  </strong>
                  <p>
                    {spec.model.available
                      ? 'Mô hình đã sẵn sàng.'
                      : 'Mô hình hiện không khả dụng. Bạn có thể chọn phiên bản khác.'}
                  </p>
                  <ModelDetails model={spec.model} />
                </div>
              </div>
            </section>
            <div className="prediction-model-limit">
              {version === VERSIONS[0]
                ? 'Bản đầy đủ sử dụng một số chỉ số tổng hợp chưa được xác minh thời điểm ghi nhận. Cần đọc kết quả cùng giới hạn dữ liệu.'
                : 'Bản chọn lọc dùng các biến đã được lựa chọn cho dữ liệu hiện có. Giá trị chưa có cần được khai báo rõ, không tự đoán hoặc điền thay.'}{' '}
            </div>
            {spec.model.available ? (
              <PredictionWorkbench
                key={`${version}:${spec.model.artifact_sha256}:${contextKey(contextParams)}`}
                spec={spec}
                onLock={setLocked}
              />
            ) : (
              <EmptyState
                title="Mô hình hiện không khả dụng"
                description="Bạn có thể chủ động chọn một phiên bản khả dụng khác."
              />
            )}
          </>
        )
      )}
    </div>
  );
}

function PredictionWorkbench({ spec, onLock }: { spec: Spec; onLock: (value: boolean) => void }) {
  const { session, canWrite: legacyWrite, mode: workspaceMode, hasCapability } = useWorkspace();
  const canWrite =
    workspaceMode === 'accounts' ? hasCapability('analysis.legacy.save') : legacyWrite;
  const canCsv = workspaceMode === 'accounts' ? hasCapability('inference.csv.run') : canWrite;
  const [params] = useSearchParams(),
    { customerId: initialId, snapshotId: initialSnapshotId } = requestedContext(params);
  const [mode, setMode] = useState<Mode>('single'),
    [origin, setOrigin] = useState(initialId || initialSnapshotId ? 'customer' : 'manual');
  const [draft, setDraft] = useState<Record<string, string>>({}),
    [nulls, setNulls] = useState<Set<string>>(new Set());
  const [source, setSource] = useState<{ snapshot: Snapshot; dirty: boolean } | null>(null);
  const [json, setJson] = useState(''),
    [file, setFile] = useState<File | null>(null),
    [save, setSave] = useState(false);
  const [explain, setExplain] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [output, setOutput] = useState<PredictionOutput | null>(null);
  const [attempt, setAttempt] = useState<{ count: number; sent: boolean; saving: boolean } | null>(
    null,
  );
  const pending = useRef<AbortController | null>(null),
    alive = useRef(true);
  const canSave =
    canWrite && spec.model.persistence_supported && spec.model.model_version === VERSIONS[0];
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      pending.current?.abort();
      onLock(false);
    };
  }, [onLock]);
  const changed = () => {
    setOutput(null);
    setError(null);
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
    try {
      const value = adaptSnapshot(snapshot, spec);
      setDraft(
        Object.fromEntries(
          Object.entries(value).map(([key, v]) => [key, v === null ? '' : String(v)]),
        ),
      );
      setNulls(new Set(Object.keys(value).filter((key) => value[key] === null)));
      setSource({ snapshot, dirty: false });
      setOutput(null);
      setError(null);
      setAttempt(null);
    } catch (caught) {
      clear();
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
      let completed: PredictionOutput;
      if (mode === 'csv') {
        if (!file) throw new InputError([{ message: 'Chọn file CSV trước khi dự đoán.' }]);
        const csv = await inspectCsv(file, spec);
        info.count = csv.total;
        if (controller.signal.aborted) throw new ApiError('cancelled');
        info.sent = true;
        setAttempt({ ...info });
        const response = await session.client.requestPurchaseCsv(file, {
          modelVersion: spec.model.model_version as Version,
          saveResults: info.saving,
          signal: controller.signal,
          timeoutMs: 60000,
        });
        completed = {
          results: csvPredictions(await response.blob.text(), spec, csv.total),
          saved: info.saving,
          blob: response.blob,
        };
      } else {
        const customers =
          mode === 'single' ? [formCustomer(draft, nulls, spec)] : batchCustomers(json, spec);
        info.count = customers.length;
        const links =
          info.saving && source && mode === 'single'
            ? {
                customer_id: source.snapshot.customer_id,
                ...(!source.dirty ? { behavior_snapshot_id: source.snapshot.id } : {}),
              }
            : {};
        const body =
          mode === 'single'
            ? {
                model_version: spec.model.model_version,
                customer: customers[0],
                save_result: info.saving,
                ...(explain ? { explain: true } : {}),
                ...links,
              }
            : { model_version: spec.model.model_version, customers, save_results: info.saving };
        if (new TextEncoder().encode(JSON.stringify(body)).byteLength > 1024 * 1024)
          throw new InputError([{ message: 'Request JSON tối đa 1 MiB, bao gồm envelope.' }]);
        info.sent = true;
        setAttempt({ ...info });
        // The cast bridges generated discriminated DTOs only AFTER selected runtime schema validation.
        if (mode === 'single') {
          const response = await session.client.request('post', '/api/v1/predict/purchase-level', {
            body: body as SingleBody,
            signal: controller.signal,
            timeoutMs: 60000,
          });
          completed = {
            narrativeReceipt: response.meta.analysisReceipt,
            results: [verifyResult(response.data, spec.model.model_version)],
            saved: info.saving,
            customerId: source?.snapshot.customer_id,
            explanationRequested: explain,
            explanation: explain
              ? (response.data as unknown as Record<string, unknown>).explanation
              : undefined,
            artifact: spec.model.artifact_sha256,
          };
        } else {
          const response = await session.client.request(
            'post',
            '/api/v1/predict/batch/purchase-level',
            { body: body as BatchBody, signal: controller.signal, timeoutMs: 60000 },
          );
          if (
            response.data.total !== customers.length ||
            !Array.isArray(response.data.results) ||
            response.data.results.length !== customers.length
          )
            throw new ApiError('protocol');
          completed = {
            results: response.data.results.map((r) => verifyResult(r, spec.model.model_version)),
            saved: info.saving,
          };
        }
      }
      if (!controller.signal.aborted && alive.current) setOutput(completed);
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
    attempt?.sent &&
    attempt.saving &&
    error &&
    !(error instanceof ApiError && error.status >= 400 && error.status < 500);
  return (
    <>
      <section className="panel prediction-input" aria-label="Dữ liệu dự đoán">
        <div className="prediction-section-heading">
          <span className="eyebrow">02 / DỮ LIỆU ĐẦU VÀO</span>
          <span className="prediction-help">Không tự điền giá trị thiếu · không làm tròn</span>
        </div>
        <div className="prediction-modes" aria-label="Chọn luồng dự đoán">
          {modes.map(([key, label, Icon]) => (
            <button
              type="button"
              key={key}
              aria-pressed={mode === key}
              disabled={busy}
              className={mode === key ? 'selected' : ''}
              onClick={() => {
                setMode(key);
                setExplain(false);
                setSave(false);
                setError(null);
                setOutput(null);
                setAttempt(null);
              }}
            >
              <Icon size={17} />
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
                  className={origin === 'manual' ? 'selected' : ''}
                  aria-pressed={origin === 'manual'}
                  onClick={() => setOrigin('manual')}
                >
                  Nhập thủ công
                </button>
                <button
                  type="button"
                  className={origin === 'customer' ? 'selected' : ''}
                  aria-pressed={origin === 'customer'}
                  onClick={() => setOrigin('customer')}
                >
                  Khách hàng có sẵn
                </button>
              </div>
              {origin === 'customer' && (
                <SnapshotPicker
                  initialId={initialId}
                  initialSnapshotId={initialSnapshotId}
                  onPick={pick}
                  onCustomerChange={clear}
                />
              )}
              {source && (
                <div className="prediction-imported" role="status">
                  <div>
                    <strong>Đã nhập snapshot · {dateTime(source.snapshot.captured_at)}</strong>
                    <p>
                      {source.dirty
                        ? 'Đã chỉnh dữ liệu: chỉ giữ liên kết khách hàng khi lưu; không gắn kết quả vào snapshot gốc.'
                        : 'Dữ liệu từ bản ghi đã chọn được giữ nguyên.'}
                    </p>
                  </div>
                  <button type="button" className="button button-secondary" onClick={clear}>
                    Xóa dữ liệu & liên kết
                  </button>
                </div>
              )}
              <div className="prediction-feature-grid">
                {spec.features.map((feature) => (
                  <div className="prediction-field" key={feature.name}>
                    <label htmlFor={`feature-${feature.name}`}>
                      {labels[feature.name] ?? feature.name}
                      <small>
                        <span className="technical-inline">{feature.name}</span>
                        {feature.kind === 'number' &&
                        (feature.min !== undefined || feature.max !== undefined)
                          ? ` · ${feature.min === undefined ? '' : `≥ ${feature.min}`}${feature.max === undefined ? '' : ` ≤ ${feature.max}`}`
                          : ''}
                      </small>
                    </label>
                    {feature.choices ? (
                      <select
                        id={`feature-${feature.name}`}
                        disabled={nulls.has(feature.name)}
                        value={draft[feature.name] ?? ''}
                        onChange={(e) => {
                          changed();
                          setDraft({ ...draft, [feature.name]: e.target.value });
                        }}
                      >
                        <option value="">Chọn giá trị</option>
                        {feature.choices.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={`feature-${feature.name}`}
                        type="text"
                        inputMode={feature.kind === 'number' ? 'decimal' : undefined}
                        disabled={nulls.has(feature.name)}
                        value={draft[feature.name] ?? ''}
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(e) => {
                          changed();
                          setDraft({ ...draft, [feature.name]: e.target.value });
                        }}
                      />
                    )}
                    {feature.nullable && (
                      <label className="prediction-null">
                        <input
                          type="checkbox"
                          aria-label={`Không có dữ liệu (null) cho ${feature.name}`}
                          checked={nulls.has(feature.name)}
                          onChange={(e) => {
                            changed();
                            const next = new Set(nulls);
                            if (e.target.checked) next.add(feature.name);
                            else next.delete(feature.name);
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
                Dùng thang/đơn vị gốc; không tự suy ra đơn vị tiền tệ hoặc thời lượng.{' '}
                {canSave &&
                  (source
                    ? 'Lưu (nếu chọn) sẽ liên kết khách hàng đã nhập snapshot.'
                    : 'Nhập thủ công: nếu chọn lưu, kết quả không liên kết hồ sơ khách hàng.')}
              </p>
            </>
          )}
          {mode === 'batch' && (
            <div className="prediction-batch">
              <h3>Danh sách JSON · 1–100 bản ghi</h3>
              <p className="prediction-help">
                Nhập danh sách gồm đúng {spec.features.length} biến cho mỗi bản ghi. Dùng tên cột
                trong mục Thông tin kỹ thuật, không kèm nhãn kết quả hoặc mã hệ thống. Giá trị số
                cần đúng định dạng JSON; chỉ dùng null khi phiên bản cho phép. Lưu batch (nếu chọn)
                không liên kết hồ sơ khách hàng.
              </p>
              <label htmlFor="prediction-json">Dữ liệu JSON</label>
              <textarea
                id="prediction-json"
                value={json}
                onChange={(e) => {
                  setJson(e.target.value);
                  setOutput(null);
                  setError(null);
                  setAttempt(null);
                }}
                placeholder="[\n  { ...feature của từng bản ghi... }\n]"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          )}
          {mode === 'csv' && (
            <div className="prediction-upload">
              <FileSpreadsheet size={34} />
              <h3>Dự đoán từ file CSV</h3>
              <p>.csv UTF-8/BOM · tối đa 10 MiB · 1–1.000 dòng</p>
              <p className="prediction-help">
                Header cần đủ {spec.features.length} feature đúng phiên bản. customer_id/external_id
                chỉ passthrough, không liên kết hồ sơ; lưu CSV (nếu chọn) là kết quả không gắn khách
                hàng.
              </p>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => downloadBlob(emptyTemplate(spec), 'purchase_level_headers.csv')}
              >
                Tải header mẫu · không chứa dữ liệu
              </button>
              {canCsv ? (
                <label className="prediction-file-label">
                  Chọn file CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null);
                      setOutput(null);
                      setError(null);
                      setAttempt(null);
                    }}
                  />
                </label>
              ) : (
                <div className="prediction-role-note">
                  {workspaceMode === 'accounts' ? (
                    'Nhập CSV chỉ dành cho tài khoản có quyền vận hành. Bạn vẫn có thể phân tích bằng JSON.'
                  ) : (
                    <>
                      CSV cần kết nối secured với quyền operator, kể cả khi không lưu. Viewer/local
                      vẫn dùng được suy luận JSON.
                    </>
                  )}
                </div>
              )}
              {file && (
                <p className="prediction-file-name">
                  {file.name} · {(file.size / 1024).toFixed(1)} KiB
                </p>
              )}
            </div>
          )}
          {mode === 'single' && (
            <label className="prediction-explain-choice">
              <input
                type="checkbox"
                aria-label="Giải thích dự đoán"
                checked={explain}
                onChange={(e) => {
                  setExplain(e.target.checked);
                  setOutput(null);
                  setError(null);
                  setAttempt(null);
                }}
              />
              Giải thích dự đoán
            </label>
          )}
          {mode !== 'single' && (
            <p className="prediction-help">
              Giải thích dự đoán chỉ hỗ trợ một khách hàng; chưa hỗ trợ JSON batch/CSV.
            </p>
          )}
          <div className="prediction-save-choice">
            {(workspaceMode !== 'accounts' || canWrite) && (
              <label>
                <input
                  type="checkbox"
                  checked={save && canSave}
                  disabled={!canSave}
                  onChange={(e) => setSave(e.target.checked)}
                />
                Lưu kết quả vào lịch sử
              </label>
            )}
            <p>
              {!spec.model.persistence_supported
                ? 'Phiên bản này chỉ hỗ trợ phân tích, chưa hỗ trợ lưu kết quả.'
                : !canWrite
                  ? workspaceMode === 'accounts'
                    ? 'Tài khoản hiện tại chỉ được phân tích, không lưu kết quả.'
                    : 'Chỉ secured operator được chọn lưu. Mặc định không ghi dữ liệu.'
                  : 'Chỉ lưu khi bạn đánh dấu và bấm chạy. Không tự cập nhật dữ liệu hồ sơ/snapshot.'}
            </p>
          </div>
        </fieldset>
        <div className="prediction-run">
          <div>
            {busy ? (
              <button
                type="button"
                className="button button-secondary"
                onClick={() => pending.current?.abort()}
              >
                <X size={15} />
                Hủy chờ kết quả
              </button>
            ) : null}
            <button
              type="button"
              className="button button-primary"
              disabled={busy || (mode === 'csv' && !canCsv)}
              onClick={() => {
                void run();
              }}
            >
              <Play size={15} />
              {busy ? 'Đang xử lý…' : save && canSave ? 'Chạy dự đoán và lưu' : 'Chạy dự đoán'}
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>
      {busy && (
        <LoadingState
          label={
            explain && mode === 'single'
              ? 'Đang dự đoán và tính giải thích TreeSHAP…'
              : 'Đang chạy mô hình trên dữ liệu đã chọn…'
          }
        />
      )}
      {!!error && (
        <section className="panel prediction-error" aria-label="Lỗi dự đoán">
          {error instanceof InputError ? (
            <div role="alert">
              <h3>Kiểm tra dữ liệu đầu vào</h3>
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
              {error.issues.length > 30 && (
                <p>Chỉ hiển thị 30 lỗi đầu; cần sửa toàn bộ trước khi gửi.</p>
              )}
            </div>
          ) : (
            <>
              <ErrorState error={error} />
              {explain && error instanceof ApiError && error.code === 'EXPLANATION_UNAVAILABLE' && (
                <p role="status">
                  Mô hình hiện chưa cung cấp được giải thích tương thích. Bạn có thể tắt Giải thích
                  dự đoán và chủ động chạy lại; hệ thống không tự gửi lại yêu cầu.
                </p>
              )}
              {error instanceof ApiError && error.issues.length > 0 && (
                <ul>
                  {error.issues.slice(0, 30).map((issue, i) => (
                    <li key={i}>
                      {issue.row !== undefined
                        ? `${issue.source === 'csv' ? 'Dòng CSV (header = 1)' : 'Bản ghi JSON'} ${issue.row}`
                        : 'Dữ liệu single'}
                      {issue.field ? ` · ${issue.field}` : ''}: không hợp lệ theo backend.
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {attempt?.sent && (
            <p>
              0 kết quả được hiển thị / {attempt.count} bản ghi đã gửi. Batch/CSV không trả kết quả
              từng phần.
            </p>
          )}
          {!!uncertain && (
            <p className="prediction-uncertain" role="alert">
              Chưa xác định trạng thái ghi PostgreSQL. Hủy/timeout/lỗi mạng không đảm bảo hủy thao
              tác lưu ở server. Không tự gửi lại; kiểm tra lịch sử hoặc truy vết trước khi chủ động
              chạy lần nữa.
            </p>
          )}
        </section>
      )}
      {output && (
        <PredictionResults key={`${mode}:${output.results[0]?.generated_at}`} output={output} />
      )}
      {!output && !error && !busy && (
        <section className="panel">
          <EmptyState
            title="Sẵn sàng khi bạn có dữ liệu"
            description="Kết quả AI chỉ xuất hiện sau một yêu cầu thực tế. Chọn model, kiểm tra dữ liệu và chủ động bấm chạy; không có kết quả giả hoặc tự lưu."
          />
        </section>
      )}
    </>
  );
}
