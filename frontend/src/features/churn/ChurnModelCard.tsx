import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../../app/context';
import { fixed, num, pct } from '../insights/insights';
import { checkedModelInfo } from './churnApi';

/** Churn model card for "Hệ thống & mô hình" (GET /api/v1/churn/model, separate from the catalog). */
export function ChurnModelCard() {
  const { session, status, revision } = useWorkspace();
  const query = useQuery({
    queryKey: ['churn-model', revision],
    enabled: status === 'connected',
    retry: false,
    queryFn: async ({ signal }) => checkedModelInfo(await session.client.churnModel(signal)),
  });
  const info = query.data;
  return (
    <article className="catalog-card" aria-label="Mô hình dự báo rời bỏ">
      <span className={`model-status ${info?.available ? 'available' : ''}`}>
        {info?.available ? 'Khả dụng' : query.isPending ? 'Đang kiểm tra' : 'Chưa khả dụng'}
      </span>
      <span className="eyebrow">DỰ BÁO RỜI BỎ</span>
      <h3>XGBoost rời bỏ {info ? `· ${info.model_version}` : ''}</h3>
      {query.isError ? (
        <p>Không đọc được thông tin mô hình rời bỏ. Các mô hình khác không bị ảnh hưởng.</p>
      ) : info ? (
        <dl>
          <div>
            <dt>Thuộc tính đầu vào</dt>
            <dd>
              {info.feature_count} (loại{' '}
              {info.excluded_features.filter((f) => f !== 'Purchase_Level').join(', ')})
            </dd>
          </div>
          <div>
            <dt>Tập kiểm tra</dt>
            <dd>
              ROC-AUC {fixed(info.holdout.roc_auc, 3)} · F1 {fixed(info.holdout.f1, 3)} ·{' '}
              {num(info.holdout.rows, 0)} khách
            </dd>
          </div>
          <div>
            <dt>Ngưỡng</dt>
            <dd>
              Cảnh báo {fixed(info.decision_threshold, 2)} · Thấp &lt;{' '}
              {fixed(info.risk_thresholds.low_below, 2)} · Cao ≥{' '}
              {fixed(info.risk_thresholds.high_from, 2)}
            </dd>
          </div>
          <div>
            <dt>Lưu kết quả</dt>
            <dd>Chỉ dự báo, không lưu · tối đa {info.max_batch_size} khách mỗi lô</dd>
          </div>
          <div>
            <dt>Sai số hiệu chỉnh</dt>
            <dd>{pct(100 * info.holdout.ece, 1)}</dd>
          </div>
        </dl>
      ) : null}
      <Link className="text-link" to="/churn-report">
        Xem đánh giá mô hình
      </Link>
    </article>
  );
}
