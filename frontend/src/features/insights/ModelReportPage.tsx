import { Link } from 'react-router-dom';
import { AlertTriangle, ClipboardCheck, Lock, Scale } from 'lucide-react';
import { labels } from '../predictions/prediction';
import { ModelLab } from '../explorer/ModelLab';
import '../explorer/explorer.css';
import { BarList, ConfusionMatrix, Kpi } from './charts';
import { CLASS_ORDER, classLabel, fixed, modelLabel, num, pValue, pct, research } from './insights';
import './insights.css';

const dateTime = (iso: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(iso));

function ComparisonTable({ featureSet }: { featureSet: 'conservative12' | 'full24' }) {
  const rows = research.models.summary
    .filter((row) => row.feature_set === featureSet)
    .sort((a, b) => b.macro_f1_mean - a.macro_f1_mean);
  const test = research.models.tests[featureSet];
  const ranks = test.average_rank as Record<string, number>;
  const versus = test.versus as Record<
    string,
    { difference: number; wins: number; comparisons: number; p_holm: number }
  >;
  return (
    <div
      className="insight-table"
      role="region"
      aria-label={`So sánh mô hình ${featureSet}`}
      tabIndex={0}
    >
      <table>
        <thead>
          <tr>
            <th scope="col">Mô hình</th>
            <th scope="col">Macro F1 (TB ± SD)</th>
            <th scope="col">Accuracy</th>
            <th scope="col">F1 lớp TB</th>
            <th scope="col">ROC-AUC</th>
            <th scope="col">Log loss</th>
            <th scope="col">Hạng TB</th>
            <th scope="col">So với tốt nhất</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const v = versus[row.model];
            return (
              <tr key={row.model} className={row.model === test.best ? 'best-row' : undefined}>
                <th scope="row">{modelLabel[row.model] ?? row.model}</th>
                <td>
                  <strong>{fixed(row.macro_f1_mean, 4)}</strong> ± {fixed(row.macro_f1_std, 4)}
                </td>
                <td>{fixed(row.accuracy_mean, 4)}</td>
                <td>{fixed(row.medium_f1_mean, 4)}</td>
                <td>{fixed(row.macro_roc_auc_ovr_mean, 4)}</td>
                <td>{fixed(row.log_loss_mean, 4)}</td>
                <td>{num(ranks[row.model], 2)}</td>
                <td>
                  {v ? (
                    <span className={v.p_holm < 0.05 ? 'sig' : 'nonsig'}>
                      −{fixed(v.difference, 4)} · {pValue(v.p_holm)}
                    </span>
                  ) : (
                    <span className="sig">Tốt nhất</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ModelReportPage() {
  const { holdout, models, leakage, shap, dataset } = research;
  const main = holdout.conservative12;
  const reference = holdout.full24;
  const vi = CLASS_ORDER.map((c) => classLabel[c]);
  const t12 = models.tests.conservative12;
  const xgbF1 = (featureSet: string, model: string) =>
    models.summary.find((s) => s.feature_set === featureSet && s.model === model)?.macro_f1_mean ??
    0;
  const errorMax = Math.max(...main.error_by_threshold_distance.map((b) => b.error_rate));

  return (
    <div className="insights-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">NGHIÊN CỨU · MODEL CARD</span>
          <h1>Kết quả mô hình</h1>
          <p>
            Độ chính xác, so sánh thuật toán, kiểm định thống kê và giới hạn của mô hình dự đoán mức
            mua hàng đang dùng trong hệ thống.
          </p>
        </div>
        <span className="scope-badge">
          <ClipboardCheck size={14} />
          XGBoost T4 · 12 thuộc tính
        </span>
      </div>

      <section className="insight-kpis" aria-label="Kết quả trên tập kiểm tra">
        <Kpi
          label="Macro F1 (holdout)"
          value={fixed(main.metrics.macro_f1, 3)}
          hint={`KTC 95%: ${fixed(main.ci95.macro_f1.low, 3)} – ${fixed(main.ci95.macro_f1.high, 3)}`}
        />
        <Kpi
          label="Accuracy (holdout)"
          value={pct(100 * main.metrics.accuracy)}
          hint={`KTC 95%: ${pct(100 * main.ci95.accuracy.low)} – ${pct(100 * main.ci95.accuracy.high)}`}
        />
        <Kpi
          label="ROC-AUC (OvR)"
          value={fixed(main.metrics.macro_roc_auc_ovr, 3)}
          hint="Khả năng xếp hạng"
        />
        <Kpi
          label="Sai số hiệu chỉnh (ECE)"
          value={pct(100 * main.metrics.top_label_ece_10_bins, 2)}
          hint="Xác suất dự đoán sát thực tế"
        />
        <Kpi
          label="Holdout"
          value={num(holdout.rows, 0)}
          hint={`/${num(dataset.research_rows, 0)} bản ghi`}
        />
      </section>

      <section className="panel insight-section">
        <div className="panel-heading">
          <h2>Đánh giá trên tập holdout</h2>
          <span className="subtle-tag">
            <Lock size={11} /> Chấm một lần · protocol khóa trước
          </span>
        </div>
        <div className="insight-two-col tight">
          <div>
            <ConfusionMatrix
              matrix={main.confusion_matrix}
              labels={vi}
              caption={`Ma trận nhầm lẫn trên ${num(holdout.rows, 0)} bản ghi holdout`}
            />
            <p className="insight-note">
              Mô hình hầu như không nhầm giữa hai lớp ngoài cùng: chỉ{' '}
              {num(main.confusion_matrix[0]?.[2], 0)} khách mua Thấp bị đoán Cao. Lớp Trung bình khó
              nhất (F1 {fixed(main.per_class_f1.Medium, 3)}) vì nằm kẹp giữa hai ngưỡng.
            </p>
          </div>
          <div>
            <h3 className="insight-h3">Tỷ lệ lỗi theo khoảng cách tới ngưỡng 10 / 15 lượt mua</h3>
            <BarList
              label="Tỷ lệ lỗi theo khoảng cách tới ngưỡng"
              max={errorMax}
              rows={main.error_by_threshold_distance.map((b) => ({
                key: b.distance_to_nearest_threshold,
                label: `Cách ${b.distance_to_nearest_threshold.replace(';', '–').replace('+inf', '∞')}`,
                value: b.error_rate,
                display: `${pct(100 * b.error_rate, 0)} · n=${num(b.rows, 0)}`,
              }))}
            />
            <p className="insight-note">
              Lỗi tập trung ở khách sát ngưỡng phân lớp: đây chủ yếu là lỗi biên do chia một biến
              liên tục thành ba mức, không phải phân loại sai thô.
            </p>
            <h3 className="insight-h3">F1 theo lớp</h3>
            <BarList
              label="F1 theo lớp"
              max={1}
              rows={CLASS_ORDER.map((c) => ({
                key: c,
                label: classLabel[c],
                value: main.per_class_f1[c],
                display: fixed(main.per_class_f1[c], 3),
              }))}
            />
          </div>
        </div>
        <p className="insight-note">
          Protocol khóa lúc {dateTime(holdout.protocol_locked_at)}, chấm lúc{' '}
          {dateTime(holdout.scored_at)} (giờ TP.HCM); khoảng tin cậy bootstrap{' '}
          {num(holdout.bootstrap, 0)} mẫu. Holdout từng được dùng ở notebook lịch sử với mô hình 24
          thuộc tính, nên không phải cohort độc lập bên ngoài; với pipeline T4 đây là lần chấm đầu
          tiên.
        </p>
      </section>

      <section className="panel insight-section">
        <div className="panel-heading">
          <h2>So sánh thuật toán (protocol train-only, 3 × 5-fold CV)</h2>
          <span className="subtle-tag">
            <Scale size={11} /> Friedman {pValue(t12.friedman_p)}
          </span>
        </div>
        <p className="insight-lead">
          Bốn thuật toán dùng cùng pipeline tiền xử lý fit trong từng fold, trên 39.968 bản ghi
          train. Cột cuối: chênh Macro F1 so với mô hình tốt nhất và p-value của corrected resampled
          t-test (Nadeau–Bengio) đã hiệu chỉnh Holm; màu xanh là khác biệt có ý nghĩa ở mức 0,05.
        </p>
        <ComparisonTable featureSet="conservative12" />
        <p className="insight-note">
          XGBoost xếp hạng nhất ổn định và có log loss tốt nhất, nhưng chỉ hơn RF/MLP khoảng 0,4
          điểm phần trăm — khác biệt chưa có ý nghĩa thống kê. XGBoost được chọn vì ổn định, nhanh
          và xác suất được hiệu chỉnh tốt. Cả bốn thuật toán đều quanh 0,69: giới hạn nằm ở lượng
          thông tin của 12 thuộc tính, không ở thuật toán.
        </p>
      </section>

      <ModelLab />

      <section className="panel insight-section leakage">
        <div className="panel-heading">
          <h2>
            <AlertTriangle size={16} /> Vì sao không dùng mô hình 24 thuộc tính (F1 ≈{' '}
            {fixed(reference.metrics.macro_f1, 2)})?
          </h2>
          <span className="subtle-tag">Bằng chứng rò rỉ nhãn</span>
        </div>
        <div className="insight-two-col tight">
          <div>
            <p className="insight-lead">
              Nhãn mức mua được tạo từ <strong>Total_Purchases</strong>. Thuộc tính Lifetime_Value
              (LTV) gần như được tính từ chính số lượt mua nhân giá trị đơn hàng (AOV):
            </p>
            <ul className="evidence">
              <li>
                Spearman(LTV / AOV, Total_Purchases) ={' '}
                <strong>{fixed(leakage.spearman_ltv_over_aov, 3)}</strong> (LTV một mình:{' '}
                {fixed(leakage.spearman_ltv, 3)})
              </li>
              <li>
                LTV / (AOV × Total_Purchases): trung vị{' '}
                <strong>{fixed(leakage.ratio_quantiles['50%'], 2)}</strong>, 90% nằm trong{' '}
                {fixed(leakage.ratio_quantiles['5%'], 2)}–{fixed(leakage.ratio_quantiles['95%'], 2)}
                , tối đa {fixed(leakage.ratio_quantiles.max, 2)}
              </li>
              <li>
                Thêm 12 thuộc tính bị cách ly làm Macro F1 của XGBoost tăng{' '}
                {fixed(models.feature_set_gain.XGBoost, 3)} (CV:{' '}
                {fixed(xgbF1('conservative12', 'XGBoost'), 3)} →{' '}
                {fixed(xgbF1('full24', 'XGBoost'), 3)}).
              </li>
            </ul>
            <p className="insight-note">
              Mô hình 24 thuộc tính đạt điểm cao vì “tính ngược” ra số lượt mua từ LTV/AOV, không vì
              hiểu hành vi. Mô hình 12 thuộc tính có điểm thấp hơn nhưng học từ hành vi tương tác —
              đúng mục tiêu phân tích hành vi của đề tài.
            </p>
          </div>
          <div>
            <h3 className="insight-h3">Ảnh hưởng SHAP của mô hình 24 thuộc tính</h3>
            <BarList
              label="Xếp hạng SHAP của mô hình 24 thuộc tính"
              rows={shap.full24_ranking.map((row) => ({
                key: row.feature,
                label: labels[row.feature] ?? row.feature,
                value: row.share_percent,
                display: `${pct(row.share_percent)}${row.direction_high !== null && row.direction_high < 0 ? ' (−)' : ''}`,
                muted: !['Lifetime_Value', 'Average_Order_Value'].includes(row.feature),
              }))}
            />
            <p className="insight-note">
              LTV đóng góp dương còn AOV đóng góp âm (−): mô hình đang “chia” LTV cho AOV.
            </p>
          </div>
        </div>
      </section>

      <section className="panel insight-section">
        <div className="panel-heading">
          <h2>Độ tin cậy của xác suất</h2>
          <span className="subtle-tag">Reliability · 10 bin</span>
        </div>
        <div
          className="insight-table"
          role="region"
          aria-label="Bảng hiệu chỉnh xác suất"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Độ tự tin dự đoán</th>
                <th scope="col">Số bản ghi</th>
                <th scope="col">Tự tin TB</th>
                <th scope="col">Tỷ lệ đúng thực tế</th>
              </tr>
            </thead>
            <tbody>
              {main.reliability_bins
                .filter((b) => b.count > 0)
                .map((b) => (
                  <tr key={b.lower}>
                    <th scope="row">
                      {pct(100 * b.lower, 0)}–{pct(100 * b.upper, 0)}
                    </th>
                    <td>{num(b.count, 0)}</td>
                    <td>{pct(100 * (b.confidence ?? 0))}</td>
                    <td>{pct(100 * (b.accuracy ?? 0))}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="insight-note">
          Khi mô hình tự tin khoảng 70%, tỷ lệ đúng thực tế cũng xấp xỉ 70%: xác suất hiển thị trên
          giao diện có thể hiểu gần đúng theo nghĩa tần suất (ECE{' '}
          {pct(100 * main.metrics.top_label_ece_10_bins, 2)}), dù không qua bước hiệu chỉnh riêng.
        </p>
      </section>

      <section className="panel insight-section">
        <div className="panel-heading">
          <h2>Giới hạn cần biết</h2>
        </div>
        <ul className="limitations">
          <li>
            Dữ liệu dạng snapshot, không có mã khách hàng hay thời gian sự kiện: mô hình ước lượng
            mức mua tại cùng thời điểm, không dự báo hành vi tương lai.
          </li>
          <li>
            Holdout từng được dùng trong thí nghiệm lịch sử; chưa có cohort độc lập bên ngoài.
          </li>
          <li>
            Dataset có dấu hiệu được sinh tổng hợp (quan hệ LTV ≈ lượt mua × AOV × nhiễu bị chặn):
            kết luận hành vi có giá trị minh họa phương pháp, cần dữ liệu vận hành thật để khẳng
            định.
          </li>
          <li>SHAP, phân khúc và What-if mô tả liên hệ thống kê, không chứng minh nhân quả.</li>
        </ul>
        <p className="insight-note">
          Chi tiết phương pháp: <code>docs/research_results_r2.md</code>. Phân tích hành vi:{' '}
          <Link to="/insights">Phân tích hành vi mua hàng</Link>.
        </p>
      </section>
    </div>
  );
}
