import { useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  Gauge,
  GitCompare,
  Layers,
  Lightbulb,
  Lock,
  Scale,
  Target,
  UsersRound,
} from 'lucide-react';
import { BarList, Kpi, ShareBar } from '../insights/charts';
import { fixed, modelLabel, num, pct, pValue } from '../insights/insights';
import { labels } from '../predictions/prediction';
import { ColumnChart, DotStrip, Legend } from '../explorer/charts';
import {
  RISK_ORDER,
  churnReport as report,
  riskColor,
  riskLabel,
  sourceLabel,
  thresholdIndex,
  thresholdPoint,
  type CurveSource,
} from './churn';
import '../insights/insights.css';
import '../explorer/explorer.css';
import './churn.css';

const featureName = (feature: string) => labels[feature] ?? feature;
const SET_LABEL: Record<string, string> = {
  behaviour21: '21 thuộc tính (mô hình chính)',
  reference22: '22 thuộc tính (tham chiếu, thêm số ngày từ lần mua cuối)',
};
const ALGORITHM_COLOR: Record<string, string> = {
  LogisticRegression: 'var(--insight-mid)',
  RandomForest: 'var(--insight-low)',
  XGBoost: 'var(--chart-2)',
};
const { model, holdout } = report;
const decisionIndex = thresholdIndex(model.decision_threshold);

