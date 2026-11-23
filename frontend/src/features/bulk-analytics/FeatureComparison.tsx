import { useId, useState } from 'react';
import { filterRequest, type Draft } from './filters';
import { checkedView, segmentationScope } from './navigation';
import type { BatchView, ModelIdentity } from './types';
import {
  comparisonFeatures,
  finiteMean,
  formatMean,
  supportedFeatures,
  valueScale,
} from './comparisonData';
import { vietnamDateTime } from '../bulk/time';
import './comparison.css';

export function FeatureComparison({
  data,
  applied,
  selectedFeature,
  onFeatureChange,
}: {
  data: BatchView;
  applied: Draft;
  selectedFeature?: string;
  onFeatureChange?: (feature: string) => void;
}) {
  const id = useId();
  const [choice, setChoice] = useState('');
  let scope: ModelIdentity | null = null;
  let verified = data.source === 'postgresql_f09_f10_saved_history';
  try {
    checkedView(data, filterRequest(applied), data.offset);
    scope = segmentationScope(data, applied);
  } catch {
    verified = false;
  }
  const complete =
    Array.isArray(data.cluster_profiles) &&
    data.cluster_profiles.every(
      (profile) =>
        profile &&
        [0, 1, 2].includes(profile.cluster) &&
        Number.isSafeInteger(profile.records) &&
        profile.records >= 0 &&
        profile.means &&
        typeof profile.means === 'object' &&
        !Array.isArray(profile.means),
    ) &&
    new Set(data.cluster_profiles.map((profile) => profile.cluster)).size ===
      data.cluster_profiles.length;
  if (!complete) verified = false;
  const profiles = complete ? data.cluster_profiles : [];
  const features = supportedFeatures(profiles);
  const feature = features.find((key) => key === (selectedFeature ?? choice)) ?? features[0];
  const info = feature ? comparisonFeatures[feature] : undefined;
  const rows = profiles.map((profile) => ({
    ...profile,
    value:
      feature &&
      profile.status === 'available' &&
      profile.records >= 2 &&
      finiteMean(profile.means[feature])
        ? profile.means[feature]!
        : null,
  }));
  const overall =
    feature && verified && scope && finiteMean(data.overall_means?.[feature])
      ? data.overall_means[feature]!
      : null;
  const values = rows.flatMap((row) => (row.value === null ? [] : [row.value]));
  const scale = valueScale([...values, ...(overall === null ? [] : [overall])]);
  const zero = scale.x(0);

  return (
    <section className="panel feature-comparison" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>So sánh đặc điểm giữa các nhóm</h2>
      {!verified ? (
        <p>Chưa xác minh được phạm vi hoặc mô hình phân nhóm. Không hiển thị biểu đồ so sánh.</p>
      ) : !profiles.length ? (
        <p>Chưa có kết quả phân nhóm đã lưu trong phạm vi này.</p>
      ) : !scope ? (
        <p>Chưa xác minh được phạm vi hoặc mô hình phân nhóm. Không hiển thị biểu đồ so sánh.</p>
      ) : !feature || !info ? (
        <p>Không có đặc điểm phù hợp để so sánh từ dữ liệu được trả về.</p>
      ) : (
        <>
          <label htmlFor={`${id}-feature`}>Đặc điểm cần xem</label>
          <select
            id={`${id}-feature`}
            value={feature}
            onChange={(event) => {
              setChoice(event.target.value);
              onFeatureChange?.(event.target.value);
            }}
          >
            {features.map((key) => (
              <option key={key} value={key}>
                {comparisonFeatures[key].label}
              </option>
            ))}
          </select>
          <p>
            Giá trị trung bình theo nhóm · Đơn vị: {info.unit}. Trong phạm vi bộ lọc đã áp dụng.
          </p>
          {applied.cluster !== '' && (
            <p>
              Đang lọc nhóm khách hàng {applied.cluster}. Dùng “Bỏ lọc nhóm” ở trên để xem các nhóm
              khác trong cùng phạm vi.
            </p>
          )}
          {profiles.length === 1 && (
            <p>Chỉ có một nhóm được trả về; biểu đồ không đại diện cho tất cả nhóm.</p>
          )}
          {!values.length ? (
            <p role="status">
              Không có dữ liệu trung bình hợp lệ theo nhóm cho đặc điểm đang chọn.
            </p>
          ) : (
            <>
              <div
                className="comparison-axis comparison-row"
                aria-label="Khoảng giá trị, luôn bao gồm 0"
              >
                <div aria-hidden="true" />
                <div>
                  <span>{formatMean(scale.low)}</span>
                  <span>{formatMean(scale.high)}</span>
                </div>
                <span aria-hidden="true" />
              </div>
              <p className="comparison-legend">
                Vạch liền: giá trị 0.{' '}
                {overall !== null && 'Vạch nét đứt: trung bình toàn phạm vi đang lọc.'}
              </p>
            </>
          )}
          <div className="comparison-rows">
            {rows.map((row) => (
              <div key={row.cluster} className="comparison-row">
                <div>
                  <strong>Nhóm khách hàng {row.cluster}</strong>
                  <small>{row.records} bản ghi kết quả phân nhóm</small>
                </div>
                {row.value === null ? (
                  <span className="comparison-missing">Không có dữ liệu</span>
                ) : (
                  <svg
                    viewBox="0 0 600 40"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label={`Nhóm khách hàng ${row.cluster}: ${row.value} ${info.unit}`}
                  >
                    <title>{`${info.label} · Nhóm khách hàng ${row.cluster}: ${row.value} ${info.unit}`}</title>
                    <line x1={zero} x2={zero} y1="2" y2="38" className="comparison-zero" />
                    {row.value === 0 ? (
                      <circle cx={zero} cy="20" r="4" className="comparison-mark" data-value="0" />
                    ) : (
                      <rect
                        x={Math.min(zero, scale.x(row.value))}
                        y="10"
                        width={Math.abs(scale.x(row.value) - zero)}
                        height="20"
                        rx="3"
                        className="comparison-mark"
                        data-value={row.value}
                      />
                    )}
                    {overall !== null && (
                      <line
                        x1={scale.x(overall)}
                        x2={scale.x(overall)}
                        y1="2"
                        y2="38"
                        className="comparison-reference"
                      >
                        <title>{`Trung bình trong phạm vi lọc: ${overall} ${info.unit}`}</title>
                      </line>
                    )}
                  </svg>
                )}
                <span
                  className="comparison-value"
                  title={row.value === null ? undefined : `${row.value} ${info.unit}`}
                >
                  {row.value === null ? '—' : formatMean(row.value)}
                </span>
              </div>
            ))}
          </div>
          <details>
            <summary>Phạm vi và mô hình</summary>
            <p className="comparison-note">
              Giá trị gốc; tỷ lệ ở thang 0–100. Số bản ghi không phải khách hàng hoặc snapshot duy
              nhất. Chưa có thống kê thiếu theo từng đặc điểm.
            </p>
            <p>Dữ liệu đã lưu trong hệ thống · {vietnamDateTime(data.as_of)}</p>
            <p>
              Phân nhóm · {scope.model_version} · đặc điểm: {feature}
            </p>
            <p>
              Artifact: {scope.artifact_sha256}
              <br />
              Metadata: {scope.metadata_sha256}
            </p>
            <p>Namespace riêng chưa được API cung cấp; không đối chiếu số nhóm giữa các mô hình.</p>
            <p>
              Nguồn:{' '}
              {data.data_origins?.length ? data.data_origins.join(', ') : 'Chưa có thông tin'}
            </p>
          </details>
        </>
      )}
    </section>
  );
}
