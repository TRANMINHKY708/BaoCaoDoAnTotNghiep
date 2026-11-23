import { ShapExplanation } from './ShapExplanation';
import { NarrativePanel } from '../assistant/NarrativePanel';
import { ExportButtons } from '../reports/ExportButtons';
import { TechnicalDetails } from '../../components/presentation';
import { modelName } from '../../components/presentationLabels';
import { useState } from 'react';
import { CheckCircle2, Download, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { dateTime, probability } from '../customers/customers';
import { Pagination } from '../customers/CustomerShared';
import { downloadBlob } from './csv';
import type { Result } from './prediction';

export type PredictionOutput = {
  narrativeReceipt?: string | null;
  results: Result[];
  saved: boolean;
  blob?: Blob;
  customerId?: string;
  explanationRequested?: boolean;
  explanation?: unknown;
  artifact?: string;
};
export function PredictionResults({ output }: { output: PredictionOutput }) {
  const [offset, setOffset] = useState(0),
    first = output.results[0]!;
  return (
    <section
      className="panel prediction-results"
      aria-label="Kết quả dự đoán mới"
      aria-live="polite"
    >
      <div className="prediction-section-heading">
        <div className="prediction-heading-icon">
          <Sparkles size={19} />
        </div>
        <div>
          <span className="eyebrow">KẾT QUẢ DỰ ĐOÁN MỚI</span>
          <h2>Mức độ mua hàng từ dữ liệu hiện có</h2>
        </div>
        <span className="prediction-success">
          <CheckCircle2 size={15} />
          {output.results.length} thành công · 0 thất bại
        </span>
      </div>
      <p className="prediction-save-state">
        {output.saved
          ? 'Yêu cầu lưu đã hoàn tất. Bạn có thể kiểm tra trong lịch sử; hệ thống chưa cung cấp biên nhận lưu riêng.'
          : 'Kết quả chưa được lưu vào lịch sử.'}
      </p>
      <p className="prediction-help">Xác suất mô hình không phải cam kết mua hàng.</p>
      {output.results.length === 1 ? (
        <>
          <div className="prediction-single-result">
            <div>
              <span className="prediction-help">Nhãn mô hình</span>
              <strong className={`prediction-level level-${first.purchase_level.toLowerCase()}`}>
                {first.purchase_level}
              </strong>
              <TechnicalDetails>
                <p>
                  Mã lớp: {first.predicted_class} · {first.model_version}
                </p>
                <pre>{JSON.stringify(first.probabilities, null, 2)}</pre>
              </TechnicalDetails>
            </div>
            <div className="prediction-probabilities">
              {(['Low', 'Medium', 'High'] as const).map((label) => (
                <div key={label}>
                  <div>
                    <span>{label}</span>
                    <strong>{probability(first.probabilities[label])}</strong>
                  </div>
                  <progress
                    aria-label={`Xác suất ${label}`}
                    max={1}
                    value={first.probabilities[label]}
                  />
                  <small className="technical-inline demo-secondary">
                    Giá trị gốc: {first.probabilities[label]}
                  </small>
                </div>
              ))}
            </div>
          </div>
          <dl className="prediction-result-meta">
            <div>
              <dt>Phiên bản mô hình</dt>
              <dd>{modelName('classification', first.model_version)}</dd>
            </div>
            <div>
              <dt>Thời điểm xử lý</dt>
              <dd>{dateTime(first.generated_at)}</dd>
            </div>
          </dl>
        </>
      ) : (
        <>
          <div
            className="prediction-table-scroll"
            role="region"
            aria-label="Bảng kết quả batch"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Bản ghi</th>
                  <th>Purchase_Level</th>
                  <th>P(Low)</th>
                  <th>P(Medium)</th>
                  <th>P(High)</th>
                  <th>Phiên bản mô hình</th>
                  <th>Xử lý (TP.HCM)</th>
                </tr>
              </thead>
              <tbody>
                {output.results.slice(offset, offset + 20).map((result, index) => (
                  <tr key={offset + index}>
                    <td>{offset + index + 1}</td>
                    <td>
                      <span
                        className={`prediction-tag level-${result.purchase_level.toLowerCase()}`}
                      >
                        {result.purchase_level}
                      </span>
                    </td>
                    <td title={String(result.probabilities.Low)}>
                      {probability(result.probabilities.Low)}
                    </td>
                    <td title={String(result.probabilities.Medium)}>
                      {probability(result.probabilities.Medium)}
                    </td>
                    <td title={String(result.probabilities.High)}>
                      {probability(result.probabilities.High)}
                    </td>
                    <td>
                      {modelName('classification', result.model_version)}
                      <TechnicalDetails>
                        <code>{result.model_version}</code>
                      </TechnicalDetails>
                    </td>
                    <td>{dateTime(result.generated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            offset={offset}
            limit={20}
            total={output.results.length}
            count={output.results.slice(offset, offset + 20).length}
            onChange={setOffset}
          />
          <p className="prediction-help">
            Số bản ghi là lượt dự đoán, không phải khách hàng duy nhất.
          </p>
        </>
      )}
      {output.explanationRequested && (
        <ShapExplanation value={output.explanation} prediction={first} artifact={output.artifact} />
      )}
      <NarrativePanel receipt={output.narrativeReceipt} kind="prediction" />
      <ExportButtons
        target={
          output.narrativeReceipt
            ? { source: 'preview', receipt: output.narrativeReceipt }
            : undefined
        }
      />
      <div className="prediction-result-actions">
        {output.blob && (
          <button
            type="button"
            className="button button-primary"
            onClick={() => downloadBlob(output.blob!, 'purchase_level_results.csv')}
          >
            <Download size={16} />
            Tải CSV kết quả
          </button>
        )}
        {output.customerId && (
          <Link className="text-link" to={`/customers/${output.customerId}?tab=predictions`}>
            Xem lịch sử đã lưu của khách hàng →
          </Link>
        )}
      </div>
      <p className="prediction-help">
        Ngưỡng theo tổng lượt mua: Low ≤ 10; Medium &gt; 10 đến 15; High &gt; 15. Không phải ngưỡng
        xác suất.
      </p>
    </section>
  );
}
