import { useState } from 'react';
import { FlaskConical, Gauge, Scale, Target } from 'lucide-react';
import { ConfusionMatrix, Kpi } from '../insights/charts';
import { CLASS_ORDER, classLabel, fixed, num, pValue, pct } from '../insights/insights';
import { Chips, ColumnChart, DotStrip, Legend } from './charts';
import {
  FEATURE_SETS,
  MODEL_COLORS,
  T4,
  acceptedScores,
  featureSetLabel,
  foldValues,
  lowerIsBetter,
  mean,
  metricLabel,
  modelLab as lab,
  pairs,
  runLabel,
  runs,
  type Metric,
} from './labData';

function format(metric: string) {
  return (v: number) => (metric === 'fit_seconds' ? num(v, 1) : fixed(v, 3));
}

function FoldComparison({ metric, sets }: { metric: Metric; sets: string[] }) {
  const rows = runs
    .filter((run) => sets.includes(run.feature_set))
    .map((run) => ({
      key: run.id,
      label: runLabel(run),
      color: MODEL_COLORS[run.model] ?? 'var(--chart-1)',
      values: foldValues(run, metric).filter((v): v is number => v !== null),
      emphasis: run.id === T4,
    }))
    .sort((a, b) =>
      lowerIsBetter(metric) ? mean(a.values) - mean(b.values) : mean(b.values) - mean(a.values),
    );
  return (
    <DotStrip
      rows={rows}
      label={`${metricLabel[metric]} của từng lần chia`}
      format={format(metric)}
    />
  );
}

