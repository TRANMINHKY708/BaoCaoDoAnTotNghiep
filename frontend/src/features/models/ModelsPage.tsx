import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Boxes, Copy, RefreshCw } from 'lucide-react';
import { useWorkspace } from '../../app/context';
import type { components } from '../../api/generated';
import { modelName } from '../../components/presentationLabels';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { dateTime } from '../customers/customers';
import { labels as featureLabels } from '../predictions/prediction';
import { checkedModelInfo, type ChurnModelInfo } from '../churn/churnApi';
import {
  checkedUsage,
  evaluationFor,
  featureDiff,
  taskLabel,
  usageFor,
  type Evaluation,
  type ModelUsage,
} from './models';
import './models.css';

type CatalogModel = components['schemas']['ModelInfo'];
const name = (feature: string) => featureLabels[feature] ?? feature;
const num = (v: number) => v.toLocaleString('vi-VN');

function Hash({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="model-hash">
      <code title={value}>{value.slice(0, 12)}…</code>
      <button
        type="button"
        className="icon-button"
        aria-label="Sao chép mã băm"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => setCopied(true));
        }}
      >
        <Copy size={14} />
      </button>
      {copied && <small role="status">Đã sao chép</small>}
    </span>
  );
}

function UsageBlock({
  usage,
  persistence,
  artifact,
}: {
  usage?: ModelUsage;
  persistence: boolean;
  artifact?: string;
}) {
  if (!persistence)
    return <p className="muted">Chỉ suy luận, không lưu kết quả nên không có số liệu sử dụng.</p>;
  if (!usage) return <p className="muted">Chưa có lượt chạy nào được lưu.</p>;
  const mismatch = artifact && usage.artifact_sha256 && usage.artifact_sha256 !== artifact;
  return (
    <>
      <dl className="model-usage">
        <div>
          <dt>Lượt chạy đã lưu</dt>
          <dd>{num(usage.runs_completed)}</dd>
        </div>
        <div>
          <dt>Kết quả đã lưu</dt>
          <dd>{num(usage.results_saved)}</dd>
        </div>
        <div>
          <dt>Khách hàng</dt>
          <dd>{num(usage.customers)}</dd>
        </div>
        <div>
          <dt>Dùng gần nhất</dt>
          <dd>{usage.last_used_at ? dateTime(usage.last_used_at) : '—'}</dd>
        </div>
      </dl>
      <small className="muted">
        Đơn lẻ {num(usage.runs_by_type.single)} · hàng loạt {num(usage.runs_by_type.batch)} · CSV{' '}
        {num(usage.runs_by_type.csv)} · kịch bản {num(usage.runs_by_type.scenario)}
      </small>
      {mismatch && (
        <p role="alert" className="model-warning">
          Mã băm trong cơ sở dữ liệu khác tệp mô hình đang nạp; hệ thống từ chối lưu kết quả cho tới
          khi đối chiếu.
        </p>
      )}
    </>
  );
}

