import { modelName } from '../../components/presentationLabels';
import { NarrativePanel } from '../assistant/NarrativePanel';
import { ExportButtons } from '../reports/ExportButtons';
import type { ReportTarget } from '../../api/reports';
import { dateTime, number, probability } from '../customers/customers';
import { labels } from '../predictions/prediction';
import { CLASSES, DISCLAIMER, warnings, type Comparison, type Preview } from './whatIf';

export function WarningList({ values }: { values: string[] }) {
  return (
    <ul className="whatif-warnings">
      {values.map((v, i) => (
        <li key={i}>{warnings[v] ?? 'API có cảnh báo bổ sung; chưa có diễn giải đã xác minh.'}</li>
      ))}
    </ul>
  );
}
export function WhatIfResults({
  preview,
  comparison,
  stored = false,
  copiedToHistory = false,
  narrativeReceipt,
  storedExport,
}: {
  preview: Preview;
  comparison?: Comparison;
  stored?: boolean;
  copiedToHistory?: boolean;
  narrativeReceipt?: string | null;
  storedExport?: ReportTarget;
}) {
  const before = preview.classification,
    after = comparison?.scenario_classification;
  return (
    <section
      className="panel whatif-results"
      aria-label={
        stored
          ? 'Kết quả kịch bản đã lưu'
          : copiedToHistory
            ? 'Kết quả mô phỏng đã lưu bản sao'
            : 'Kết quả mô phỏng chưa lưu'
      }
    >
      <span className="eyebrow">
        {stored
          ? 'LỊCH SỬ KỊCH BẢN'
          : copiedToHistory
            ? 'MÔ PHỎNG HIỆN TẠI / ĐÃ LƯU BẢN SAO'
            : 'PHẢN ỨNG MÔ HÌNH / CHƯA LƯU'}
      </span>
      <h2>{comparison ? 'So sánh trước và sau thay đổi' : 'Kết quả phân tích ban đầu'}</h2>
      {!stored && <NarrativePanel receipt={narrativeReceipt} kind="what_if" />}
      <ExportButtons
        target={
          stored
            ? storedExport
            : narrativeReceipt
              ? { source: 'preview', receipt: narrativeReceipt }
              : undefined
        }
      />
      <p className="prediction-help">{modelName('classification', before.model.model_version)}</p>
      <p className="prediction-help">
        {stored
          ? 'Đang xem kết quả lịch sử, không chạy mô hình lại.'
          : 'Phân tích và so sánh không tự lưu hoặc sửa hồ sơ khách hàng.'}{' '}
        Thời điểm phân tích ban đầu: {dateTime(preview.generated_at)}
      </p>
      <div className="whatif-transition">
        <div>
          <small>Ban đầu · mức độ mua hàng</small>
          <strong>{before.purchase_level}</strong>
        </div>
        <span aria-hidden="true">→</span>
        <div>
          <small>Sau thay đổi · mức độ mua hàng</small>
          <strong>{after?.purchase_level ?? 'Chưa so sánh'}</strong>
        </div>
      </div>
      <div className="whatif-probabilities" aria-label="Xác suất mô hình Low Medium High">
        {CLASSES.map((c) => (
          <div className="whatif-prob-row" key={c}>
            <strong>{c}</strong>
            <div>
              <span>
                Ban đầu{' '}
                <b title={String(before.probabilities[c])}>
                  {probability(before.probabilities[c])}
                </b>
              </span>
              <progress max={1} value={before.probabilities[c]} aria-label={`Baseline ${c}`} />
            </div>
            <div>
              <span>
                Kịch bản{' '}
                <b title={after ? String(after.probabilities[c]) : undefined}>
                  {after ? probability(after.probabilities[c]) : '—'}
                </b>
              </span>
              {after && (
                <progress
                  className="whatif-scenario-bar"
                  max={1}
                  value={after.probabilities[c]}
                  aria-label={`Kịch bản ${c}`}
                />
              )}
            </div>
            <span className="whatif-pp">
              {comparison
                ? `${comparison.probability_deltas.percentage_points[c]! >= 0 ? '+' : ''}${number(comparison.probability_deltas.percentage_points[c]!)} điểm %`
                : '—'}
            </span>
          </div>
        ))}
      </div>
      <p className="prediction-help">
        Chênh lệch tính bằng điểm phần trăm. Xác suất mô hình chưa phải tỷ lệ chuyển đổi thực tế.
      </p>
      {comparison && (
        <>
          <h3>Thay đổi đầu vào thực sự</h3>
          {!comparison.changed_fields.length ? (
            <p>Không có thay đổi đầu vào thực sự.</p>
          ) : (
            <div
              className="prediction-table-scroll"
              role="region"
              aria-label="Bảng thay đổi feature"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Biến</th>
                    <th>Trước</th>
                    <th>Sau</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.changed_fields.map((f) => (
                    <tr key={f.feature}>
                      <td>
                        {labels[f.feature]}
                        <small className="technical-inline">{f.feature}</small>
                      </td>
                      <td>{f.before === null ? 'null (thiếu)' : number(f.before)}</td>
                      <td>{number(f.after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {preview.segmentation && (
        <div className="whatif-segment">
          <h3>Phân nhóm tương tác · khác mức độ mua hàng</h3>
          <p>
            {preview.segmentation.segment_name} →{' '}
            {comparison?.scenario_segmentation?.segment_name ?? 'Chưa so sánh'}
          </p>
          <p className="prediction-help">
            Khoảng cách baseline: {number(preview.segmentation.distance_to_centroid)}
            {comparison?.scenario_segmentation
              ? ` · kịch bản: ${number(comparison.scenario_segmentation.distance_to_centroid)}`
              : ''}
            . Khoảng cách chuẩn hóa không phải xác suất hoặc mức tin cậy.
          </p>
        </div>
      )}
      <details className="whatif-trace">
        <summary>Thông tin kỹ thuật</summary>
        <p>
          Classifier {before.model.model_version} · preprocessing/validation policy:{' '}
          {before.model.validation_policy}
        </p>
        <p>
          Artifact SHA256 <code>{before.model.artifact_sha256}</code>
        </p>
        <p>
          Metadata SHA256 <code>{before.model.metadata_sha256}</code>
        </p>
        {preview.segmentation && (
          <p>
            Mã nhóm: {preview.segmentation.segment_id} · K-Means{' '}
            {preview.segmentation.model.model_version} · artifact{' '}
            <code>{preview.segmentation.model.artifact_sha256}</code> · metadata{' '}
            <code>{preview.segmentation.model.metadata_sha256}</code>
          </p>
        )}
        <p>
          Baseline fingerprint <code>{preview.baseline_fingerprint}</code>
        </p>
        {comparison && (
          <p>
            Comparison fingerprint <code>{comparison.comparison_fingerprint}</code>
          </p>
        )}
        <dl className="whatif-baseline-input">
          {Object.entries(preview.baseline_input).map(([name, value]) => (
            <div key={name}>
              <dt>
                {labels[name] ?? name}
                <small>{name}</small>
              </dt>
              <dd>{value === null ? 'null (thiếu)' : String(value)}</dd>
            </div>
          ))}
        </dl>
      </details>
      <WarningList values={comparison?.warnings ?? preview.warnings} />
      <p className="whatif-disclaimer">{DISCLAIMER}</p>
    </section>
  );
}
