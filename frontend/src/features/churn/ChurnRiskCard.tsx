import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../../app/context';
import { ApiError } from '../../api/errors';
import { ErrorState, LoadingState } from '../../components/states';
import type { Snapshot } from '../customers/customers';
import { fixed, num, pct } from '../insights/insights';
import { labels } from '../predictions/prediction';
import { riskColor, riskLabel } from './churn';
import { checkedPrediction, churnInput, recordedChurn, retentionAdvice } from './churnApi';
import './churn.css';

const TOP_FACTORS = 3;
const featureName = (feature: string) => labels[feature] ?? feature;
const display = (value: string | number | null) =>
  value === null ? 'thiếu' : typeof value === 'number' ? num(value, 1) : value;

/**
 * Churn risk of one stored snapshot (K5 API, inference only, nothing saved). A snapshot that
 * already records Churned = true is shown as observed churn instead of a prediction.
 */
export function ChurnRiskCard({
  snapshot,
  capturedAt,
}: {
  snapshot: Snapshot;
  capturedAt: string;
}) {
  const { session, revision, status } = useWorkspace();
  const observed = recordedChurn(snapshot);
  const { customer, missing } = churnInput(snapshot);
  const query = useQuery({
    queryKey: ['churn-risk', revision, snapshot.id],
    enabled: status === 'connected' && !observed && missing.length < 21,
    retry: false,
    queryFn: async ({ signal }) =>
      checkedPrediction(await session.client.churnPredict(customer, true, signal)),
  });
  const unavailable = query.error instanceof ApiError && query.error.status === 503;
  return (
    <section className="panel churn-card" aria-label="Nguy cơ rời bỏ">
      <div className="panel-heading">
        <h2>Nguy cơ rời bỏ</h2>
        <span className="subtle-tag">Snapshot {capturedAt}</span>
      </div>
      {observed ? (
        <p className="churn-observed" role="status">
          Snapshot này đã ghi nhận khách <strong>đã rời bỏ</strong>. Hệ thống hiển thị trạng thái
          thực tế thay cho dự báo.
        </p>
      ) : missing.length === 21 ? (
        <p role="status">Snapshot chưa có thuộc tính nào để dự báo; hệ thống không tự điền.</p>
      ) : query.isPending ? (
        <LoadingState label="Đang tính nguy cơ rời bỏ…" />
      ) : query.isError ? (
        unavailable ? (
          <p role="alert">
            Mô hình rời bỏ chưa sẵn sàng trên máy chủ. Các chức năng khác vẫn dùng bình thường.
          </p>
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        )
      ) : (
        <ChurnResult prediction={query.data} missing={missing} />
      )}
    </section>
  );
}

function ChurnResult({
  prediction,
  missing,
}: {
  prediction: ReturnType<typeof checkedPrediction>;
  missing: string[];
}) {
  const factors = prediction.explanation?.factors ?? [];
  const top = factors.slice(0, TOP_FACTORS);
  const actions = factors
    .filter((f) => f.direction === 'increases_risk' && retentionAdvice[f.feature])
    .slice(0, 2);
  const level = prediction.risk_level;
  return (
    <>
      <div className="churn-headline">
        <div
          className="churn-gauge"
          role="img"
          aria-label={`Xác suất rời bỏ ${pct(100 * prediction.churn_probability, 1)}`}
        >
          <strong>{pct(100 * prediction.churn_probability, 1)}</strong>
          <span>xác suất rời bỏ</span>
        </div>
        <div>
          <span
            className="churn-badge"
            style={{ borderColor: riskColor[level], color: riskColor[level] }}
          >
            Mức rủi ro {riskLabel[level]}
          </span>
          <p>
            {prediction.predicted_churn
              ? `Vượt ngưỡng cảnh báo ${fixed(prediction.decision_threshold, 2)}: nên đưa vào danh sách chăm sóc.`
              : `Dưới ngưỡng cảnh báo ${fixed(prediction.decision_threshold, 2)}.`}{' '}
            Mức Thấp dưới {fixed(prediction.risk_thresholds.low_below, 2)}, Cao từ{' '}
            {fixed(prediction.risk_thresholds.high_from, 2)}.
          </p>
        </div>
      </div>
      {top.length > 0 && (
        <>
          <h3 className="insight-h3">Ba yếu tố ảnh hưởng mạnh nhất</h3>
          <ul className="churn-factors">
            {top.map((f) => (
              <li key={f.feature} className={f.direction === 'increases_risk' ? 'up' : 'down'}>
                <span aria-hidden="true">{f.direction === 'increases_risk' ? '▲' : '▼'}</span>
                <strong>{featureName(f.feature)}</strong> = {display(f.value)}
                <small>
                  {f.direction === 'increases_risk' ? 'làm tăng nguy cơ' : 'làm giảm nguy cơ'}
                </small>
              </li>
            ))}
          </ul>
        </>
      )}
      {actions.length > 0 && (
        <>
          <h3 className="insight-h3">Gợi ý giữ chân</h3>
          <ul className="churn-actions">
            {actions.map((f) => (
              <li key={f.feature}>
                <strong>{featureName(f.feature)}:</strong> {retentionAdvice[f.feature]}
              </li>
            ))}
          </ul>
        </>
      )}
      <small>
        {missing.length > 0 &&
          `Thiếu ${missing.length} thuộc tính (${missing.map(featureName).join(', ')}); mô hình tự điền theo dữ liệu huấn luyện. `}
        Dự báo trạng thái của snapshot, không phải thời điểm khách rời đi; yếu tố là liên hệ thống
        kê, không phải nguyên nhân. Không lưu kết quả. Xem cơ sở tại{' '}
        <Link to="/churn-report">Dự báo nguy cơ rời bỏ</Link>.
      </small>
    </>
  );
}
