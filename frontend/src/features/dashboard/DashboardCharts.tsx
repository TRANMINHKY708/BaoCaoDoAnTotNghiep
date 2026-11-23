import type { Overview } from './dashboard';
import { number, percent } from './dashboard';

const colors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'];
function Distribution({
  title,
  rows,
  denominator,
  missing,
  note,
}: {
  title: string;
  rows: { name: string; id: string; count: number; share: number | null }[];
  denominator: number;
  missing: number;
  note: string;
}) {
  return (
    <section className="panel distribution-panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        <span className="subtle-tag">Khách hàng duy nhất</span>
      </div>
      <p className="chart-caption">N = {number(denominator)} khách có nhãn mới nhất trong kỳ</p>
      {denominator === 0 ? (
        <div className="chart-empty">
          <strong>Chưa có nhãn trong kỳ</strong>
          <p>Không có mẫu số để tính tỷ lệ. Không suy nhãn từ dataset hoặc kỳ trước.</p>
        </div>
      ) : (
        <div className="distribution-body">
          <div className="donut-wrap">
            <svg
              viewBox="0 0 140 140"
              role="img"
              aria-label={`${title}: ${rows.map((r) => `${r.name} ${r.count} khách`).join(', ')}`}
            >
              <circle
                cx="70"
                cy="70"
                r="50"
                fill="none"
                stroke="var(--chart-track)"
                strokeWidth="15"
              />
              {rows.map((row, i) => {
                const length = (row.share ?? 0) * 314.159265;
                const begin = rows
                  .slice(0, i)
                  .reduce((sum, item) => sum + (item.share ?? 0) * 314.159265, 0);
                return (
                  <circle
                    key={row.id}
                    cx="70"
                    cy="70"
                    r="50"
                    fill="none"
                    stroke={colors[i]}
                    strokeWidth="15"
                    strokeDasharray={`${length} ${314.159265 - length}`}
                    strokeDashoffset={-begin}
                    transform="rotate(-90 70 70)"
                  >
                    <title>
                      {row.name}: {row.count} khách ({percent(row.share)})
                    </title>
                  </circle>
                );
              })}
              <text x="70" y="69" textAnchor="middle" className="donut-total">
                {number(denominator)}
              </text>
              <text x="70" y="87" textAnchor="middle" className="donut-unit">
                khách hàng
              </text>
            </svg>
          </div>
          <ul className="distribution-list">
            {rows.map((row, i) => (
              <li key={row.id}>
                <div className="distribution-label">
                  <span className={`chart-dot chart-color-${i}`} />
                  <span>
                    <strong>{row.name}</strong>
                    <details className="technical-details">
                      <summary>Mã nhãn</summary>
                      <small>{row.id}</small>
                    </details>
                  </span>
                </div>
                <div className="distribution-value">
                  <strong>{number(row.count)}</strong>
                  <span>{percent(row.share)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="chart-footer">
        <span>{number(missing)} khách chưa có nhãn trong kỳ</span>
        <p>{note}</p>
      </div>
    </section>
  );
}

export default function DashboardCharts({ data }: { data: Overview }) {
  const days = data.activity_by_day;
  const max = Math.max(
    1,
    ...days.flatMap((d) => [d.purchase_results, d.segmentation_results, d.what_if_scenarios]),
  );
  const points = (field: 'purchase_results' | 'segmentation_results' | 'what_if_scenarios') =>
    days
      .map(
        (d, i) =>
          `${35 + (days.length === 1 ? 400 : (i * 790) / (days.length - 1))},${170 - (d[field] / max) * 135}`,
      )
      .join(' ');
  return (
    <>
      <div className="dashboard-two-columns">
        <Distribution
          title="Mức độ mua hàng · Purchase_Level"
          denominator={data.classification.customers.with_result}
          missing={data.classification.customers.without_result}
          rows={data.classification.distribution.map((d) => ({
            name: d.purchase_level,
            id: `Purchase_Level · ${d.purchase_level}`,
            count: d.customers,
            share: d.share,
          }))}
          note="Nhãn mô hình đã lưu, không phải hành vi thực tế hay độ chính xác. Low ≤ 10; Medium ≤ 15; High > 15."
        />
        <Distribution
          title="Phân nhóm tương tác · K-Means"
          denominator={data.segmentation.customers.with_result}
          missing={data.segmentation.customers.without_result}
          rows={data.segmentation.distribution.map((d) => ({
            name: d.display_label ?? `Cụm ${d.cluster}`,
            id: d.segment_id,
            count: d.customers,
            share: d.share,
          }))}
          note="ID phân nhóm độc lập với Purchase_Level. Khoảng cách K-Means không phải xác suất hay confidence."
        />
      </div>
      <section className="panel activity-panel">
        <div className="panel-heading">
          <h2>Hoạt động lưu kết quả</h2>
          <span className="subtle-tag">Lượt bản ghi · ngày TP.HCM</span>
        </div>
        <p className="chart-caption">
          Thời điểm ghi vào hệ thống, không phải số giao dịch hoặc số lần mua hàng.
        </p>
        <div className="chart-legend">
          <span>
            <i className="chart-dot chart-color-0" />
            Phân loại
          </span>
          <span>
            <i className="chart-dot chart-color-1" />
            Phân nhóm
          </span>
          <span>
            <i className="chart-dot chart-color-2" />
            Kịch bản What-if
          </span>
        </div>
        <svg
          className="activity-svg"
          viewBox="0 0 860 210"
          role="img"
          aria-label="Biểu đồ lượt kết quả được lưu theo ngày TP.HCM"
        >
          {[0, 0.5, 1].map((n) => (
            <g key={n}>
              <line
                x1="35"
                x2="825"
                y1={170 - n * 135}
                y2={170 - n * 135}
                stroke="var(--chart-grid)"
                strokeDasharray="4 5"
              />
              <text x="25" y={174 - n * 135} textAnchor="end">
                {number(n * max)}
              </text>
            </g>
          ))}
          {(['purchase_results', 'segmentation_results', 'what_if_scenarios'] as const).map(
            (field, i) => (
              <polyline
                key={field}
                points={points(field)}
                fill="none"
                stroke={colors[i]}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            ),
          )}
          <text x="35" y="198">
            {days[0]?.date}
          </text>
          <text x="825" y="198" textAnchor="end">
            {days.at(-1)?.date}
            {days.at(-1)?.is_partial ? ' · chưa đủ ngày' : ''}
          </text>
        </svg>
        <details className="activity-details">
          <summary>Xem dữ liệu biểu đồ · {days.length} ngày TP.HCM</summary>
          <div className="dashboard-table-scroll">
            <table>
              <caption>Lượt lưu kết quả theo ngày, gồm ngày không phát sinh</caption>
              <thead>
                <tr>
                  <th>Ngày TP.HCM</th>
                  <th>Phân loại</th>
                  <th>Phân nhóm</th>
                  <th>Kịch bản</th>
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day.date}>
                    <td>
                      {day.date}
                      {day.is_partial ? ' (chưa đủ ngày)' : ''}
                    </td>
                    <td>{number(day.purchase_results)}</td>
                    <td>{number(day.segmentation_results)}</td>
                    <td>{number(day.what_if_scenarios)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </>
  );
}
