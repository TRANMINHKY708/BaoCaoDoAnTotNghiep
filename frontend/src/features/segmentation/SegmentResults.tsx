import { TechnicalDetails } from '../../components/presentation';
import { NarrativePanel } from '../assistant/NarrativePanel';
import { ExportButtons } from '../reports/ExportButtons';
import { modelName } from '../../components/presentationLabels';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { dateTime } from '../customers/customers';
import { Pagination } from '../customers/CustomerShared';
import { downloadBlob } from '../predictions/csv';
import { FEATURES, type Segment } from './segmentation';
export type SegmentOutput = {
  narrativeReceipt?: string | null;
  results: Segment[];
  saved: boolean;
  blob?: Blob;
  customerId?: string;
};
export function SegmentResults({ output }: { output: SegmentOutput }) {
  const [offset, setOffset] = useState(0),
    first = output.results[0]!;
  return (
    <section
      className="panel prediction-results"
      aria-label="Kết quả phân nhóm mới"
      aria-live="polite"
    >
      <div className="prediction-section-heading">
        <div>
          <span className="eyebrow">KẾT QUẢ PHÂN NHÓM MỚI</span>
          <h2>Nhóm khách hàng theo dữ liệu hiện có</h2>
        </div>
        <span className="prediction-success">{output.results.length} thành công · 0 thất bại</span>
      </div>
      <p className="prediction-save-state">
        {output.saved
          ? 'Yêu cầu lưu đã hoàn tất. Bạn có thể kiểm tra trong lịch sử; hệ thống chưa cung cấp biên nhận lưu riêng.'
          : 'Kết quả chưa được lưu vào lịch sử.'}
      </p>
      {output.results.length === 1 ? (
        <>
          <div className="segment-result-grid">
            <div>
              <small>Nhóm khách hàng</small>
              <h3>{first.segment_name}</h3>
              <TechnicalDetails>
                <p>
                  Cluster ID: {first.cluster} · {first.segment_id}
                </p>
                <p>{first.model_version}</p>
                <p>Khoảng cách gốc: {first.distance_to_centroid}</p>
              </TechnicalDetails>
            </div>
            <div>
              <small>Khoảng cách đến tâm cụm</small>
              <strong className="segment-distance" title={String(first.distance_to_centroid)}>
                {first.distance_to_centroid.toLocaleString('vi-VN', { maximumFractionDigits: 6 })}
              </strong>
              <small className="technical-inline demo-secondary">
                Giá trị gốc: {first.distance_to_centroid}
              </small>
            </div>
          </div>
          <dl className="prediction-result-meta">
            <div>
              <dt>Phiên bản mô hình</dt>
              <dd>{modelName('segmentation', first.model_version)}</dd>
            </div>
            <div>
              <dt>Thời điểm xử lý</dt>
              <dd>{dateTime(first.generated_at)}</dd>
            </div>
          </dl>
          <Quality result={first} />
        </>
      ) : (
        <>
          <div
            className="prediction-table-scroll"
            role="region"
            aria-label="Bảng phân nhóm batch"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Bản ghi</th>
                  <th>Cluster ID</th>
                  <th>Tên phân nhóm</th>
                  <th>Segment ID</th>
                  <th>Khoảng cách</th>
                  <th>Phiên bản mô hình</th>
                  <th>Xử lý TP.HCM</th>
                </tr>
              </thead>
              <tbody>
                {output.results.slice(offset, offset + 20).map((row, index) => (
                  <tr key={offset + index}>
                    <td>{offset + index + 1}</td>
                    <td>{row.cluster}</td>
                    <td>{row.segment_name}</td>
                    <td>{row.segment_id}</td>
                    <td title={String(row.distance_to_centroid)}>
                      {row.distance_to_centroid.toLocaleString('vi-VN', {
                        maximumFractionDigits: 6,
                      })}
                    </td>
                    <td>
                      {modelName('segmentation', row.model_version)}
                      <TechnicalDetails>
                        <code>{row.model_version}</code>
                      </TechnicalDetails>
                    </td>
                    <td>{dateTime(row.generated_at)}</td>
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
            Số bản ghi là lượt phân nhóm, không phải khách hàng duy nhất.
          </p>
        </>
      )}
      <p className="segment-notice">
        Khoảng cách chuẩn hóa không phải xác suất. Phân nhóm mô tả dữ liệu hiện tại, không dự báo
        mua hàng.
      </p>
      {first.model_version === '1.0.0' && (
        <p className="prediction-help">
          Nhãn “tiềm năng” không bảo đảm mua hàng trong tương lai. Nhãn nhóm chỉ có ý nghĩa trong mô
          hình đã chọn.
        </p>
      )}
      <NarrativePanel receipt={output.narrativeReceipt} kind="segmentation" />
      <ExportButtons
        target={
          output.narrativeReceipt
            ? { source: 'preview', receipt: output.narrativeReceipt }
            : undefined
        }
        research
      />
      <div className="prediction-result-actions">
        {output.blob && (
          <button
            className="button button-primary"
            onClick={() => downloadBlob(output.blob!, 'customer_segmentation_results.csv')}
          >
            Tải CSV kết quả phân nhóm
          </button>
        )}
        {output.customerId && (
          <Link className="text-link" to={`/customers/${output.customerId}?tab=segments`}>
            Xem lịch sử phân nhóm đã lưu →
          </Link>
        )}
      </div>
    </section>
  );
}
function Quality({ result }: { result: Segment }) {
  const quality = result.input_quality;
  if (!quality)
    return (
      <p className="prediction-help">Kết quả này chưa cung cấp chi tiết xử lý dữ liệu đầu vào.</p>
    );
  return (
    <details className="segment-definitions">
      <summary>Thông tin kỹ thuật</summary>
      {(
        [
          ['imputed_features', 'Feature được điền missing'],
          ['clipped_features', 'Feature được clipping'],
          ['outside_training_range', 'Feature ngoài range train'],
        ] as const
      ).map(([key, label]) => {
        const values = Array.isArray(quality[key])
          ? (quality[key] as unknown[]).filter(
              (x): x is string => typeof x === 'string' && FEATURES.includes(x),
            )
          : [];
        return (
          <p key={key}>
            <strong>{label}: </strong>
            {values.length ? values.join(', ') : 'Không có feature được liệt kê'}
          </p>
        );
      })}
      {quality.distance_above_training_cluster_p99 === true && (
        <p>
          Khoảng cách vượt p99 train của cụm. Đây là diagnostic, không phải xác suất sai hoặc bộ
          phát hiện bất thường đã được kiểm định.
        </p>
      )}
    </details>
  );
}