function ComparisonSection() {
  const [featureSet, setFeatureSet] = useState<'behaviour21' | 'reference22'>('behaviour21');
  const { comparison } = report;
  const rows = comparison.rows.filter((r) => r.feature_set === featureSet);
  const best = Math.max(...rows.map((r) => r.roc_auc_mean));
  const rf = comparison.best_vs_others.RandomForest;
  const lr = comparison.best_vs_others.LogisticRegression;
  return (
    <section className="panel insight-section" aria-labelledby="k-compare">
      <div className="panel-heading">
        <h2 id="k-compare">
          <GitCompare size={16} /> So sánh thuật toán
        </h2>
        <span className="subtle-tag">Tập huấn luyện · 3 lần lặp × 5 fold = 15 lần chia</span>
      </div>
      <div className="x-controls">
        <label>
          Bộ thuộc tính
          <select
            value={featureSet}
            onChange={(e) => setFeatureSet(e.target.value as 'behaviour21' | 'reference22')}
          >
            <option value="behaviour21">{SET_LABEL.behaviour21}</option>
            <option value="reference22">{SET_LABEL.reference22}</option>
          </select>
        </label>
      </div>
      <DotStrip
        label="ROC-AUC của từng lần chia theo thuật toán"
        format={(v) => fixed(v, 3)}
        rows={rows.map((r) => ({
          key: r.config,
          label: modelLabel[r.model] ?? r.model,
          color: ALGORITHM_COLOR[r.model] ?? 'var(--chart-1)',
          values: r.fold_roc_auc,
          emphasis: r.roc_auc_mean === best,
        }))}
      />
      <div
        className="insight-table"
        role="region"
        aria-label="Bảng so sánh thuật toán"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Thuật toán</th>
              <th scope="col">ROC-AUC (TB ± SD)</th>
              <th scope="col">PR-AUC</th>
              <th scope="col">Lift 10%</th>
              <th scope="col">Brier</th>
              <th scope="col">ECE</th>
              <th scope="col">Huấn luyện (giây)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.config} className={r.roc_auc_mean === best ? 'best-row' : undefined}>
                <th scope="row">{modelLabel[r.model] ?? r.model}</th>
                <td>
                  {fixed(r.roc_auc_mean, 4)} ± {fixed(r.roc_auc_std, 4)}
                </td>
                <td>{fixed(r.pr_auc_mean, 3)}</td>
                <td>{fixed(r.lift_top10_mean, 2)}</td>
                <td>{fixed(r.brier_mean, 3)}</td>
                <td>{pct(100 * r.ece_mean, 1)}</td>
                <td>{num(r.fit_seconds_mean, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="insight-note">
        Mỗi chấm là ROC-AUC của một lần chia, vạch đứng là trung bình, dải mờ là ±1 độ lệch chuẩn.
        Trên bộ 21 thuộc tính, kiểm định Friedman cho thấy ba thuật toán khác nhau (χ² ={' '}
        {num(comparison.friedman.statistic, 1)}, {pValue(comparison.friedman.p_value)}). XGBoost
        thắng Random Forest {rf.best_wins}/{rf.comparisons} lần (chênh{' '}
        {fixed(rf.mean_difference, 4)}, Nadeau–Bengio hiệu chỉnh Holm {pValue(rf.holm_p_value)}) và
        Logistic Regression {lr.best_wins}/{lr.comparisons} lần (chênh{' '}
        {fixed(lr.mean_difference, 3)}). Thêm số ngày từ lần mua cuối làm ROC-AUC tăng{' '}
        {fixed(comparison.feature_set_effect.XGBoost, 3)} với XGBoost, nhưng biến này có rủi ro về
        thời điểm ghi nhận nên chỉ dùng làm tham chiếu.
      </p>
      <h3 className="insight-h3">Chọn cấu hình XGBoost (quy tắc định trước)</h3>
      <div className="insight-table" role="region" aria-label="Lưới cấu hình XGBoost" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">Độ sâu cây</th>
              <th scope="col">Tốc độ học</th>
              <th scope="col">ROC-AUC (TB ± SD)</th>
            </tr>
          </thead>
          <tbody>
            {comparison.grid.map((g) => (
              <tr
                key={g.config}
                className={g.config === comparison.grid_chosen ? 'best-row' : undefined}
              >
                <th scope="row">{g.max_depth}</th>
                <td>{num(g.learning_rate, 1)}</td>
                <td>
                  {fixed(g.roc_auc_mean, 4)} ± {fixed(g.roc_auc_std, 4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="insight-note">
        Cấu hình có ROC-AUC trung bình cao nhất được chọn ({model.hyperparameters.n_estimators} cây,
        độ sâu {model.hyperparameters.max_depth}, tốc độ học{' '}
        {num(model.hyperparameters.learning_rate, 1)}). Trọng số lớp (scale_pos_weight ={' '}
        {num(comparison.class_weighting.scale_pos_weight, 2)}) không làm ROC-AUC tăng và đẩy sai số
        hiệu chỉnh lên {pct(100 * comparison.class_weighting.ece_weighted, 1)}, nên không dùng.
      </p>
    </section>
  );
}

function ThresholdSection() {
  const [source, setSource] = useState<CurveSource>('holdout');
  const [index, setIndex] = useState(decisionIndex);
  const point = thresholdPoint(source, index);
  const chosen = thresholdPoint(source, decisionIndex);
  const per1000 = (value: number) => num((1000 * value) / point.rows, 0);
  const hist = report.curves.histogram_holdout;
  const binWidth = (hist.edges[1] ?? 0.05) - (hist.edges[0] ?? 0);
  return (
    <section className="panel insight-section" aria-labelledby="k-threshold">
      <div className="panel-heading">
        <h2 id="k-threshold">
          <Target size={16} /> Chọn ngưỡng cảnh báo
        </h2>
        <span className="subtle-tag">
          Ngưỡng của hệ thống {fixed(model.decision_threshold, 2)} (chọn trên tập huấn luyện)
        </span>
      </div>
      <div className="x-controls">
        <label>
          Dữ liệu
          <select value={source} onChange={(e) => setSource(e.target.value as CurveSource)}>
            <option value="holdout">{sourceLabel.holdout}</option>
            <option value="oof">{sourceLabel.oof}</option>
          </select>
        </label>
      </div>
      <label className="x-slider">
        Cảnh báo khách có xác suất rời bỏ ≥ <strong>{fixed(point.threshold, 2)}</strong>
        <input
          type="range"
          min={0}
          max={report.curves.thresholds.length - 1}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          aria-label="Ngưỡng cảnh báo"
        />
      </label>
      <section className="insight-kpis" aria-label="Kết quả theo ngưỡng cảnh báo">
        <Kpi
          label="Số khách cần liên hệ"
          value={num(point.contacted, 0)}
          hint={`${pct(100 * point.contactedShare, 1)} số khách · ${per1000(point.contacted)} / 1.000`}
        />
        <Kpi
          label="Độ chính xác (precision)"
          value={pct(point.precision === null ? null : 100 * point.precision, 1)}
          hint="Trong số khách được cảnh báo, bao nhiêu thật sự rời bỏ"
        />
        <Kpi
          label="Độ phủ (recall)"
          value={pct(100 * point.recall, 1)}
          hint={`Bắt được ${num(point.tp, 0)} / ${num(point.tp + point.fn, 0)} khách rời bỏ`}
        />
        <Kpi
          label="F1"
          value={fixed(point.f1, 3)}
          hint={`Tại ngưỡng ${fixed(model.decision_threshold, 2)}: ${fixed(chosen.f1, 3)}`}
        />
        <Kpi
          label="Bỏ sót"
          value={num(point.fn, 0)}
          hint={`Báo nhầm ${num(point.fp, 0)} khách còn hoạt động`}
        />
      </section>
      <h3 className="insight-h3">Phân bố xác suất dự đoán trên tập kiểm tra</h3>
      <Legend
        items={[
          { key: 'active', label: 'Còn hoạt động', color: 'var(--insight-ok)' },
          { key: 'churned', label: 'Đã rời bỏ', color: 'var(--insight-risk)' },
        ]}
      />
      <ColumnChart
        categories={hist.edges
          .slice(0, -1)
          .map((e, i) => `${fixed(e, 2)}–${fixed(hist.edges[i + 1] ?? e, 2)}`)}
        series={[
          {
            key: 'active',
            label: 'Còn hoạt động',
            color: 'var(--insight-ok)',
            values: hist.active,
          },
          {
            key: 'churned',
            label: 'Đã rời bỏ',
            color: 'var(--insight-risk)',
            values: hist.churned,
          },
        ]}
        mode="lines"
        label="Phân bố xác suất rời bỏ theo trạng thái thực tế"
        yLabel="Số khách"
        yFormat={(v) => num(v, 0)}
        references={[
          { at: point.threshold / binWidth - 0.5, text: `ngưỡng ${fixed(point.threshold, 2)}` },
        ]}
        everyLabel={2}
      />
      <p className="insight-note">
        Kéo ngưỡng để cân đối giữa liên hệ ít khách (độ chính xác cao) và bỏ sót ít khách (độ phủ
        cao). Ngưỡng {fixed(model.decision_threshold, 2)} của hệ thống được chọn trước khi chấm tập
        kiểm tra, là ngưỡng làm F1 lớn nhất trên dự đoán ngoài fold; thanh trượt ở đây chỉ để khám
        phá, không dùng để chọn lại ngưỡng trên tập kiểm tra.
      </p>
    </section>
  );
}

function LiftSection() {
  const [budget, setBudget] = useState(20);
  const gains = report.curves.gains_holdout;
  const captured = gains[budget - 1] ?? 0;
  const percents = Array.from({ length: 101 }, (_, i) => i);
  return (
    <section className="panel insight-section" aria-labelledby="k-lift">
      <div className="panel-heading">
        <h2 id="k-lift">
          <Gauge size={16} /> Lift và tỷ lệ bắt được
        </h2>
        <span className="subtle-tag">
          Tập kiểm tra · tỷ lệ rời bỏ chung {pct(100 * holdout.churn_rate, 1)}
        </span>
      </div>
      <div className="x-two">
        <div>
          <h3 className="insight-h3">Tỷ lệ rời bỏ thực tế theo thập phân vị rủi ro</h3>
          <ColumnChart
            categories={holdout.deciles.map((d) => `Nhóm ${d.decile}`)}
            series={[
              {
                key: 'rate',
                label: 'Tỷ lệ rời bỏ',
                color: 'var(--insight-risk)',
                values: holdout.deciles.map((d) => 100 * d.churn_rate),
              },
            ]}
            mode="bars"
            label="Tỷ lệ rời bỏ thực tế theo thập phân vị rủi ro"
            yLabel="% rời bỏ"
            yFormat={(v) => `${num(v, 0)}%`}
            everyLabel={1}
          />
        </div>
        <div>
          <h3 className="insight-h3">Đường tỷ lệ bắt được (gains)</h3>
          <ColumnChart
            categories={percents.map((p) => `${p}%`)}
            series={[
              {
                key: 'model',
                label: 'Mô hình rời bỏ',
                color: 'var(--chart-2)',
                values: [0, ...gains.map((g) => 100 * g)],
              },
              {
                key: 'random',
                label: 'Chọn ngẫu nhiên',
                color: 'var(--insight-mid)',
                values: percents,
              },
            ]}
            mode="lines"
            label="Tỷ lệ khách rời bỏ bắt được theo phần trăm khách liên hệ"
            yLabel="% khách rời bỏ bắt được"
            yFormat={(v) => `${num(v, 0)}%`}
            references={[{ at: budget, text: `${budget}%` }]}
            everyLabel={10}
          />
        </div>
      </div>
      <label className="x-slider">
        <span>
          Liên hệ <strong>{budget}%</strong> khách có rủi ro cao nhất
        </span>
        <input
          type="range"
          min={1}
          max={100}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          aria-label="Phần trăm khách liên hệ"
        />
      </label>
      <p className="insight-note" role="status">
        Liên hệ {budget}% khách ({num((holdout.rows * budget) / 100, 0)} người) bắt được{' '}
        <strong>{pct(100 * captured, 1)}</strong> số khách rời bỏ, gấp{' '}
        {num(captured / (budget / 100), 2)} lần chọn ngẫu nhiên.
      </p>
      <p className="insight-note">
        Nhóm 10% rủi ro cao nhất có {pct(100 * (holdout.deciles[0]?.churn_rate ?? 0), 1)} khách thật
        sự rời bỏ (lift {fixed(holdout.deciles[0]?.lift ?? null, 2)}). Đường tỷ lệ bắt được càng xa
        đường chéo, việc ưu tiên theo mô hình càng hiệu quả hơn chọn ngẫu nhiên.
      </p>
    </section>
  );
}

function RiskSection() {
  const bands = holdout.risk_bands as Record<
    string,
    {
      rows: number;
      share_percent: number;
      churn_rate_percent: number;
      churners_captured_percent: number;
    }
  >;
  const oofBands = report.oof.risk_bands as typeof bands;
  const { low_below: low, high_from: high } = model.risk_thresholds;
  const range: Record<string, string> = {
    low: `< ${fixed(low, 2)}`,
    medium: `${fixed(low, 2)} – < ${fixed(high, 2)}`,
    high: `≥ ${fixed(high, 2)}`,
  };
  return (
    <section className="panel insight-section" aria-labelledby="k-risk">
      <div className="panel-heading">
        <h2 id="k-risk">
          <Layers size={16} /> Ba mức rủi ro
        </h2>
        <span className="subtle-tag">Mốc tại phân vị 50% và 80% của dự đoán ngoài fold</span>
      </div>
      <h3 className="insight-h3">Tỷ trọng khách trên tập kiểm tra</h3>
      <ShareBar
        label={RISK_ORDER.map((r) => `${riskLabel[r]} ${pct(bands[r]?.share_percent, 1)}`).join(
          ', ',
        )}
        parts={RISK_ORDER.map((r) => ({
          key: r,
          value: bands[r]?.share_percent ?? 0,
          color: riskColor[r],
          title: `${riskLabel[r]}: ${pct(bands[r]?.share_percent, 1)}`,
        }))}
      />
      <Legend
        items={RISK_ORDER.map((r) => ({ key: r, label: riskLabel[r], color: riskColor[r] }))}
      />
      <div className="insight-table" role="region" aria-label="Bảng mức rủi ro" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">Mức</th>
              <th scope="col">Xác suất</th>
              <th scope="col">Tỷ trọng khách</th>
              <th scope="col">Tỷ lệ rời bỏ thực tế</th>
              <th scope="col">Chiếm % khách rời bỏ</th>
              <th scope="col">Tỷ lệ rời bỏ (ngoài fold)</th>
            </tr>
          </thead>
          <tbody>
            {RISK_ORDER.map((r) => (
              <tr key={r} className={r === 'high' ? 'best-row' : undefined}>
                <th scope="row">
                  <span className="churn-risk-dot" style={{ background: riskColor[r] }} />
                  {riskLabel[r]}
                </th>
                <td>{range[r]}</td>
                <td>{pct(bands[r]?.share_percent, 1)}</td>
                <td>{pct(bands[r]?.churn_rate_percent, 1)}</td>
                <td>{pct(bands[r]?.churners_captured_percent, 1)}</td>
                <td>{pct(oofBands[r]?.churn_rate_percent, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="insight-note">
        Mức Cao chỉ gồm {pct(bands.high?.share_percent, 0)} số khách nhưng chứa{' '}
        {pct(bands.high?.churners_captured_percent, 1)} khách rời bỏ. Tỷ lệ rời bỏ của từng mức trên
        tập kiểm tra gần như trùng với dự đoán ngoài fold, nên hai mốc rủi ro ổn định trên dữ liệu
        chưa từng thấy.
      </p>
    </section>
  );
}

function CalibrationSection() {
  const bins = holdout.reliability.filter((b) => b.count > 0);
  return (
    <section className="panel insight-section" aria-labelledby="k-calib">
      <div className="panel-heading">
        <h2 id="k-calib">
          <Scale size={16} /> Độ tin cậy của xác suất
        </h2>
        <span className="subtle-tag">
          ECE {pct(100 * holdout.primary.ece_10_bins, 1)} · 10 khoảng
        </span>
      </div>
      <Legend
        items={[
          { key: 'pred', label: 'Xác suất dự đoán trung bình', color: 'var(--insight-mid)' },
          { key: 'obs', label: 'Tỷ lệ rời bỏ thực tế', color: 'var(--chart-2)' },
        ]}
      />
      <ColumnChart
        categories={bins.map((b) => `${fixed(b.lower, 1)}–${fixed(b.upper, 1)}`)}
        series={[
          {
            key: 'pred',
            label: 'Xác suất dự đoán trung bình',
            color: 'var(--insight-mid)',
            values: bins.map((b) => 100 * b.mean_probability),
          },
          {
            key: 'obs',
            label: 'Tỷ lệ rời bỏ thực tế',
            color: 'var(--chart-2)',
            values: bins.map((b) => 100 * b.observed_rate),
          },
        ]}
        mode="lines"
        label="Đường hiệu chỉnh xác suất trên tập kiểm tra"
        yLabel="%"
        yFormat={(v) => `${num(v, 0)}%`}
        everyLabel={1}
      />
      <p className="insight-note">
        Hai đường gần như trùng nhau: khi mô hình nói "40% rời bỏ", khoảng 40% khách trong nhóm đó
        thật sự rời bỏ. Nhờ vậy xác suất có thể hiển thị trực tiếp cho người dùng mà không cần bước
        hiệu chỉnh riêng.
      </p>
    </section>
  );
}

function ShapSection() {
  const ranking = report.shap.ranking;
  const max = Math.max(...ranking.map((r) => r.share_percent));
  const direction = (d: number | null) =>
    d === null || Math.abs(d) < 0.3
      ? 'không đơn điệu'
      : d > 0
        ? 'cao → tăng nguy cơ'
        : 'cao → giảm nguy cơ';
  return (
    <section className="panel insight-section" aria-labelledby="k-shap">
      <div className="panel-heading">
        <h2 id="k-shap">
          <Lightbulb size={16} /> Yếu tố ảnh hưởng đến nguy cơ rời bỏ
        </h2>
        <span className="subtle-tag">
          TreeSHAP toàn cục · {num(model.fit_rows, 0)} bản ghi huấn luyện
        </span>
      </div>
      <BarList
        label="Xếp hạng mức ảnh hưởng SHAP đến nguy cơ rời bỏ"
        max={max}
        rows={ranking.map((r) => ({
          key: r.feature,
          label: (
            <>
              {featureName(r.feature)}
              <small className="churn-direction">{direction(r.direction)}</small>
            </>
          ),
          value: r.share_percent,
          display: pct(r.share_percent, 1),
          muted: r.share_percent < 2,
        }))}
      />
      <p className="insight-note">
        Tỷ trọng là phần trung bình |SHAP| của mỗi thuộc tính (các cột mã hóa one-hot được cộng về
        thuộc tính gốc). Chiều tác động lấy theo hệ số Spearman giữa giá trị thuộc tính và SHAP.
        Khác với mức mua (do tương tác chi phối), nguy cơ rời bỏ gắn với trải nghiệm: gọi hỗ trợ
        nhiều, bỏ giỏ nhiều, hoàn trả nhiều làm nguy cơ tăng; dùng giảm giá và mở email nhiều làm
        nguy cơ giảm. Đây là liên hệ thống kê, không phải quan hệ nhân quả.
      </p>
    </section>
  );
}

function SegmentSection() {
  return (
    <section className="panel insight-section" aria-labelledby="k-segment">
      <div className="panel-heading">
        <h2 id="k-segment">
          <UsersRound size={16} /> Nguy cơ rời bỏ theo phân khúc K-Means
        </h2>
        <span className="subtle-tag">Tập kiểm tra</span>
      </div>
      <div
        className="insight-table"
        role="region"
        aria-label="Nguy cơ rời bỏ theo phân khúc"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Phân khúc</th>
              <th scope="col">Số khách</th>
              <th scope="col">Xác suất rời bỏ TB</th>
              <th scope="col">Tỷ lệ rời bỏ thực tế</th>
              <th scope="col">Ở mức rủi ro Cao</th>
            </tr>
          </thead>
          <tbody>
            {holdout.by_segment.map((s) => (
              <tr key={s.segment}>
                <th scope="row">{s.segment}</th>
                <td>{num(s.rows, 0)}</td>
                <td>{pct(100 * s.mean_churn_probability, 1)}</td>
                <td>{pct(100 * s.observed_churn_rate, 1)}</td>
                <td>{pct(100 * s.high_risk_share, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="insight-note">
        Xác suất trung bình khớp tỷ lệ thực tế ở cả ba phân khúc. Ngay trong nhóm tương tác cao vẫn
        có {pct(100 * (holdout.by_segment[2]?.high_risk_share ?? 0), 0)} khách ở mức rủi ro Cao:
        phân khúc cho biết khách tương tác nhiều hay ít, còn mô hình rời bỏ chỉ ra ai trong mỗi nhóm
        đang có dấu hiệu rời đi.
      </p>
    </section>
  );
}

function ReferenceSection() {
  const ref = holdout.reference;
  const main = holdout.primary;
  const diff = holdout.paired_difference_roc_auc;
  const metrics = [
    { key: 'roc_auc', label: 'ROC-AUC', digits: 3 },
    { key: 'pr_auc', label: 'PR-AUC', digits: 3 },
    { key: 'f1', label: `F1 tại ngưỡng ${fixed(model.decision_threshold, 2)}`, digits: 3 },
    { key: 'precision', label: 'Precision', digits: 3 },
    { key: 'recall', label: 'Recall', digits: 3 },
    { key: 'brier', label: 'Brier', digits: 3 },
    { key: 'lift_top10', label: 'Lift 10%', digits: 2 },
  ] as const;
  const [[tn, fp], [fn, tp]] = holdout.confusion_matrix as [[number, number], [number, number]];
  return (
    <section className="panel insight-section" aria-labelledby="k-ref">
      <div className="panel-heading">
        <h2 id="k-ref">
          <Lock size={16} /> Chi tiết tập kiểm tra và mô hình tham chiếu
        </h2>
        <span className="subtle-tag">
          {num(holdout.rows, 0)} khách · mô hình khóa mã băm {model.artifact_sha256.slice(0, 8)}…
        </span>
      </div>
      <div className="x-two">
        <div className="insight-table" role="region" aria-label="Chính và tham chiếu" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th scope="col">Chỉ số</th>
                <th scope="col">Chính (21)</th>
                <th scope="col">Tham chiếu (22)</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.key}>
                  <th scope="row">{m.label}</th>
                  <td>{fixed(main[m.key], m.digits)}</td>
                  <td>{fixed(ref[m.key], m.digits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="insight-table" role="region" aria-label="Ma trận nhầm lẫn" tabIndex={0}>
          <table>
            <caption className="churn-caption">
              Ma trận nhầm lẫn tại ngưỡng {fixed(model.decision_threshold, 2)}
            </caption>
            <thead>
              <tr>
                <th scope="col">Thực tế \ Dự đoán</th>
                <th scope="col">Còn hoạt động</th>
                <th scope="col">Rời bỏ</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Còn hoạt động</th>
                <td>{num(tn, 0)}</td>
                <td>{num(fp, 0)}</td>
              </tr>
              <tr>
                <th scope="row">Rời bỏ</th>
                <td>{num(fn, 0)}</td>
                <td>{num(tp, 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p className="insight-note">
        Mô hình tham chiếu thêm số ngày từ lần mua cuối, ROC-AUC cao hơn {fixed(diff.mean, 3)}{' '}
        (khoảng tin cậy 95%: {fixed(diff.low, 3)}–{fixed(diff.high, 3)}). Hệ thống vẫn dùng mô hình
        21 thuộc tính vì chưa xác minh được biến này có được ghi nhận trước thời điểm rời bỏ hay
        không; dùng nó có thể khiến mô hình "nhìn thấy" kết quả.
      </p>
    </section>
  );
}

export default function ChurnReportPage() {
  const main = holdout.primary;
  const ci = holdout.ci95;
  const high = (
    holdout.risk_bands as Record<
      string,
      { churn_rate_percent: number; churners_captured_percent: number; share_percent: number }
    >
  ).high;
  return (
    <div className="insights-page explorer-page churn-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">NGHIÊN CỨU · DỰ BÁO RỜI BỎ</span>
          <h1>Dự báo nguy cơ rời bỏ</h1>
          <p>
            Mô hình XGBoost {model.model_version} ước lượng xác suất một khách hàng rời bỏ từ{' '}
            {model.input_features.length} chỉ số hành vi và hồ sơ, huấn luyện trên{' '}
            {num(model.fit_rows, 0)} bản ghi và đánh giá một lần trên {num(holdout.rows, 0)} bản ghi
            kiểm tra chưa từng dùng.
          </p>
        </div>
        <span className="scope-badge">
          <BookOpenCheck size={14} />
          Tập kiểm tra · chấm một lần
        </span>
      </div>
      <section className="insight-kpis" aria-label="Chỉ số trên tập kiểm tra">
        <Kpi
          label="ROC-AUC"
          value={fixed(main.roc_auc, 3)}
          hint={`KTC 95%: ${fixed(ci.roc_auc.low, 3)}–${fixed(ci.roc_auc.high, 3)}`}
        />
        <Kpi
          label="PR-AUC"
          value={fixed(main.pr_auc, 3)}
          hint={`Tỷ lệ rời bỏ chung ${pct(100 * holdout.churn_rate, 1)}`}
        />
        <Kpi
          label={`F1 tại ngưỡng ${fixed(model.decision_threshold, 2)}`}
          value={fixed(main.f1, 3)}
          hint={`Precision ${fixed(main.precision, 2)} · recall ${fixed(main.recall, 2)}`}
        />
        <Kpi
          label="Sai số hiệu chỉnh (ECE)"
          value={pct(100 * main.ece_10_bins, 1)}
          hint="Xác suất sát tỷ lệ thực tế"
        />
        <Kpi
          label="Mức rủi ro Cao"
          value={pct(high?.churn_rate_percent, 1)}
          hint={`rời bỏ thực tế · chứa ${pct(high?.churners_captured_percent, 1)} khách rời bỏ`}
        />
      </section>
      <section className="insight-findings" aria-label="Ba phát hiện chính">
        <article>
          <Target size={20} />
          <h2>Ưu tiên đúng người</h2>
          <p>
            10% khách rủi ro cao nhất có{' '}
            <strong>{pct(100 * (holdout.deciles[0]?.churn_rate ?? 0), 1)}</strong> thật sự rời bỏ;
            liên hệ 20% khách đầu danh sách bắt được{' '}
            <strong>{pct(100 * (report.curves.gains_holdout[19] ?? 0), 1)}</strong> số khách rời bỏ.
          </p>
        </article>
        <article>
          <Lightbulb size={20} />
          <h2>Rời bỏ gắn với trải nghiệm</h2>
          <p>
            Cuộc gọi hỗ trợ, tỷ lệ bỏ giỏ và giá trị đơn chiếm{' '}
            <strong>
              {pct(
                report.shap.ranking.slice(0, 3).reduce((s, r) => s + r.share_percent, 0),
                0,
              )}
            </strong>{' '}
            mức ảnh hưởng, khác với mức mua vốn do mức độ tương tác chi phối.
          </p>
        </article>
        <article>
          <UsersRound size={20} />
          <h2>Bổ sung cho phân khúc</h2>
          <p>
            Ngay trong nhóm tương tác cao vẫn có{' '}
            <strong>{pct(100 * (holdout.by_segment[2]?.high_risk_share ?? 0), 0)}</strong> khách ở
            mức rủi ro Cao, điều phân khúc K-Means không cho thấy.
          </p>
        </article>
      </section>
      <ComparisonSection />
      <ThresholdSection />
      <LiftSection />
      <RiskSection />
      <CalibrationSection />
      <ShapSection />
      <SegmentSection />
      <ReferenceSection />
      <section className="panel insight-section leakage" aria-labelledby="k-limits">
        <div className="panel-heading">
          <h2 id="k-limits">
            <AlertTriangle size={16} /> Giới hạn cần biết
          </h2>
        </div>
        <ul className="limitations">
          <li>
            Bộ dữ liệu không định nghĩa khoảng thời gian xác định rời bỏ: mô hình ước lượng trạng
            thái rời bỏ của một bản ghi snapshot, không dự báo thời điểm khách sẽ rời đi.
          </li>
          <li>
            Không dùng Lifetime_Value, Total_Purchases (dẫn xuất từ lịch sử mua) và số ngày từ lần
            mua cuối (chưa rõ thời điểm ghi nhận). Thời điểm ghi nhận của cuộc gọi hỗ trợ và hoàn
            trả cũng chưa được xác minh.
          </li>
          <li>
            Tập kiểm tra từng được dùng cho bài toán mức mua ở giai đoạn đầu, nhưng nhãn rời bỏ của
            nó chưa dùng cho bất kỳ quyết định nào trước lần chấm duy nhất.
          </li>
          <li>
            Dữ liệu có dấu hiệu sinh tổng hợp; kết quả minh họa phương pháp, cần đánh giá lại trên
            dữ liệu thật của doanh nghiệp trước khi dùng để ra quyết định.
          </li>
        </ul>
      </section>
    </div>
  );
}
