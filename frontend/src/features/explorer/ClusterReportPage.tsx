import { useMemo, useState } from 'react';
import { BookOpenCheck, Boxes, Crosshair, GitCompare, Orbit, Ruler, Waves } from 'lucide-react';
import { Kpi, ShareBar } from '../insights/charts';
import { CLASS_ORDER, classColor, classLabel, fixed, num, pct } from '../insights/insights';
import { labels } from '../predictions/prediction';
import { BoxRows, ColumnChart, HeatGrid, Legend, Scatter } from './charts';
import { tint } from './colors';
import report from './data/clusterReport.json';
import '../insights/insights.css';
import './explorer.css';

const SEGMENT_COLORS = ['var(--insight-low)', 'var(--insight-mid)', 'var(--insight-high)'];
const segmentColor = (index: number) => SEGMENT_COLORS[index] ?? 'var(--chart-1)';
const featureName = (feature: string) => labels[feature] ?? feature;

type Diagnostic = (typeof report.k_diagnostics)[number];
const K_METRICS: {
  key: keyof Diagnostic;
  label: string;
  better: 'cao' | 'thấp';
  digits: number;
}[] = [
  { key: 'silhouette_sample', label: 'Silhouette', better: 'cao', digits: 3 },
  { key: 'davies_bouldin', label: 'Davies–Bouldin', better: 'thấp', digits: 3 },
  { key: 'calinski_harabasz', label: 'Calinski–Harabasz', better: 'cao', digits: 0 },
  {
    key: 'assigned_squared_distance_sum',
    label: 'Tổng bình phương khoảng cách (elbow)',
    better: 'thấp',
    digits: 0,
  },
];

