import { useState } from 'react';
import type { Result } from './prediction';
import './shap.css';
import { readExplanation } from './explanation';

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
export function ShapExplanation({
  value,
  prediction,
  artifact,
}: {
  value: unknown;
  prediction: Result;
  artifact?: string;
}) {
  const [all, setAll] = useState(false);
  const explanation = readExplanation(value, prediction, artifact);
  if (!explanation)
    return (
      <div className="shap-unavailable" role="status">
        Giải thích dự đoán hiện không khả dụng hoặc dữ liệu trả về chưa hợp lệ. Kết quả dự đoán ở
        trên vẫn được giữ nguyên.
      </div>
    );
  const features = [...explanation.features].sort(
    (a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value),
  );
  const limit = Math.max(...features.map((f) => Math.abs(f.shap_value)), Number.EPSILON);
  const shown = all ? features : features.slice(0, 12);
  return (
    <section className="shap-explanation" aria-label="Giải thích dự đoán TreeSHAP">
      <h3>Điều gì đóng góp vào kết quả này?</h3>
      <p>
        Lớp được giải thích: <strong>{explanation.purchase_level}</strong> · Phiên bản{' '}
        <code>{explanation.model_version}</code>
      </p>
      <dl className="shap-summary">
        <div>
          <dt>Giá trị cơ sở (base value)</dt>
          <dd>{explanation.base_value}</dd>
        </div>
        <div>
          <dt>Đầu ra mô hình (raw margin)</dt>
          <dd>{explanation.model_output}</dd>
        </div>
      </dl>
      <p>Đơn vị: raw margin, không phải phần trăm xác suất.</p>
      <p>Giải thích bản ghi này trên dữ liệu sau tiền xử lý; không chứng minh quan hệ nhân quả.</p>
      <div className="shap-legend">
        <span className="shap-positive">Dương: tăng raw margin của lớp</span>
        <span className="shap-negative">Âm: giảm raw margin của lớp</span>
      </div>
      <p>
        Hiển thị {shown.length}/{features.length} cột, xếp theo độ lớn tuyệt đối. Trục giữa là 0.
      </p>
      <ol className="shap-rows" aria-label="Đóng góp đặc trưng có dấu">
        {shown.map((f) => {
          const width = (Math.abs(f.shap_value) / limit) * 50;
          return (
            <li key={f.feature_name}>
              <div className="shap-feature">
                <strong>{f.feature_name}</strong>
                <span>
                  Giá trị sau tiền xử lý:{' '}
                  {f.feature_value === null ? 'Thiếu dữ liệu (null)' : String(f.feature_value)}
                </span>
              </div>
              <div className="shap-track" aria-hidden="true">
                <span className="shap-zero">0</span>
                <span
                  className={f.shap_value >= 0 ? 'shap-bar positive' : 'shap-bar negative'}
                  style={{ left: `${f.shap_value >= 0 ? 50 : 50 - width}%`, width: `${width}%` }}
                />
              </div>
              <code className="shap-value">{signed(f.shap_value)}</code>
            </li>
          );
        })}
      </ol>
      {features.length > 12 && (
        <button type="button" className="button button-secondary" onClick={() => setAll(!all)}>
          {all ? 'Thu gọn 12 đặc trưng' : 'Xem tất cả đặc trưng'}
        </button>
      )}
    </section>
  );
}
