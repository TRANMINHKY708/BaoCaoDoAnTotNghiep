import { Link } from 'react-router-dom';
import { BookOpenCheck, Lightbulb, Target, UsersRound } from 'lucide-react';
import { labels } from '../predictions/prediction';
import { BarList, Kpi, LineChart, ShareBar } from './charts';
import {
  CLASS_ORDER,
  ENGAGEMENT_FEATURES,
  classColor,
  classLabel,
  num,
  pct,
  research,
  units,
} from './insights';
import './insights.css';

const featureName = (feature: string) => labels[feature] ?? feature;

export default function InsightsPage() {
  const { eda, shap, segments, dataset } = research;
  const total = eda.rows;
  const engagementShare = shap.ranking
    .filter((row) => (ENGAGEMENT_FEATURES as readonly string[]).includes(row.feature))
    .reduce((sum, row) => sum + row.share_percent, 0);
  const demographicShare = shap.ranking
    .filter((row) => ['Age', 'Gender', 'Country', 'City'].includes(row.feature))
    .reduce((sum, row) => sum + row.share_percent, 0);
  const thresholds = shap.thresholds;
  const low = segments.items.find((s) => s.name === 'Tương tác thấp');
  const high = segments.items.find((s) => s.name === 'Tương tác cao');
  const maxShap = Math.max(
    ...shap.ranking.map((r) => CLASS_ORDER.reduce((s, c) => s + r.by_class[c], 0)),
  );
  const quarterMax = Math.max(...eda.signup_quarter.map((q) => q.mean_purchases));

  return (
    <div className="insights-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">NGHIÊN CỨU HÀNH VI</span>
          <h1>Phân tích hành vi mua hàng</h1>
          <p>
            Kết quả nghiên cứu trên {num(total, 0)} bản ghi của bộ dữ liệu {dataset.name}. Đây là dữ
            liệu nghiên cứu, không phải khách hàng đang quản lý trong hệ thống.
          </p>
        </div>
        <span className="scope-badge">
          <BookOpenCheck size={14} />
          Dữ liệu nghiên cứu · tĩnh
        </span>
      </div>

      <section className="insight-findings" aria-label="Ba phát hiện chính">
        <article>
          <Lightbulb size={20} />
          <h2>Khách hàng làm gì quan trọng hơn khách hàng là ai</h2>
          <p>
            Sáu chỉ số tương tác chiếm <strong>{pct(engagementShare, 0)}</strong> mức ảnh hưởng
            trong mô hình; tuổi, giới tính, quốc gia, thành phố cộng lại chỉ{' '}
            <strong>{pct(demographicShare, 1)}</strong>.
          </p>
        </article>
        <article>
          <Target size={20} />
          <h2>Có ngưỡng hành vi rõ ràng</h2>
          <p>
            Khả năng thuộc nhóm mua nhiều tăng rõ khi phiên dài hơn khoảng{' '}
            <strong>
              {num(thresholds.Session_Duration_Avg.threshold, 0)} {units.Session_Duration_Avg}
            </strong>
            , xem trên <strong>{num(thresholds.Pages_Per_Session.threshold, 0)} trang</strong> và
            đăng nhập trên <strong>{num(thresholds.Login_Frequency.threshold, 0)} lần</strong>.
          </p>
        </article>
        <article>
          <UsersRound size={20} />
          <h2>Tương tác thấp là nhóm rủi ro rời bỏ</h2>
          <p>
            Tỷ lệ rời bỏ <strong>{pct(low?.churn_rate_percent)}</strong> ở nhóm tương tác thấp so
            với <strong>{pct(high?.churn_rate_percent)}</strong> ở nhóm tương tác cao — dù biến rời
            bỏ không được dùng để phân nhóm.
          </p>
        </article>
      </section>

      <section className="insight-kpis" aria-label="Chỉ số tổng quan bộ dữ liệu">
        <Kpi
          label="Bản ghi nghiên cứu"
          value={num(total, 0)}
          hint={`${eda.source_columns} thuộc tính gốc`}
        />
        {CLASS_ORDER.map((c) => (
          <Kpi
            key={c}
            label={`Mức mua ${classLabel[c].toLowerCase()}`}
            value={pct((100 * eda.class_counts[c]) / total)}
            hint={
              c === 'Low'
                ? `≤ ${eda.thresholds.low_max} lượt mua`
                : c === 'Medium'
                  ? `${eda.thresholds.low_max + 1}–${eda.thresholds.medium_max} lượt mua`
                  : `> ${eda.thresholds.medium_max} lượt mua`
            }
          />
        ))}
        <Kpi label="Tỷ lệ rời bỏ" value={pct(eda.churn_rate_percent)} hint="Churned = 1" />
      </section>

      <section className="panel insight-section">
        <div className="panel-heading">
          <h2>Hành vi nào gắn với mức mua hàng?</h2>
          <span className="subtle-tag">SHAP toàn cục · {num(shap.rows, 0)} bản ghi train</span>
        </div>
        <p className="insight-lead">
          Mức ảnh hưởng trung bình của từng thuộc tính lên dự đoán của mô hình {shap.model}, tách
          theo đóng góp vào từng lớp. Thanh càng dài, thuộc tính càng chi phối kết quả.
        </p>
        <div className="legend" aria-hidden="true">
          {CLASS_ORDER.map((c) => (
            <span key={c}>
              <i style={{ background: classColor[c] }} />
              Lớp {classLabel[c].toLowerCase()}
            </span>
          ))}
        </div>
        <BarList
          label="Xếp hạng mức ảnh hưởng SHAP"
          max={maxShap}
          rows={shap.ranking.map((row) => {
            const sum = CLASS_ORDER.reduce((s, c) => s + row.by_class[c], 0);
            return {
              key: row.feature,
              label: featureName(row.feature),
              value: sum,
              display: pct(row.share_percent),
              muted: row.share_percent < 2,
              parts: CLASS_ORDER.map((c) => ({
                value: row.by_class[c],
                color: classColor[c],
                title: `${classLabel[c]}: ${num(row.by_class[c], 3)}`,
              })),
            };
          })}
        />
        <p className="insight-note">
          Phương pháp: TreeSHAP chính xác của XGBoost trong không gian log-odds; cột one-hot được
          cộng về thuộc tính gốc. SHAP mô tả điều mô hình đã học (liên hệ thống kê), không phải tác
          động nhân quả của việc thay đổi hành vi.
        </p>
      </section>

      <section className="panel insight-section">
        <div className="panel-heading">
          <h2>Ngưỡng hành vi: từ đâu khách hàng bắt đầu mua nhiều hơn?</h2>
          <span className="subtle-tag">Đường cong 10 nhóm thập phân vị</span>
        </div>
        <p className="insight-lead">
          Mỗi biểu đồ chia khách hàng thành 10 nhóm theo giá trị hành vi và cho biết tỷ lệ thuộc lớp
          mua <strong>Cao</strong> trong từng nhóm. Đường dọc là ngưỡng mà mô hình chuyển từ nghiêng
          về mua ít sang mua nhiều (SHAP lớp Cao đổi dấu).
        </p>
        <div className="threshold-grid">
          {ENGAGEMENT_FEATURES.map((feature) => {
            const t = thresholds[feature];
            const curve = eda.behaviour_curves[feature];
            const first = curve[0]?.high_percent ?? 0;
            const last = curve.at(-1)?.high_percent ?? 0;
            return (
              <article key={feature} className="threshold-card">
                <header>
                  <h3>{featureName(feature)}</h3>
                  <span>
                    Ngưỡng ≈{' '}
                    <strong>
                      {num(t.threshold, 1)} {units[feature]}
                    </strong>
                  </span>
                </header>
                <LineChart
                  label={`Tỷ lệ mua cao theo ${featureName(feature)}`}
                  yLabel="% lớp Cao"
                  yDomain={[0, 100]}
                  points={curve.map((p) => ({ x: p.median_value, y: p.high_percent }))}
                  reference={t.threshold === null ? undefined : { x: t.threshold, text: 'ngưỡng' }}
                />
                <p>
                  Nhóm thấp nhất: {pct(first, 0)} mua cao → nhóm cao nhất: {pct(last, 0)}. Trung vị
                  của khách mua cao: {num(t.median_high_class, 1)} {units[feature]} (toàn bộ:{' '}
                  {num(t.median_all, 1)}).
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel insight-section">
        <div className="panel-heading">
          <h2>Chân dung ba phân khúc khách hàng</h2>
          <span className="subtle-tag">
            K-Means T5 · Cramér&apos;s V với rời bỏ = {num(segments.cramers_v_churn, 2)}
          </span>
        </div>
        <p className="insight-lead">
          Phân khúc được tìm bằng K-Means trên 10 thuộc tính hành vi. Tỷ lệ rời bỏ <em>không</em>{' '}
          được đưa vào mô hình phân nhóm, nên sự khác biệt rời bỏ giữa các nhóm là một kiểm chứng
          độc lập về ý nghĩa kinh doanh của phân khúc.
        </p>
        <div className="segment-grid">
          {segments.items.map((segment) => (
            <article key={segment.name} className="segment-card">
              <header>
                <h3>{segment.name}</h3>
                <span>
                  {pct(segment.share_percent)} · {num(segment.rows, 0)} bản ghi
                </span>
              </header>
              <ShareBar
                label={`Cơ cấu mức mua của ${segment.name}: ${CLASS_ORDER.map((c) => `${classLabel[c]} ${pct(segment.purchase_level_percent[c])}`).join(', ')}`}
                parts={CLASS_ORDER.map((c) => ({
                  key: c,
                  value: segment.purchase_level_percent[c],
                  color: classColor[c],
                  title: `${classLabel[c]}: ${pct(segment.purchase_level_percent[c])}`,
                }))}
              />
              <p className="share-caption">
                {CLASS_ORDER.map(
                  (c) => `${classLabel[c]} ${pct(segment.purchase_level_percent[c], 0)}`,
                ).join(' · ')}
              </p>
              <div
                className={`churn-chip ${segment.churn_rate_percent > segments.overall_churn_rate_percent ? 'risk' : 'ok'}`}
              >
                Rời bỏ <strong>{pct(segment.churn_rate_percent)}</strong>
                <small>chung {pct(segments.overall_churn_rate_percent)}</small>
              </div>
              <dl>
                {(
                  [
                    'Login_Frequency',
                    'Session_Duration_Avg',
                    'Pages_Per_Session',
                    'Cart_Abandonment_Rate',
                  ] as const
                ).map((feature) => (
                  <div key={feature}>
                    <dt>{featureName(feature)}</dt>
                    <dd>
                      {num(segment.medians[feature], 1)} {units[feature]}
                    </dd>
                  </div>
                ))}
              </dl>
              <h4>{segment.goal}</h4>
              <ul>
                {segment.actions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p className="insight-note">
          Giá trị đơn hàng trung bình (~{num(segments.items[0]?.medians.Average_Order_Value, 0)}) và
          tỷ lệ dùng giảm giá (~{pct(segments.items[0]?.medians.Discount_Usage_Rate, 0)}) gần như
          bằng nhau giữa ba nhóm: khác biệt nằm ở tần suất và độ sâu tương tác, không ở giá trị mỗi
          lần mua. Gợi ý hành động là suy luận từ liên hệ thống kê, cần thử nghiệm A/B trước khi áp
          dụng.
        </p>
      </section>

      <div className="insight-two-col">
        <section className="panel insight-section">
          <div className="panel-heading">
            <h2>Quý đăng ký và số lượt mua</h2>
            <span className="subtle-tag">Trung bình lượt mua</span>
          </div>
          <BarList
            label="Lượt mua trung bình theo quý đăng ký"
            max={quarterMax}
            rows={eda.signup_quarter.map((q) => ({
              key: q.quarter,
              label: q.quarter,
              value: q.mean_purchases,
              display: num(q.mean_purchases, 1),
            }))}
          />
          <p className="insight-note">
            Khách đăng ký vào quý 4 mua nhiều hơn rõ rệt — phù hợp giả thuyết mùa mua sắm cuối năm,
            nhưng dữ liệu không có thời gian sự kiện để kiểm chứng nhân quả.
          </p>
        </section>
        <section className="panel insight-section">
          <div className="panel-heading">
            <h2>Trung vị hành vi theo mức mua</h2>
            <span className="subtle-tag">{num(total, 0)} bản ghi</span>
          </div>
          <div
            className="insight-table"
            role="region"
            aria-label="Trung vị hành vi theo mức mua"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Hành vi</th>
                  {CLASS_ORDER.map((c) => (
                    <th key={c} scope="col">
                      {classLabel[c]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(eda.median_by_level).map(([feature, row]) => (
                  <tr key={feature}>
                    <th scope="row">{featureName(feature)}</th>
                    {CLASS_ORDER.map((c) => (
                      <td key={c}>{num(row[c], 1)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="panel insight-footer">
        <p>
          Nguồn: <code>reports/r2</code> (thực nghiệm R2), xuất bởi{' '}
          <code>{research.generator}</code>. Dữ liệu dạng snapshot, không có định danh khách hàng
          hay thời gian sự kiện: các kết quả là liên hệ tại cùng thời điểm, không phải dự báo tương
          lai hay bằng chứng nhân quả. Xem độ chính xác và giới hạn của mô hình tại{' '}
          <Link to="/model-report">Kết quả mô hình</Link>.
        </p>
      </section>
    </div>
  );
}