function KSection() {
  const [metric, setMetric] = useState<keyof Diagnostic>('silhouette_sample');
  const spec = K_METRICS.find((m) => m.key === metric) ?? K_METRICS[0]!;
  const rows = report.k_diagnostics;
  const chosen = rows.findIndex((r) => r.K === report.k);
  return (
    <section className="panel insight-section" aria-labelledby="c-k">
      <div className="panel-heading">
        <h2 id="c-k">
          <Ruler size={16} /> Chẩn đoán số cụm K
        </h2>
        <span className="subtle-tag">K = {report.k} cố định trước khi tính chỉ số</span>
      </div>
      <div className="x-controls">
        <label>
          Chỉ số
          <select value={metric} onChange={(e) => setMetric(e.target.value as keyof Diagnostic)}>
            {K_METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label} ({m.better} hơn tốt hơn)
              </option>
            ))}
          </select>
        </label>
      </div>
      <ColumnChart
        categories={rows.map((r) => `K = ${r.K}`)}
        series={[
          {
            key: String(metric),
            label: spec.label,
            color: 'var(--chart-2)',
            values: rows.map((r) => Number(r[metric])),
          },
        ]}
        mode="lines"
        label={`${spec.label} theo K`}
        yLabel={spec.label}
        yFormat={(v) => num(v, spec.digits)}
        references={[{ at: chosen, text: `K = ${report.k} (đang dùng)` }]}
        yMin={Math.min(...rows.map((r) => Number(r[metric]))) * 0.9}
        height={220}
        everyLabel={1}
      />
      <div className="insight-table" role="region" aria-label="Bảng chẩn đoán K" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">K</th>
              {K_METRICS.map((m) => (
                <th key={m.key} scope="col">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.K} className={r.K === report.k ? 'best-row' : undefined}>
                <th scope="row">{r.K}</th>
                {K_METRICS.map((m) => (
                  <td key={m.key}>{num(Number(r[m.key]), m.digits)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="insight-note">
        Theo protocol T5, K = 3 được chốt trước khi tính bất kỳ chỉ số nào (không tự chọn K theo
        điểm số). Silhouette cao nhất ở K = 2 nhưng hai cụm chỉ tách "tương tác thấp / cao"; K = 3
        có silhouette gần bằng K = 4, Davies–Bouldin thấp hơn K = 5–6 và cho ba mức tương tác dễ
        diễn giải. Silhouette khoảng 0,18 cho thấy các cụm chồng lấn: đây là phân khúc mô tả theo
        mức độ, không phải các nhóm tách biệt tự nhiên.
      </p>
    </section>
  );
}

function PcaSection() {
  const [colourBy, setColourBy] = useState<'segment' | 'level' | 'churned'>('segment');
  const [hidden, setHidden] = useState<number[]>([]);
  const { pca } = report;
  const groups =
    colourBy === 'segment'
      ? report.segments.map((s, i) => ({ label: s, color: segmentColor(i) }))
      : colourBy === 'level'
        ? CLASS_ORDER.map((c) => ({ label: `Mức mua ${classLabel[c]}`, color: classColor[c] }))
        : [
            { label: 'Không rời bỏ', color: 'var(--insight-ok)' },
            { label: 'Đã rời bỏ', color: 'var(--insight-risk)' },
          ];
  const codes =
    colourBy === 'segment'
      ? pca.points.segment
      : colourBy === 'level'
        ? pca.points.level
        : pca.points.churned;
  const points = useMemo(
    () =>
      pca.points.x
        .map((x, i) => ({ x, y: pca.points.y[i] ?? 0, g: codes[i] ?? 0 }))
        .filter((p) => !hidden.includes(p.g))
        .map((p) => ({ x: p.x, y: p.y, color: groups[p.g]?.color ?? 'var(--chart-1)' })),
    // groups is derived from colourBy
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [codes, hidden, colourBy, pca.points.x, pca.points.y],
  );
  const loadings = Object.entries(pca.loadings)
    .map(([feature, [pc1, pc2]]) => ({ feature, pc1: pc1 ?? 0, pc2: pc2 ?? 0 }))
    .sort((a, b) => Math.abs(b.pc1) - Math.abs(a.pc1));
  const [v1, v2] = pca.explained_variance_ratio;
  return (
    <section className="panel insight-section" aria-labelledby="c-pca">
      <div className="panel-heading">
        <h2 id="c-pca">
          <Orbit size={16} /> Chiếu PCA hai chiều
        </h2>
        <span className="subtle-tag">
          {num(pca.sample_rows, 0)} điểm mẫu · PC1 + PC2 giải thích{' '}
          {pct(100 * ((v1 ?? 0) + (v2 ?? 0)), 1)} phương sai
        </span>
      </div>
      <div className="x-controls">
        <label>
          Tô màu theo
          <select
            value={colourBy}
            onChange={(e) => {
              setColourBy(e.target.value as 'segment' | 'level' | 'churned');
              setHidden([]);
            }}
          >
            <option value="segment">Phân khúc K-Means</option>
            <option value="level">Mức mua (nhãn)</option>
            <option value="churned">Rời bỏ</option>
          </select>
        </label>
      </div>
      <div className="x-chips" role="group" aria-label="Ẩn hoặc hiện nhóm">
        <span className="x-chips-label">Hiện nhóm</span>
        {groups.map((g, i) => (
          <button
            key={g.label}
            type="button"
            className="x-chip"
            aria-pressed={!hidden.includes(i)}
            onClick={() => setHidden((h) => (h.includes(i) ? h.filter((v) => v !== i) : [...h, i]))}
          >
            <i style={{ background: g.color }} />
            {g.label}
          </button>
        ))}
      </div>
      <Scatter
        points={points}
        markers={pca.centroids.map((c) => ({
          x: c.x,
          y: c.y,
          label: `Tâm ${c.segment.replace('Tương tác ', '')}`,
          color: segmentColor(report.segments.indexOf(c.segment)),
        }))}
        label="Biểu đồ phân tán PCA của các phân khúc"
        xLabel={`PC1 (${pct(100 * (v1 ?? 0), 1)})`}
        yLabel={`PC2 (${pct(100 * (v2 ?? 0), 1)})`}
      />
      <h3 className="insight-h3">Hệ số tải (loadings) của các thuộc tính</h3>
      <div className="insight-table" role="region" aria-label="Hệ số tải PCA" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">Thuộc tính</th>
              <th scope="col">PC1</th>
              <th scope="col">PC2</th>
            </tr>
          </thead>
          <tbody>
            {loadings.map((row) => (
              <tr key={row.feature}>
                <th scope="row">{featureName(row.feature)}</th>
                <td
                  style={{
                    background: tint(
                      row.pc1 < 0 ? 'var(--insight-low)' : 'var(--insight-high)',
                      Math.abs(row.pc1) * 1.6,
                    ),
                  }}
                >
                  {fixed(row.pc1, 3)}
                </td>
                <td
                  style={{
                    background: tint(
                      row.pc2 < 0 ? 'var(--insight-low)' : 'var(--insight-high)',
                      Math.abs(row.pc2) * 1.6,
                    ),
                  }}
                >
                  {fixed(row.pc2, 3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="insight-note">
        PCA chỉ dùng để nhìn: K-Means phân cụm trong không gian 10 chiều đã chuẩn hóa. PC1 gom các
        chỉ số tương tác (đăng nhập, thời lượng phiên, số trang, ứng dụng, yêu thích, lượt mua) và
        ngược chiều với tỷ lệ bỏ giỏ, nên các phân khúc xếp thành dải dọc PC1, đúng với tên "tương
        tác thấp → cao". PC2 chủ yếu là tỷ lệ dùng giảm giá đối lập giá trị đơn trung bình, gần như
        không tách phân khúc. Mẫu {num(pca.sample_rows, 0)} điểm lấy ngẫu nhiên cố định (seed{' '}
        {pca.sample_seed}) từ tập train.
      </p>
    </section>
  );
}

function SilhouetteSection() {
  const { silhouette } = report;
  const height = 240;
  const width = 640;
  const pad = { left: 40, right: 12, top: 10, bottom: 26 };
  const total = silhouette.by_segment.reduce((sum, s) => sum + s.count, 0);
  const all = silhouette.by_segment.flatMap((s) => s.quantiles);
  const lo = Math.min(0, ...all);
  const hi = Math.max(...all);
  const sx = (v: number) => pad.left + ((v - lo) / (hi - lo || 1)) * (width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const bands = silhouette.by_segment.map((s) => (plotH * s.count) / total);
  const tops = bands.map((_, i) => pad.top + bands.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <section className="panel insight-section" aria-labelledby="c-sil">
      <div className="panel-heading">
        <h2 id="c-sil">
          <Waves size={16} /> Biểu đồ silhouette theo phân khúc
        </h2>
        <span className="subtle-tag">Trung bình chung {fixed(silhouette.overall, 3)}</span>
      </div>
      <svg
        className="x-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Biểu đồ silhouette"
      >
        {silhouette.by_segment.map((s, gi) => {
          const bandH = bands[gi] ?? 0;
          const step = bandH / s.quantiles.length;
          const top = tops[gi] ?? pad.top;
          return (
            <g key={s.segment}>
              {s.quantiles.map((q, i) => (
                <rect
                  key={i}
                  x={Math.min(sx(0), sx(q))}
                  width={Math.abs(sx(q) - sx(0))}
                  y={top + i * step}
                  height={step + 0.4}
                  fill={segmentColor(gi)}
                />
              ))}
              <text
                x={sx(hi) - 4}
                y={top + bandH / 2 + 4}
                textAnchor="end"
                className="x-tick strong"
              >
                {s.segment} · TB {fixed(s.mean, 3)} · âm {pct(100 * s.negative_share, 1)}
              </text>
            </g>
          );
        })}
        <line x1={sx(0)} x2={sx(0)} y1={pad.top} y2={pad.top + plotH} className="x-axis" />
        <line
          x1={sx(silhouette.overall)}
          x2={sx(silhouette.overall)}
          y1={pad.top}
          y2={pad.top + plotH}
          className="x-reference"
        />
        {[lo, 0, (hi + lo) / 2, hi].map((t) => (
          <text key={t} x={sx(t)} y={height - 8} textAnchor="middle" className="x-tick">
            {fixed(t, 2)}
          </text>
        ))}
      </svg>
      <p className="insight-note">
        Mỗi dải là một phân khúc, độ cao tỷ lệ số điểm; mỗi vạch ngang là silhouette của các điểm đã
        sắp xếp (gần 1: nằm gọn trong cụm; âm: gần cụm khác hơn). Đường đứt nét là trung bình chung.
        Tỷ lệ điểm âm cao nhất ở nhóm tương tác cao, nghĩa là một phần nhóm này nằm sát ranh giới và
        gần tâm nhóm trung bình hơn; nhóm tương tác thấp tách rõ nhất.
      </p>
    </section>
  );
}

function ProfileSection() {
  const [feature, setFeature] = useState<string>(report.features[0] ?? 'Login_Frequency');
  const quartiles = report.feature_quartiles as Record<string, Record<string, number[]>>;
  const centroidRows = report.segments;
  const centroids = report.centroids_standardized as Record<string, Record<string, number>>;
  return (
    <section className="panel insight-section" aria-labelledby="c-profile">
      <div className="panel-heading">
        <h2 id="c-profile">
          <Boxes size={16} /> Hồ sơ phân khúc
        </h2>
        <span className="subtle-tag">{num(report.rows, 0)} bản ghi train</span>
      </div>
      <h3 className="insight-h3">Tâm cụm đã chuẩn hóa (độ lệch so với trung bình, đơn vị SD)</h3>
      <div className="x-scroll" role="region" aria-label="Bản đồ nhiệt tâm cụm" tabIndex={0}>
        <HeatGrid
          rows={centroidRows}
          cols={report.features.map(featureName)}
          values={centroidRows.map((s) => report.features.map((f) => centroids[s]?.[f] ?? null))}
          label="Tâm cụm chuẩn hóa theo thuộc tính"
          format={(v) => fixed(v, 2)}
          domain={[-1.5, 1.5]}
          cell={46}
          rowLabelWidth={150}
          colLabelHeight={120}
        />
      </div>
      <div className="x-controls">
        <label>
          So sánh thuộc tính
          <select value={feature} onChange={(e) => setFeature(e.target.value)}>
            {report.features.map((f) => (
              <option key={f} value={f}>
                {featureName(f)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <BoxRows
        label={`Phân bố ${featureName(feature)} theo phân khúc`}
        rows={report.segments.map((s, i) => {
          const q = quartiles[feature]?.[s] ?? [0, 0, 0, 0, 0];
          return {
            key: s,
            label: s,
            color: segmentColor(i),
            q: [q[0] ?? 0, q[1] ?? 0, q[2] ?? 0, q[3] ?? 0, q[4] ?? 0],
          };
        })}
      />
      <p className="insight-note">
        Hộp: Q1–Q3, vạch giữa: trung vị, râu: P5–P95, tính trên giá trị gốc hợp lệ (chưa điền
        thiếu).
      </p>
      <h3 className="insight-h3">
        Đối chiếu với nhãn mức mua và rời bỏ (không phải đầu vào phân cụm)
      </h3>
      <Legend
        items={CLASS_ORDER.map((c) => ({ key: c, label: classLabel[c], color: classColor[c] }))}
      />
      <ul className="x-share-rows">
        {report.segments.map((s) => {
          const mix = (
            report.mix as Record<
              string,
              {
                rows: number;
                purchase_level_percent: Record<string, number>;
                churn_percent: number;
              }
            >
          )[s];
          if (!mix) return null;
          return (
            <li key={s}>
              <span className="x-share-label">
                {s}
                <small>{num(mix.rows, 0)} bản ghi</small>
              </span>
              <ShareBar
                label={`${s}: ${CLASS_ORDER.map((c) => `${classLabel[c]} ${pct(mix.purchase_level_percent[c], 1)}`).join(', ')}`}
                parts={CLASS_ORDER.map((c) => ({
                  key: c,
                  value: mix.purchase_level_percent[c] ?? 0,
                  color: classColor[c],
                  title: `${classLabel[c]}: ${pct(mix.purchase_level_percent[c], 1)}`,
                }))}
              />
              <strong title="Tỷ lệ rời bỏ">rời bỏ {pct(mix.churn_percent, 1)}</strong>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DistanceSection() {
  const { distance } = report;
  const edges = distance.edges;
  const categories = edges
    .slice(0, -1)
    .map((e, i) => `${fixed(e, 1)}–${fixed(edges[i + 1] ?? e, 1)}`);
  const by = distance.by_segment as Record<string, number[]>;
  const width = (edges[1] ?? 1) - (edges[0] ?? 0) || 1;
  return (
    <section className="panel insight-section" aria-labelledby="c-dist">
      <div className="panel-heading">
        <h2 id="c-dist">
          <Crosshair size={16} /> Khoảng cách tới tâm cụm
        </h2>
        <span className="subtle-tag">P99 chung = {fixed(distance.p99, 2)}</span>
      </div>
      <Legend
        items={report.segments.map((s, i) => ({
          key: s,
          label: `${s} · P99 ${fixed((distance.p99_by_segment as Record<string, number>)[s] ?? null, 2)}`,
          color: segmentColor(i),
        }))}
      />
      <ColumnChart
        categories={categories}
        series={report.segments.map((s, i) => {
          const counts = by[s] ?? [];
          const total = counts.reduce((a, b) => a + b, 0) || 1;
          return {
            key: s,
            label: s,
            color: segmentColor(i),
            values: counts.map((c) => (100 * c) / total),
          };
        })}
        mode="lines"
        label="Phân phối khoảng cách tới tâm cụm theo phân khúc"
        yLabel="% trong phân khúc"
        yFormat={(v) => `${num(v, 1)}%`}
        references={[{ at: (distance.p99 - (edges[0] ?? 0)) / width - 0.5, text: 'P99 chung' }]}
      />
      <p className="insight-note">
        Khoảng cách Euclid trong không gian chuẩn hóa. Khi phân khúc một khách hàng mới, hệ thống so
        khoảng cách với P99 của chính cụm được gán (giá trị trong chú thích) và bật cờ{' '}
        <code>distance_above_training_cluster_p99</code> nếu vượt: khách đó vẫn có phân khúc nhưng
        ít điển hình so với dữ liệu huấn luyện.
      </p>
    </section>
  );
}

function StabilitySection() {
  const { stability, internal_validation: validation } = report;
  const minimum = Math.min(...stability.results.map((r) => r.ari ?? 1));
  return (
    <section className="panel insight-section" aria-labelledby="c-stab">
      <div className="panel-heading">
        <h2 id="c-stab">
          <GitCompare size={16} /> Độ ổn định và kiểm tra nội bộ
        </h2>
        <span className="subtle-tag">ARI thấp nhất {fixed(minimum, 3)}</span>
      </div>
      <div className="x-two">
        <div className="insight-table" role="region" aria-label="Độ ổn định theo seed" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th scope="col">Kiểu chạy lại</th>
                <th scope="col">Seed</th>
                <th scope="col">Số dòng</th>
                <th scope="col">ARI</th>
                <th scope="col">Trùng nhãn</th>
              </tr>
            </thead>
            <tbody>
              {stability.results.map((r) => (
                <tr key={`${r.mode}-${r.seed}`}>
                  <th scope="row">
                    {r.mode === 'initialization' ? 'Khởi tạo khác' : 'Mẫu con 80%'}
                  </th>
                  <td>{r.seed}</td>
                  <td>{num(r.fit_rows, 0)}</td>
                  <td>{fixed(r.ari, 4)}</td>
                  <td>{pct(100 * (r.agreement ?? 0), 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="insight-kpis x-kpi-column">
          <Kpi
            label="Silhouette trên fold kiểm tra nội bộ"
            value={fixed(validation.silhouette_sample, 3)}
            hint={`Huấn luyện ${num(validation.fit_rows, 0)} · kiểm tra ${num(validation.validation_rows, 0)} dòng`}
          />
          <Kpi
            label="Davies–Bouldin (fold nội bộ)"
            value={fixed(validation.davies_bouldin, 3)}
            hint="Gần bằng khi huấn luyện toàn tập"
          />
        </div>
      </div>
      <p className="insight-note">
        ARI (Adjusted Rand Index) = 1 nghĩa là chạy lại cho đúng cùng một cách chia. Kết quả gần 1
        với cả seed khởi tạo khác và mẫu con 80% cho thấy phân cụm ổn định trong phạm vi dữ liệu
        phát triển; đây không phải bằng chứng quần thể tương lai sẽ giữ nguyên.
      </p>
    </section>
  );
}

export default function ClusterReportPage() {
  const minimum = Math.min(...report.stability.results.map((r) => r.ari ?? 1));
  const chosen = report.k_diagnostics.find((r) => r.K === report.k);
  const [v1, v2] = report.pca.explained_variance_ratio;
  return (
    <div className="insights-page explorer-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">NGHIÊN CỨU · PHÂN CỤM</span>
          <h1>Đánh giá phân cụm K-Means</h1>
          <p>
            Mô hình {report.model_version} phân {num(report.rows, 0)} bản ghi train thành {report.k}{' '}
            phân khúc theo {report.features.length} chỉ số hành vi. Trang này cho thấy các cụm được
            chọn, tách biệt và ổn định đến mức nào.
          </p>
        </div>
        <span className="scope-badge">
          <BookOpenCheck size={14} />
          Tập train · artifact T5
        </span>
      </div>
      <section className="insight-kpis" aria-label="Chỉ số phân cụm">
        <Kpi label="Số cụm" value={report.k} hint="Cố định theo protocol" />
        <Kpi
          label="Silhouette (mẫu 3.000)"
          value={fixed(chosen?.silhouette_sample ?? null, 3)}
          hint="−1 → 1, cao hơn tốt hơn"
        />
        <Kpi
          label="Davies–Bouldin"
          value={fixed(chosen?.davies_bouldin ?? null, 3)}
          hint="Thấp hơn tốt hơn"
        />
        <Kpi
          label="Ổn định (ARI thấp nhất)"
          value={fixed(minimum, 3)}
          hint={`${report.stability.results.length} lần chạy lại`}
        />
        <Kpi
          label="PCA 2 chiều"
          value={pct(100 * ((v1 ?? 0) + (v2 ?? 0)), 1)}
          hint="Phương sai được giữ lại"
        />
      </section>
      <KSection />
      <PcaSection />
      <SilhouetteSection />
      <ProfileSection />
      <DistanceSection />
      <StabilitySection />
    </div>
  );
}