function EvaluationBlock({ evaluation }: { evaluation: Evaluation }) {
  return (
    <div className={`model-eval ${evaluation.clean ? 'clean' : 'legacy'}`}>
      <strong>
        {evaluation.clean ? 'Đánh giá theo quy trình khóa trước' : 'Chưa đánh giá sạch'}
      </strong>
      {evaluation.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <Link className="text-link" to={evaluation.link.to}>
        {evaluation.link.label}
      </Link>
    </div>
  );
}

function CatalogCard({ model, usage }: { model: CatalogModel; usage?: ModelUsage }) {
  const labels = Object.values(model.labels ?? {}).map(String);
  return (
    <article
      className="catalog-card model-card"
      aria-label={modelName(model.task, model.model_version)}
    >
      <div className="model-card-head">
        <span className={`model-status ${model.available ? 'available' : ''}`}>
          {model.available ? 'Khả dụng' : 'Chưa khả dụng'}
        </span>
        <span className={`model-role ${model.is_default ? 'default' : 'research'}`}>
          {model.is_default ? 'Mặc định · có lưu kết quả' : 'Nghiên cứu · chỉ suy luận'}
        </span>
      </div>
      <span className="eyebrow">{taskLabel[model.task] ?? model.task}</span>
      <h3>{modelName(model.task, model.model_version)}</h3>
      <dl className="model-facts">
        <div>
          <dt>Phiên bản</dt>
          <dd>{model.model_version}</dd>
        </div>
        <div>
          <dt>Thuộc tính đầu vào</dt>
          <dd>{model.feature_count}</dd>
        </div>
        <div>
          <dt>Mã băm tệp mô hình</dt>
          <dd>
            <Hash value={model.artifact_sha256} />
          </dd>
        </div>
      </dl>
      <EvaluationBlock evaluation={evaluationFor(model.task, model.model_version)} />
      <h4>Sử dụng</h4>
      <UsageBlock
        usage={usage}
        persistence={model.persistence_supported}
        artifact={model.artifact_sha256}
      />
      <details className="model-more">
        <summary>Thuộc tính, nhãn đầu ra và giới hạn</summary>
        <p>
          <strong>Thuộc tính:</strong> {model.features.map(name).join(', ')}
        </p>
        {labels.length > 0 && (
          <p>
            <strong>Nhãn đầu ra:</strong> {labels.join(', ')}
          </p>
        )}
        <ul>
          {model.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
    </article>
  );
}

function ChurnCard({ info, error }: { info?: ChurnModelInfo; error: boolean }) {
  return (
    <article className="catalog-card model-card" aria-label="Dự báo rời bỏ · XGBoost">
      <div className="model-card-head">
        <span className={`model-status ${info?.available ? 'available' : ''}`}>
          {info?.available ? 'Khả dụng' : 'Chưa khả dụng'}
        </span>
        <span className="model-role research">Dịch vụ riêng · chỉ suy luận</span>
      </div>
      <span className="eyebrow">{taskLabel.churn}</span>
      <h3>Dự báo rời bỏ · XGBoost</h3>
      {error || !info ? (
        <p className="muted">
          Không đọc được thông tin mô hình rời bỏ; các mô hình khác không bị ảnh hưởng.
        </p>
      ) : (
        <>
          <dl className="model-facts">
            <div>
              <dt>Phiên bản</dt>
              <dd>{info.model_version}</dd>
            </div>
            <div>
              <dt>Thuộc tính đầu vào</dt>
              <dd>{info.feature_count}</dd>
            </div>
            <div>
              <dt>Mã băm tệp mô hình</dt>
              <dd>
                <Hash value={info.artifact_sha256} />
              </dd>
            </div>
          </dl>
          <EvaluationBlock
            evaluation={{
              clean: true,
              lines: [
                `ROC-AUC ${info.holdout.roc_auc.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} · F1 ${info.holdout.f1.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} trên ${num(info.holdout.rows)} bản ghi kiểm tra, chấm một lần`,
                `Ngưỡng cảnh báo ${info.decision_threshold.toLocaleString('vi-VN')} · mức Thấp dưới ${info.risk_thresholds.low_below.toLocaleString('vi-VN')}, Cao từ ${info.risk_thresholds.high_from.toLocaleString('vi-VN')}`,
              ],
              link: { to: '/churn-report', label: 'Xem đánh giá mô hình rời bỏ' },
            }}
          />
          <h4>Sử dụng</h4>
          <UsageBlock persistence={false} />
          <details className="model-more">
            <summary>Thuộc tính, nhãn đầu ra và giới hạn</summary>
            <p>
              <strong>Thuộc tính:</strong> {info.features.map(name).join(', ')}
            </p>
            <p>
              <strong>Không dùng:</strong> {info.excluded_features.map(name).join(', ')}
            </p>
            <p>
              <strong>Nhãn đầu ra:</strong> xác suất rời bỏ, mức rủi ro Thấp / Trung bình / Cao
            </p>
            <ul>
              {info.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        </>
      )}
    </article>
  );
}

function Comparison({ models }: { models: CatalogModel[] }) {
  const tasks = ['classification', 'segmentation'].filter(
    (task) => models.filter((m) => m.task === task).length === 2,
  );
  if (!tasks.length) return null;
  return (
    <section className="panel" aria-labelledby="model-compare">
      <div className="panel-heading">
        <h2 id="model-compare">So sánh hai phiên bản cùng tác vụ</h2>
      </div>
      <div className="account-table-wrap" role="region" aria-label="So sánh phiên bản" tabIndex={0}>
        <table className="account-table model-compare">
          <thead>
            <tr>
              <th>Tác vụ</th>
              <th>Phiên bản mặc định</th>
              <th>Phiên bản nghiên cứu</th>
              <th>Chỉ có ở bản mặc định</th>
              <th>Chỉ có ở bản nghiên cứu</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const [base, research] = [
                models.find((m) => m.task === task && m.is_default)!,
                models.find((m) => m.task === task && !m.is_default)!,
              ];
              const diff = featureDiff(base.features, research.features);
              return (
                <tr key={task}>
                  <th scope="row">{taskLabel[task]}</th>
                  <td>
                    {base.model_version}
                    <small>{base.feature_count} thuộc tính · có lưu kết quả</small>
                  </td>
                  <td>
                    {research.model_version}
                    <small>{research.feature_count} thuộc tính · chỉ suy luận</small>
                  </td>
                  {diff.onlyA.length || diff.onlyB.length ? (
                    <>
                      <td>{diff.onlyA.length ? diff.onlyA.map(name).join(', ') : '—'}</td>
                      <td>{diff.onlyB.length ? diff.onlyB.map(name).join(', ') : '—'}</td>
                    </>
                  ) : (
                    <td colSpan={2}>
                      Cùng {diff.shared.length} thuộc tính; khác ở cách huấn luyện và quy trình đánh
                      giá
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ModelsPage() {
  const { session, status, revision } = useWorkspace();
  const connected = status === 'connected';
  const catalog = useQuery({
    queryKey: ['model-catalog', revision],
    enabled: connected,
    queryFn: async ({ signal }) =>
      (await session.client.request('get', '/api/v1/model-info', { signal })).data,
  });
  const usage = useQuery({
    queryKey: ['model-usage', revision],
    enabled: connected,
    retry: false,
    queryFn: async ({ signal }) => checkedUsage(await session.client.modelUsage(signal)),
  });
  const churn = useQuery({
    queryKey: ['churn-model', revision],
    enabled: connected,
    retry: false,
    queryFn: async ({ signal }) => checkedModelInfo(await session.client.churnModel(signal)),
  });
  return (
    <div className="models-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">WORKSPACE</span>
          <h1>Quản lý mô hình</h1>
          <p>
            Các mô hình hệ thống đang nạp, phiên bản, độ tin cậy và mức sử dụng. Trang chỉ đọc: tải
            mô hình lên, huấn luyện lại hay đổi phiên bản mặc định không làm qua giao diện, vì mỗi
            tệp mô hình đã được khóa bằng mã băm để kết quả tái lập được.
          </p>
        </div>
        <button
          type="button"
          className="button button-small button-secondary"
          disabled={!connected || catalog.isFetching}
          onClick={() => {
            void catalog.refetch();
            void usage.refetch();
            void churn.refetch();
          }}
        >
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>
      {!connected ? (
        <EmptyState
          title="Kết nối để xem mô hình"
          description="Đăng nhập hoặc kết nối không gian làm việc để xem danh mục mô hình."
          connection
        />
      ) : catalog.isPending ? (
        <LoadingState label="Đang tải danh mục mô hình…" />
      ) : catalog.isError ? (
        <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />
      ) : (
        <>
          {usage.isError && (
            <p role="alert" className="model-warning">
              Chưa đọc được số liệu sử dụng từ cơ sở dữ liệu; thông tin mô hình vẫn hiển thị đầy đủ.
            </p>
          )}
          <section className="model-grid" aria-label="Danh sách mô hình">
            {catalog.data.models.map((model) => (
              <CatalogCard
                key={`${model.task}:${model.model_version}`}
                model={model}
                usage={usageFor(usage.data?.models, model.model_id, model.model_version)}
              />
            ))}
            <ChurnCard info={churn.data} error={churn.isError} />
          </section>
          <Comparison models={catalog.data.models} />
          <div className="research-callout">
            <strong>
              <Boxes size={15} /> Quản lý phiên bản
            </strong>
            <p>
              Mỗi mô hình được ghim bằng mã băm SHA-256 của tệp và metadata; backend kiểm tra mã băm
              khi khởi động. Phiên bản mặc định lưu kết quả vào cơ sở dữ liệu kèm mã phiên bản; các
              phiên bản nghiên cứu và mô hình rời bỏ chỉ trả kết quả, không ghi gì.
              {usage.data && ` Số liệu sử dụng cập nhật lúc ${dateTime(usage.data.generated_at)}.`}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
