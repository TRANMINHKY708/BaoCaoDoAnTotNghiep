import { Link } from 'react-router-dom';
import { labels } from '../predictions/prediction';
import { advice, behaviourGaps, num, units } from './insights';
import './insights.css';

const MAX_ITEMS = 3;

/**
 * Rule-based next actions for one behaviour snapshot: compares the six engagement behaviours
 * with the research thresholds (T4 SHAP for the High class turns positive). No inference,
 * no API call, missing values are reported rather than imputed.
 */
export function BehaviourAdvice({
  values,
  capturedAt,
}: {
  values: Partial<Record<string, number | null | undefined>>;
  capturedAt?: string;
}) {
  const { below, above, missing } = behaviourGaps(values);
  const name = (feature: string) => labels[feature] ?? feature;
  return (
    <section className="panel behaviour-advice" aria-label="Gợi ý hành động theo hành vi">
      <h2>Gợi ý hành động theo hành vi</h2>
      <p>
        So sánh snapshot{capturedAt ? ` ${capturedAt}` : ''} với ngưỡng hành vi rút ra từ nghiên cứu
        — mức mà từ đó mô hình nghiêng về nhóm mua nhiều.
      </p>
      {below.length === 0 ? (
        <ul className="advice-list">
          <li className="advice-ok">
            <div className="advice-head">
              <strong>
                {missing.length === 6
                  ? 'Chưa đủ dữ liệu hành vi để gợi ý'
                  : 'Các hành vi tương tác đều đạt hoặc vượt ngưỡng'}
              </strong>
            </div>
            <p>
              {missing.length === 6
                ? 'Snapshot chưa có các chỉ số tương tác. Hệ thống không tự điền giá trị thiếu.'
                : 'Khách hàng thuộc nhóm tương tác tích cực: ưu tiên chăm sóc trung thành (ưu đãi thành viên, giới thiệu bạn bè) thay vì giảm giá đại trà.'}
            </p>
          </li>
        </ul>
      ) : (
        <ul className="advice-list">
          {below.slice(0, MAX_ITEMS).map((gap) => (
            <li key={gap.feature}>
              <div className="advice-head">
                <strong>{name(gap.feature)}</strong>
                <span>
                  Hiện tại {num(gap.value, 1)} {units[gap.feature]} · ngưỡng ≈{' '}
                  {num(gap.threshold, 1)} · khách mua nhiều thường ở mức {num(gap.targetMedian, 1)}
                </span>
              </div>
              <div
                className="advice-meter"
                role="img"
                aria-label={`${name(gap.feature)} đạt ${num((100 * gap.value) / gap.threshold, 0)}% ngưỡng`}
              >
                <span style={{ width: `${Math.min(100, (100 * gap.value) / gap.threshold)}%` }} />
              </div>
              <p>{advice[gap.feature]}</p>
            </li>
          ))}
        </ul>
      )}
      {(above.length > 0 || missing.length > 0 || below.length > MAX_ITEMS) && (
        <small>
          {below.length > MAX_ITEMS && `Còn ${below.length - MAX_ITEMS} hành vi khác dưới ngưỡng. `}
          {above.length > 0 && below.length > 0 && `Đã đạt ngưỡng: ${above.map(name).join(', ')}. `}
          {missing.length > 0 &&
            missing.length < 6 &&
            `Thiếu dữ liệu: ${missing.map(name).join(', ')}.`}
        </small>
      )}
      <small>
        Gợi ý dựa trên liên hệ thống kê trong dữ liệu nghiên cứu, không phải bằng chứng nhân quả;
        nên thử nghiệm trước khi áp dụng. Xem cơ sở tại{' '}
        <Link to="/insights">Phân tích hành vi mua hàng</Link>.
      </small>
    </section>
  );
}
