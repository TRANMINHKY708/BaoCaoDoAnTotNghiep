import { TechnicalDetails } from '../../components/presentation';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { FlaskConical, Play, X } from 'lucide-react';
import { useWorkspace } from '../../app/context';
import { ApiError } from '../../api/errors';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { InputError, labels } from '../predictions/prediction';
import { SnapshotPicker } from '../predictions/SnapshotPicker';
import { contextKey, requestedContext } from '../customer-analysis/contextNavigation';
import { WhatIfResults } from './WhatIfResults';
import { WhatIfHistory } from './WhatIfHistory';
import {
  bodyLimit,
  canPersist,
  checkedComparison,
  checkedPreview,
  checkedSaved,
  checkedSchema,
  CONTRACT,
  DISCLAIMER,
  MUTABLE,
  parseChanges,
  selected,
  type Changes,
  type Comparison,
  type Models,
  type Mutable,
  type Preview,
  type Request,
  type SaveBody,
  type Saved,
  type Schema,
} from './whatIf';
import '../predictions/predictions.css';
import './what-if.css';

export default function WhatIfPage() {
  const { revision } = useWorkspace();
  return <WhatIfWorkspace key={revision} />;
}
function WhatIfWorkspace() {
  const { session, status, revision } = useWorkspace();
  const [params] = useSearchParams();
  const navigationKey = contextKey(params);
  const context = requestedContext(params);
  const [customerContext, setCustomerContext] = useState({ key: navigationKey, id: '' });
  const customerId = customerContext.key === navigationKey ? customerContext.id : '';
  const [models, setModels] = useState<Models>({ classification: '1.0.0', segmentation: null });
  const query = useQuery({
    queryKey: ['what-if-schema', revision],
    enabled: status === 'connected',
    queryFn: async ({ signal }) =>
      checkedSchema(
        (await session.client.request('get', '/api/v1/what-if/schema', { signal })).data,
      ),
  });
  return (
    <div className="predictions-workspace whatif-workspace">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MÔ PHỎNG HÀNH VI</span>
          <h1>Mô phỏng thay đổi hành vi</h1>
        </div>
        <span className="whatif-badge">
          <FlaskConical size={18} />
          Mô phỏng có kiểm soát
        </span>
      </div>
      <p className="whatif-disclaimer">{DISCLAIMER}</p>
      {status !== 'connected' ? (
        <section className="panel">
          <EmptyState
            title="Kết nối để mô phỏng"
            description="Chưa tải khách hàng, chạy mô hình hoặc lưu kịch bản khi chưa kết nối."
            connection
          />
        </section>
      ) : (
        <>
          {query.isPending ? (
            <LoadingState label="Đang tải công cụ mô phỏng…" />
          ) : query.isError ? (
            <ErrorState
              error={query.error}
              onRetry={() => {
                void query.refetch();
              }}
            />
          ) : (
            query.data && (
              <Workbench
                key={navigationKey}
                schema={query.data}
                initialId={context.customerId}
                initialSnapshotId={context.snapshotId}
                models={models}
                setModels={setModels}
                onCustomer={(id) => setCustomerContext({ key: navigationKey, id })}
              />
            )
          )}
          <WhatIfHistory customerId={customerId} />
        </>
      )}
    </div>
  );
}
type Plan = { key: string; body: SaveBody };
function Workbench({
  schema,
  initialId,
  initialSnapshotId,
  models,
  setModels,
  onCustomer,
}: {
  schema: Schema;
  initialId: string;
  initialSnapshotId: string;
  models: Models;
  setModels: (models: Models) => void;
  onCustomer: (id: string) => void;
}) {
  const workspace = useWorkspace();
  const { session, mode: workspaceMode, hasCapability } = workspace;
  const canWrite =
    workspaceMode === 'accounts' ? hasCapability('what_if.legacy.save') : workspace.canWrite;
  const queries = useQueryClient();
  const [source, setSource] = useState<Request['baseline'] | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [comparison, setComparison] = useState<Comparison | null>(null);
  const [narrativeReceipts, setNarrativeReceipts] = useState<{
    baseline?: { fingerprint: string; receipt?: string | null };
    comparison?: { fingerprint: string; receipt?: string | null };
  }>({});
  const [draft, setDraft] = useState<Partial<Record<Mutable, string>>>({}),
    [enabled, setEnabled] = useState<Set<Mutable>>(new Set()),
    [intent, setIntent] = useState<{ request: Request; changes: Changes } | null>(null);
  const [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(''),
    [name, setName] = useState(''),
    [description, setDescription] = useState(''),
    [ack, setAck] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null),
    [uncertain, setUncertain] = useState(false),
    [saved, setSaved] = useState<Saved | null>(null);
  const controller = useRef<AbortController | null>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  const pinned = selected(schema, models),
    locked = !!busy || !!plan,
    available = pinned.every((m) => m.available),
    eligible = canWrite && canPersist(schema, models);
  const invalidate = () => {
    setPreview(null);
    setComparison(null);
    setIntent(null);
    setDraft({});
    setEnabled(new Set());
    setError(null);
    setSaved(null);
    setAck(false);
  };
  async function perform(action: string, work: (signal: AbortSignal) => Promise<void>) {
    if (controller.current) return;
    const current = new AbortController();
    controller.current = current;
    setBusy(action);
    setError(null);
    try {
      await work(current.signal);
    } catch (cause) {
      if (alive.current) {
        setError(cause);
        if (action === 'save')
          setUncertain(
            !(
              cause instanceof ApiError &&
              cause.kind === 'http' &&
              cause.status >= 400 &&
              cause.status < 500
            ),
          );
      }
    } finally {
      controller.current = null;
      if (alive.current) setBusy('');
    }
  }
  const request = (): Request => {
    if (!source || source.kind !== 'customer' || !source.snapshot_id)
      throw new InputError([
        { message: 'Chọn khách hàng và một bản ghi hành vi trước khi phân tích ban đầu.' },
      ]);
    return bodyLimit({
      contract_version: CONTRACT,
      models: { ...models },
      baseline: { ...source },
    });
  };
  const runPreview = () => {
    void perform('preview', async (signal) => {
      const body = request();
      setComparison(null);
      setIntent(null);
      setPreview(null);
      const response = await session.client.request('post', '/api/v1/what-if/preview', {
        body,
        signal,
        timeoutMs: 60000,
      });
      const value = checkedPreview(response.data, schema, body);
      if (!signal.aborted && alive.current) {
        setPreview(value);
        setNarrativeReceipts({
          baseline: {
            fingerprint: value.baseline_fingerprint,
            receipt: response.meta.analysisReceipt,
          },
        });
        setEnabled(new Set());
        setDraft(
          Object.fromEntries(
            MUTABLE.map((n) => [
              n,
              value.baseline_input[n] === null ? '' : String(value.baseline_input[n]),
            ]),
          ),
        );
      }
    });
  };
  const runCompare = () => {
    void perform('compare', async (signal) => {
      if (!preview) throw new InputError([{ message: 'Phân tích ban đầu trước khi so sánh.' }]);
      const body = request(),
        changes = parseChanges(draft, enabled, pinned[0]!);
      setComparison(null);
      setIntent(null);
      const response = await session.client.request('post', '/api/v1/what-if', {
        body: bodyLimit({
          ...body,
          changes,
          expected_baseline_fingerprint: preview.baseline_fingerprint,
        }),
        signal,
        timeoutMs: 60000,
      });
      const value = checkedComparison(response.data, schema, body, preview, changes);
      if (!signal.aborted && alive.current) {
        setComparison(value);
        setNarrativeReceipts((current) => ({
          ...current,
          comparison: {
            fingerprint: value.comparison_fingerprint,
            receipt: response.meta.analysisReceipt,
          },
        }));
        setIntent({ request: body, changes });
      }
    });
  };
  const sendPlan = (frozen: Plan) => {
    void perform('save', async (signal) => {
      const response = await session.client.request('post', '/api/v1/what-if/scenarios', {
        body: frozen.body,
        headers: { 'Idempotency-Key': frozen.key },
        signal,
        timeoutMs: 60000,
      });
      const value = checkedSaved(response.data, comparison!);
      if (value.name !== frozen.body.name || value.description !== frozen.body.description)
        throw new ApiError('protocol');
      if (!signal.aborted && alive.current) {
        setSaved(value);
        setUncertain(false);
        void queries.invalidateQueries({ queryKey: ['what-if-history'] });
      }
    });
  };
  const save = () => {
    if (controller.current || !comparison || !intent || !eligible || plan) return;
    try {
      if (!name.trim() || [...name].length > 200 || [...description].length > 1000 || !ack)
        throw new InputError([
          {
            message:
              'Nhập tên 1–200 ký tự, mô tả tối đa 1.000 ký tự và xác nhận lưu dữ liệu hành vi.',
          },
        ]);
      const frozen: Plan = {
        key: crypto.randomUUID(),
        body: bodyLimit({
          ...intent.request,
          changes: intent.changes,
          expected_baseline_fingerprint: comparison.baseline.baseline_fingerprint,
          expected_comparison_fingerprint: comparison.comparison_fingerprint,
          name,
          description: description || null,
          acknowledge_sensitive_snapshot_storage: true,
        }),
      };
      setPlan(frozen);
      sendPlan(frozen);
    } catch (cause) {
      setError(cause);
    }
  };
  const reset = () => {
    setPlan(null);
    setUncertain(false);
    setComparison(null);
    setIntent(null);
    setSaved(null);
    setError(null);
    setEnabled(new Set());
    setAck(false);
    if (preview)
      setDraft(
        Object.fromEntries(
          MUTABLE.map((n) => [
            n,
            preview.baseline_input[n] === null ? '' : String(preview.baseline_input[n]),
          ]),
        ),
      );
  };
  return (
    <>
      <section className="panel whatif-controls" aria-label="Thiết lập mô phỏng">
        <span className="eyebrow">01 / CHỌN NGUỒN & MÔ HÌNH</span>
        <h2>Dữ liệu ban đầu của khách hàng</h2>
        <fieldset className="prediction-fieldset" disabled={locked}>
          <div className="whatif-models">
            <label>
              Mô hình mức độ mua hàng
              <select
                value={models.classification}
                onChange={(e) => {
                  setModels({
                    ...models,
                    classification: e.target.value as Models['classification'],
                  });
                  invalidate();
                }}
              >
                {schema.models
                  .filter((m) => m.task === 'classification')
                  .map((m) => (
                    <option key={m.model_version} value={m.model_version}>
                      {m.model_version === '1.0.0'
                        ? 'Mức mua · bản đầy đủ'
                        : 'Mức mua · bản chọn lọc'}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Kèm phân nhóm tương tác
              <select
                value={models.segmentation ?? ''}
                onChange={(e) => {
                  setModels({
                    ...models,
                    segmentation: (e.target.value || null) as Models['segmentation'],
                  });
                  invalidate();
                }}
              >
                <option value="">Không kèm K-Means</option>
                {schema.models
                  .filter((m) => m.task === 'segmentation')
                  .map((m) => (
                    <option key={m.model_version} value={m.model_version}>
                      {m.model_version === '1.0.0'
                        ? 'Phân nhóm · bản ban đầu'
                        : 'Phân nhóm tương tác · bản chọn lọc'}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <TechnicalDetails>
            <p>Phiên bản phân loại: {models.classification}</p>
            <p>Phiên bản phân nhóm: {models.segmentation ?? 'Không sử dụng'}</p>
            {pinned.map((m) => (
              <p key={m.task}>
                {m.task}: {m.features.map((f) => f.name).join(', ')}
              </p>
            ))}
          </TechnicalDetails>
          <SnapshotPicker
            initialId={initialId}
            initialSnapshotId={initialSnapshotId}
            onCustomerChange={() => {
              setSource(null);
              onCustomer('');
              invalidate();
            }}
            onPick={(snapshot) => {
              setSource({
                kind: 'customer',
                customer_id: snapshot.customer_id,
                snapshot_id: snapshot.id,
              });
              onCustomer(snapshot.customer_id);
              invalidate();
            }}
          />
          {source?.kind === 'customer' && (
            <div className="whatif-source">
              <p>Đã chọn bản ghi hành vi. Dữ liệu gốc được giữ nguyên.</p>
              <TechnicalDetails>
                <code>{source.snapshot_id}</code>
              </TechnicalDetails>
            </div>
          )}
          {!available && (
            <p role="alert">
              Phiên bản đã chọn chưa sẵn sàng. Không tự chuyển sang phiên bản khác.
            </p>
          )}
          <button
            className="button button-primary"
            disabled={!source || !available}
            onClick={runPreview}
          >
            <Play size={16} />
            Phân tích ban đầu
          </button>
        </fieldset>
      </section>
      {preview && (
        <section className="panel whatif-controls" aria-label="Điều chỉnh sáu biến">
          <span className="eyebrow">02 / KỊCH BẢN GIẢ ĐỊNH</span>
          <h2>Chọn biến muốn thay đổi</h2>
          <p className="prediction-help">
            Bỏ chọn sẽ giữ giá trị baseline, kể cả null. Chỉ điều chỉnh sáu chỉ số tương tác; không
            thay đổi nhãn mức mua, tổng lượt mua, giá trị vòng đời, trạng thái rời bỏ hoặc chỉ số
            hậu nghiệm.
          </p>
          <fieldset className="prediction-fieldset" disabled={locked}>
            <div className="whatif-mutable-grid">
              {MUTABLE.map((n) => {
                const f = pinned[0]!.features.find((d) => d.name === n)!;
                return (
                  <div className="whatif-mutable" key={n}>
                    <label>
                      <input
                        type="checkbox"
                        checked={enabled.has(n)}
                        aria-label={`Thay đổi ${n}`}
                        onChange={(e) => {
                          const next = new Set(enabled);
                          if (e.target.checked) next.add(n);
                          else next.delete(n);
                          setEnabled(next);
                          setComparison(null);
                          setIntent(null);
                          setError(null);
                        }}
                      />
                      {labels[n]}
                    </label>
                    <small>
                      Ban đầu:{' '}
                      {preview.baseline_input[n] === null
                        ? 'null (thiếu)'
                        : String(preview.baseline_input[n])}
                    </small>
                    <label className="sr-only" htmlFor={`whatif-${n}`}>
                      Giá trị kịch bản {n}
                    </label>
                    <input
                      id={`whatif-${n}`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      disabled={!enabled.has(n)}
                      value={draft[n] ?? ''}
                      onChange={(e) => {
                        setDraft({ ...draft, [n]: e.target.value });
                        setComparison(null);
                        setIntent(null);
                        setError(null);
                      }}
                    />
                    <small>
                      ≥ {f.minimum ?? 0}
                      {f.maximum !== null ? ` · ≤ ${f.maximum}` : ''}
                      {f.unit === 'percent_0_100'
                        ? ' · thang 0–100'
                        : ' · đơn vị gốc chưa xác minh đầy đủ'}
                    </small>
                  </div>
                );
              })}
            </div>
            <div className="whatif-actions">
              <button className="button button-primary" onClick={runCompare}>
                <FlaskConical size={16} />
                So sánh kịch bản
              </button>
              <button className="button button-secondary" onClick={reset}>
                Đặt lại thay đổi
              </button>
            </div>
          </fieldset>
        </section>
      )}
      {!!busy && (
        <div className="panel">
          <LoadingState
            label={
              busy === 'save'
                ? 'Đang lưu kịch bản…'
                : busy === 'compare'
                  ? 'Đang so sánh kịch bản…'
                  : 'Đang tạo baseline…'
            }
          />
          <button className="button button-secondary" onClick={() => controller.current?.abort()}>
            <X size={15} />
            Hủy chờ kết quả
          </button>
        </div>
      )}
      {!!error && (
        <section className="panel whatif-error">
          {error instanceof InputError ? (
            <div role="alert">
              <h3>Kiểm tra dữ liệu mô phỏng</h3>
              {error.issues.map((i, n) => (
                <p key={n}>
                  {i.field ? `${labels[i.field] ?? i.field}: ` : ''}
                  {i.message}
                </p>
              ))}
            </div>
          ) : (
            <ErrorState error={error} />
          )}
          {error instanceof ApiError &&
            ['BASELINE_CHANGED', 'COMPARISON_CHANGED', 'MODEL_IDENTITY_CHANGED'].includes(
              error.code,
            ) && (
              <p>
                Baseline hoặc mô hình đã thay đổi. Hãy xem lại baseline rồi so sánh lại; không tự
                ghi đè.
              </p>
            )}
        </section>
      )}
      {uncertain && (
        <div className="whatif-disclaimer" role="alert">
          Chưa xác định trạng thái lưu. Không tự gửi lại hoặc tạo mã yêu cầu mới. Xem lịch sử bên
          dưới; chỉ chủ động gửi lại nguyên yêu cầu với cùng mã nếu cần. Hủy chờ không đảm bảo hủy
          ghi ở server.
        </div>
      )}
      {preview && (
        <WhatIfResults
          preview={comparison?.baseline ?? preview}
          comparison={comparison ?? undefined}
          copiedToHistory={!!saved}
          narrativeReceipt={
            comparison
              ? narrativeReceipts.comparison?.fingerprint === comparison.comparison_fingerprint
                ? narrativeReceipts.comparison.receipt
                : undefined
              : narrativeReceipts.baseline?.fingerprint === preview.baseline_fingerprint
                ? narrativeReceipts.baseline.receipt
                : undefined
          }
        />
      )}
      {!preview && !busy && !error && (
        <section className="panel">
          <EmptyState
            title="Chưa có baseline mô phỏng"
            description="Chọn khách hàng và bản ghi hành vi, sau đó bấm Phân tích ban đầu."
          />
        </section>
      )}
      {comparison && (workspaceMode !== 'accounts' || canWrite) && (
        <section className="panel whatif-save" aria-label="Lưu kịch bản">
          <span className="eyebrow">03 / LƯU KẾT QUẢ</span>
          <h2>Lưu kịch bản vào lịch sử</h2>
          <p className="prediction-help">
            {eligible
              ? 'Chỉ lưu sau thao tác chủ động. Không tạo bản ghi hành vi mới hoặc sửa hồ sơ gốc.'
              : !canWrite
                ? 'Chỉ người có quyền vận hành trong kết nối bảo mật được lưu. Bạn vẫn có thể phân tích và xem lịch sử.'
                : 'Có phiên bản chưa hỗ trợ lưu trong lựa chọn. Kết quả này chỉ dùng để phân tích, chưa thể lưu.'}
          </p>
          <fieldset className="prediction-fieldset" disabled={!eligible || locked || !!saved}>
            <label>
              Tên kịch bản
              <input
                value={name}
                maxLength={200}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label>
              Mô tả (tùy chọn)
              <textarea
                value={description}
                maxLength={1000}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="whatif-ack">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              Tôi đồng ý lưu bản sao bản ghi hành vi và kết quả mô phỏng vào không gian làm việc
              chung.
            </label>
            <button
              className="button button-primary"
              onClick={save}
              disabled={!ack || !name.trim()}
            >
              Lưu kịch bản
            </button>
          </fieldset>
          {plan && (
            <div>
              <p className="prediction-help">
                Yêu cầu lưu được giữ nguyên trong bộ nhớ thẻ này; tải lại/đóng thẻ sẽ mất mã, cần
                kiểm tra lịch sử trước khi gửi mới.
              </p>
              <TechnicalDetails>
                <code>{plan.key}</code>
              </TechnicalDetails>
            </div>
          )}
          {uncertain && plan && (
            <button
              className="button button-secondary"
              disabled={!!busy}
              onClick={() => sendPlan(plan)}
            >
              Gửi lại nguyên yêu cầu cùng mã
            </button>
          )}
          {saved && (
            <div>
              <p role="status">
                Kịch bản đã lưu
                {saved.idempotency_replayed ? ' (trả lại bản đã có, không tạo trùng)' : ''}:{' '}
                {saved.name}
              </p>
              <TechnicalDetails>
                <code>{saved.scenario_id}</code>
              </TechnicalDetails>
            </div>
          )}
          {plan && !uncertain && !busy && (
            <button className="button button-secondary" onClick={reset}>
              Chuẩn bị kịch bản mới
            </button>
          )}
        </section>
      )}
    </>
  );
}