function HeadToHead({ metric }: { metric: Metric }) {
  const [a, setA] = useState(T4);
  const [b, setB] = useState('conservative12:MLP');
  const runA = runs.find((r) => r.id === a);
  const runB = runs.find((r) => r.id === b);
  const pair = pairs.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));
  const flipped = pair?.a === b;
  const stats = pair?.metrics[metric];
  const differences =
    runA && runB
      ? foldValues(runA, metric).map((v, i) =>
          v === null || foldValues(runB, metric)[i] === null
            ? null
            : v - (foldValues(runB, metric)[i] ?? 0),
        )
      : [];
  const folds = lab.protocol.repeats * lab.protocol.folds_per_repeat;
  const difference = stats ? (flipped ? -1 : 1) * (stats.mean_difference ?? 0) : null;
  const winsA = stats ? (flipped ? folds - stats.a_wins - stats.ties : stats.a_wins) : 0;
  const better =
    difference === null ? null : lowerIsBetter(metric) ? difference < 0 : difference > 0;
  return (
    <div className="x-h2h">
      <div className="x-controls">
        {(
          [
            ['Mô hình A', a, setA],
            ['Mô hình B', b, setB],
          ] as const
        ).map(([text, value, set]) => (
          <label key={text}>
            {text}
            <select value={value} onChange={(e) => set(e.target.value)}>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {runLabel(run)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {a === b || !runA || !runB || !stats ? (
        <p className="insight-lead">Chọn hai cấu hình khác nhau để so sánh.</p>
      ) : (
        <>
          <section className="insight-kpis" aria-label="Kết quả đối đầu">
            <Kpi
              label={`Chênh lệch TB (A − B) · ${metricLabel[metric]}`}
              value={format(metric)(difference ?? 0)}
              hint={better ? 'A tốt hơn B' : difference === 0 ? 'Bằng nhau' : 'B tốt hơn A'}
            />
            <Kpi
              label="Số lần A thắng"
              value={`${winsA} / ${folds}`}
              hint={`${lab.protocol.repeats} lần lặp × ${lab.protocol.folds_per_repeat} fold`}
            />
            <Kpi
              label="Kiểm định Nadeau–Bengio"
              value={pValue(stats.p_value)}
              hint={`t = ${fixed(stats.t === null ? null : (flipped ? -1 : 1) * stats.t, 2)}, bậc tự do ${folds - 1}`}
            />
          </section>
          <p className={`x-verdict ${stats.p_value < 0.05 ? 'sig' : 'nonsig'}`} role="status">
            {stats.p_value < 0.05
              ? `Khác biệt có ý nghĩa thống kê ở mức 5%: ${better ? runLabel(runA) : runLabel(runB)} tốt hơn.`
              : 'Chưa đủ bằng chứng để nói hai cấu hình khác nhau: chênh lệch nằm trong mức dao động giữa các lần chia.'}
          </p>
          <ColumnChart
            categories={runA.folds.map((f) => `L${f.repeat + 1}·F${f.fold}`)}
            series={[{ key: 'diff', label: 'A − B', color: 'var(--chart-2)', values: differences }]}
            mode="bars"
            label="Chênh lệch theo từng lần chia"
            yLabel="A − B"
            yFormat={format(metric)}
            height={200}
            everyLabel={1}
          />
        </>
      )}
      <p className="insight-note">
        Kiểm định t hiệu chỉnh Nadeau–Bengio tính đến việc các fold dùng chung dữ liệu huấn luyện (
        {num(lab.protocol.fit_rows, 0)} dòng huấn luyện, {num(lab.protocol.validation_rows, 0)} dòng
        kiểm tra mỗi fold). Giá trị p ở đây chưa hiệu chỉnh đa so sánh; bảng tổng hợp phía trên dùng
        hiệu chỉnh Holm.
      </p>
    </div>
  );
}

function ConfidenceSection() {
  const curve = lab.oof.confidence_curve;
  const [index, setIndex] = useState(0);
  const point = curve[index] ?? curve[0]!;
  const total = lab.oof.rows;
  const scores = acceptedScores(point.matrix, total);
  const series = curve.map((c) => acceptedScores(c.matrix, total));
  const purchases = lab.oof.error_by_total_purchases.filter((row) => row.rows >= 30);
  const base = purchases[0]?.total_purchases ?? 0;
  return (
    <>
      <div className="x-two">
        <div>
          <label className="x-slider">
            Chỉ chấp nhận dự đoán có xác suất lớp cao nhất ≥{' '}
            <strong>{pct(100 * point.threshold, 0)}</strong>
            <input
              type="range"
              min={0}
              max={curve.length - 1}
              value={index}
              onChange={(e) => setIndex(Number(e.target.value))}
              aria-label="Ngưỡng tin cậy"
            />
          </label>
          <section className="insight-kpis" aria-label="Kết quả theo ngưỡng tin cậy">
            <Kpi
              label="Tỷ lệ được tự động xử lý"
              value={pct(100 * scores.coverage, 1)}
              hint={`${num(scores.accepted, 0)} / ${num(total, 0)} bản ghi`}
            />
            <Kpi
              label="Accuracy phần được chấp nhận"
              value={scores.accuracy === null ? '—' : pct(100 * scores.accuracy, 1)}
            />
            <Kpi
              label="Macro F1 phần được chấp nhận"
              value={fixed(scores.macroF1, 3)}
              hint={`Toàn bộ: ${fixed(lab.oof.macro_f1, 3)}`}
            />
          </section>
          <ConfusionMatrix
            matrix={point.matrix}
            labels={CLASS_ORDER.map((c) => classLabel[c])}
            caption={`Ma trận nhầm lẫn của phần được chấp nhận (ngưỡng ${pct(100 * point.threshold, 0)})`}
          />
        </div>
        <div>
          <Legend
            items={[
              { key: 'cov', label: 'Tỷ lệ được chấp nhận', color: 'var(--chart-2)' },
              { key: 'acc', label: 'Accuracy phần được chấp nhận', color: 'var(--insight-high)' },
            ]}
          />
          <ColumnChart
            categories={curve.map((c) => pct(100 * c.threshold, 0))}
            series={[
              {
                key: 'cov',
                label: 'Tỷ lệ chấp nhận',
                color: 'var(--chart-2)',
                values: series.map((s) => 100 * s.coverage),
              },
              {
                key: 'acc',
                label: 'Accuracy',
                color: 'var(--insight-high)',
                values: series.map((s) => (s.accuracy === null ? null : 100 * s.accuracy)),
              },
            ]}
            mode="lines"
            label="Đánh đổi giữa tỷ lệ chấp nhận và độ chính xác"
            yLabel="%"
            yFormat={(v) => `${num(v, 0)}%`}
            references={[{ at: index, text: 'Đang chọn' }]}
            height={250}
          />
        </div>
      </div>
      <p className="insight-note">
        Dự đoán ngoài fold (out-of-fold) của mô hình T4 trên {num(total, 0)} bản ghi train: mỗi bản
        ghi được dự đoán bởi mô hình chưa từng thấy nó. Cách dùng thực tế: dự đoán đủ tự tin thì
        dùng ngay, phần còn lại chuyển người xem xét. Đây không phải tập holdout.
      </p>
      <h3 className="insight-h3">Tỷ lệ lỗi theo Total_Purchases (OOF)</h3>
      <ColumnChart
        categories={purchases.map((row) =>
          row.total_purchases >= 30 ? '30+' : String(row.total_purchases),
        )}
        series={[
          {
            key: 'err',
            label: 'Tỷ lệ lỗi',
            color: 'var(--insight-risk)',
            values: purchases.map((row) => 100 * (row.error_rate ?? 0)),
          },
        ]}
        mode="bars"
        label="Tỷ lệ lỗi theo tổng lượt mua"
        yLabel="% dự đoán sai"
        yFormat={(v) => `${num(v, 0)}%`}
        references={[
          { at: 10 - base, text: 'ranh giới 10' },
          { at: 15 - base, text: 'ranh giới 15' },
        ]}
        height={220}
        everyLabel={2}
      />
      <p className="insight-note">
        Mô hình chính không được xem Total_Purchases (vì nhãn được tạo trực tiếp từ nó). Lỗi tập
        trung ở dải khoảng 9–19 lượt mua, tức lớp Trung bình hẹp kẹp giữa hai ranh giới 10 và 15; ở
        hai đầu (khoảng 5 lượt trở xuống hoặc 26 trở lên) tỷ lệ lỗi thường dưới 10%. Lượt mua làm
        tròn xuống; cột cuối gộp từ 30 trở lên; nhóm dưới 30 bản ghi được bỏ qua.
      </p>
    </>
  );
}

export function ModelLab() {
  const [metric, setMetric] = useState<Metric>('macro_f1');
  const [sets, setSets] = useState<string[]>(['conservative12']);
  return (
    <>
      <section className="panel insight-section" aria-labelledby="lab-folds">
        <div className="panel-heading">
          <h2 id="lab-folds">
            <FlaskConical size={16} /> So sánh tương tác theo từng lần chia
          </h2>
          <span className="subtle-tag">
            {lab.protocol.repeats} × {lab.protocol.folds_per_repeat} fold · tập train
          </span>
        </div>
        <div className="x-controls">
          <label>
            Chỉ số
            <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
              {lab.metrics.map((m) => (
                <option key={m} value={m}>
                  {metricLabel[m]} {lowerIsBetter(m) ? '(thấp hơn tốt hơn)' : ''}
                </option>
              ))}
            </select>
          </label>
          <Chips
            label="Bộ thuộc tính"
            options={FEATURE_SETS.map((fs, i) => ({ value: i, label: featureSetLabel[fs] ?? fs }))}
            selected={FEATURE_SETS.flatMap((fs, i) => (sets.includes(fs) ? [i] : []))}
            onToggle={(i) => {
              const fs = FEATURE_SETS[i];
              if (!fs) return;
              const next = sets.includes(fs) ? sets.filter((s) => s !== fs) : [...sets, fs];
              setSets(next.length ? next : [fs]);
            }}
          />
        </div>
        <FoldComparison metric={metric} sets={sets} />
        <p className="insight-note">
          Mỗi chấm là kết quả trên một fold kiểm tra; vạch đậm là trung bình, dải mờ là ±1 độ lệch
          chuẩn. Dòng in đậm là mô hình đang dùng (XGBoost T4). Bộ "Đầy đủ 24" có các thuộc tính sau
          kết quả như Lifetime_Value nên điểm cao hơn nhưng không dùng được trong thực tế.
        </p>
      </section>
      <section className="panel insight-section" aria-labelledby="lab-h2h">
        <div className="panel-heading">
          <h2 id="lab-h2h">
            <Scale size={16} /> Đối đầu hai cấu hình
          </h2>
          <span className="subtle-tag">{metricLabel[metric]}</span>
        </div>
        <HeadToHead metric={metric} />
      </section>
      <section className="panel insight-section" aria-labelledby="lab-conf">
        <div className="panel-heading">
          <h2 id="lab-conf">
            <Gauge size={16} /> Ngưỡng tin cậy và nơi mô hình sai
          </h2>
          <span className="subtle-tag">
            <Target size={12} /> {lab.oof.model}
          </span>
        </div>
        <ConfidenceSection />
      </section>
    </>
  );
}
