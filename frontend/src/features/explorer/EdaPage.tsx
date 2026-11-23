import { useMemo, useState } from 'react';
import { BookOpenCheck, Filter, Grid3x3, Layers, ScanSearch, ShieldCheck, X } from 'lucide-react';
import { BarList, Kpi, ShareBar } from '../insights/charts';
import { fixed, num, pct } from '../insights/insights';
import { Chips, ColumnChart, HeatGrid, Legend, type Series } from './charts';
import {
  CATEGORICAL,
  NUMERIC,
  ROWS,
  activeFilterCount,
  binCount,
  binLabel,
  binnedStats,
  buildMask,
  column,
  columnLabel,
  crossTab,
  density,
  eda,
  histogram,
  levelColor,
  levelLabel,
  levelsOf,
  noFilters,
  numericColumn,
  type Filters,
} from './explorer';
import '../insights/insights.css';
import './explorer.css';

const FILTER_COLUMNS = [
  'Purchase_Level',
  'Segment',
  'Churned',
  'Gender',
  'Signup_Quarter',
  'Country',
];
const GROUP_COLUMNS = ['Purchase_Level', 'Segment', 'Churned', 'Gender', 'Signup_Quarter'];
const CROSS_COLUMNS = ['Segment', 'Country', 'Gender', 'Signup_Quarter', 'City'];
const short = (value: number) => num(value, Math.abs(value) >= 100 ? 0 : 1);

function share(count: number, total: number) {
  return total ? (100 * count) / total : 0;
}

/** Fractional category position of a raw value on a numeric column's bins. */
function position(name: string, value: number) {
  const { edges } = numericColumn(name);
  const first = edges[0] ?? 0;
  const width = (edges[1] ?? first + 1) - first || 1;
  return (value - first) / width - 0.5;
}

function FilterBar({
  filters,
  setFilters,
  rows,
}: {
  filters: Filters;
  setFilters: (next: Filters) => void;
  rows: number;
}) {
  const toggle = (name: string, value: number) => {
    const current = filters.levels[name] ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    setFilters({ ...filters, levels: { ...filters.levels, [name]: next } });
  };
  const count = activeFilterCount(filters);
  return (
    <section className="panel x-filters" aria-label="Bộ lọc dữ liệu">
      <div className="panel-heading">
        <h2>
          <Filter size={16} /> Bộ lọc chung cho toàn trang
        </h2>
        <span className="subtle-tag" aria-live="polite">
          {num(rows, 0)} / {num(ROWS, 0)} bản ghi ({pct(share(rows, ROWS), 1)})
        </span>
      </div>
      <div className="x-filter-grid">
        {FILTER_COLUMNS.map((name) => (
          <Chips
            key={name}
            label={columnLabel(name)}
            options={levelsOf(name).map((level, i) => ({
              value: i,
              label: levelLabel(name, level),
              color: ['Purchase_Level', 'Segment', 'Churned'].includes(name)
                ? levelColor(name, i)
                : undefined,
            }))}
            selected={filters.levels[name] ?? []}
            onToggle={(value) => toggle(name, value)}
          />
        ))}
      </div>
      {count > 0 && (
        <div className="x-active">
          {filters.range && (
            <span className="x-active-range">
              {columnLabel(filters.range.column)}:{' '}
              {binLabel(filters.range.column, filters.range.from, short).split('–')[0]} –{' '}
              {binLabel(filters.range.column, filters.range.to, short).split('–').at(-1)}
              <button
                type="button"
                aria-label="Bỏ lọc khoảng giá trị"
                onClick={() => setFilters({ ...filters, range: null })}
              >
                <X size={12} />
              </button>
            </span>
          )}
          <button type="button" className="x-link" onClick={() => setFilters(noFilters)}>
            Xóa tất cả bộ lọc ({count})
          </button>
        </div>
      )}
    </section>
  );
}

function SubsetKpis({ mask, rows }: { mask: Uint8Array; rows: number }) {
  const level = crossTab('Purchase_Level', 'Churned', mask);
  const byLevel = level.map((row) => row.reduce((a, b) => a + b, 0));
  const churned = level.reduce((sum, row) => sum + (row[1] ?? 0), 0);
  const highIndex = levelsOf('Purchase_Level').indexOf('High');
  const lowIndex = levelsOf('Purchase_Level').indexOf('Low');
  return (
    <section className="insight-kpis" aria-label="Chỉ số của tập đang lọc">
      <Kpi
        label="Bản ghi đang xem"
        value={num(rows, 0)}
        hint={`${pct(share(rows, ROWS), 1)} tập train`}
      />
      <Kpi
        label="Mức mua Cao"
        value={pct(share(byLevel[highIndex] ?? 0, rows), 1)}
        hint="Total_Purchases > 15"
      />
      <Kpi
        label="Mức mua Thấp"
        value={pct(share(byLevel[lowIndex] ?? 0, rows), 1)}
        hint="Total_Purchases ≤ 10"
      />
      <Kpi label="Tỷ lệ rời bỏ" value={pct(share(churned, rows), 1)} hint="Churned = 1 (lịch sử)" />
    </section>
  );
}

function DistributionSection({
  mask,
  filters,
  setFilters,
  feature,
  setFeature,
}: {
  mask: Uint8Array;
  filters: Filters;
  setFilters: (next: Filters) => void;
  feature: string;
  setFeature: (name: string) => void;
}) {
  const [groupBy, setGroupBy] = useState<string>('Purchase_Level');
  const [scale, setScale] = useState<'share' | 'count'>('share');
  const group = groupBy === 'none' ? null : groupBy;
  const hist = useMemo(() => histogram(feature, mask, group), [feature, mask, group]);
  const info = numericColumn(feature);
  const bins = binCount(feature);
  const categories = Array.from({ length: bins }, (_, i) => binLabel(feature, i, short));
  const series: Series[] = hist.groups.map((g, gi) => ({
    key: g,
    label: group ? levelLabel(group, g) : 'Tất cả',
    color: group ? levelColor(group, gi) : 'var(--chart-2)',
    values: (hist.counts[gi] ?? []).map((c) =>
      scale === 'share' ? share(c, hist.totals[gi] ?? 0) : c,
    ),
  }));
  const range = filters.range?.column === feature ? filters.range : null;
  const select = (bin: number) => {
    const next = range
      ? { column: feature, from: Math.min(range.from, bin), to: Math.max(range.to, bin) }
      : { column: feature, from: bin, to: bin };
    setFilters({ ...filters, range: next });
  };
  const references =
    feature === 'Total_Purchases'
      ? [
          { at: position(feature, eda.thresholds.low_max), text: 'Thấp ≤ 10' },
          { at: position(feature, eda.thresholds.medium_max), text: 'Cao > 15' },
        ]
      : [];
  const s = info.summary;
  return (
    <section className="panel insight-section" aria-labelledby="x-dist">
      <div className="panel-heading">
        <h2 id="x-dist">
          <Layers size={16} /> Phân phối thuộc tính
        </h2>
        <span className="subtle-tag">Nhấp cột để lọc theo khoảng · nhấp thêm để mở rộng</span>
      </div>
      <div className="x-controls">
        <label>
          Thuộc tính
          <select value={feature} onChange={(e) => setFeature(e.target.value)}>
            {NUMERIC.map((name) => (
              <option key={name} value={name}>
                {columnLabel(name)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tách theo
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="none">Không tách</option>
            {GROUP_COLUMNS.map((name) => (
              <option key={name} value={name}>
                {columnLabel(name)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Trục tung
          <select value={scale} onChange={(e) => setScale(e.target.value as 'share' | 'count')}>
            <option value="share">% trong nhóm</option>
            <option value="count">Số bản ghi</option>
          </select>
        </label>
      </div>
      {group && (
        <Legend
          items={series.map((item) => ({ key: item.key, label: item.label, color: item.color }))}
        />
      )}
      <ColumnChart
        categories={categories}
        series={series}
        label={`Phân phối ${columnLabel(feature)}`}
        yLabel={scale === 'share' ? '% trong nhóm' : 'Số bản ghi'}
        yFormat={(v) => (scale === 'share' ? `${num(v, 1)}%` : num(v, 0))}
        references={references}
        highlight={range}
        onSelect={select}
      />
      <div className="insight-table" role="region" aria-label="Thống kê theo nhóm" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">Nhóm</th>
              <th scope="col">Bản ghi có giá trị</th>
              <th scope="col">Thiếu</th>
              <th scope="col">Trung bình ≈</th>
              <th scope="col">Trung vị ≈</th>
            </tr>
          </thead>
          <tbody>
            {hist.groups.map((g, gi) => {
              const stats = binnedStats(feature, hist.counts[gi] ?? []);
              const total = (hist.totals[gi] ?? 0) + (hist.missing[gi] ?? 0);
              return (
                <tr key={g}>
                  <th scope="row">
                    <i className="x-swatch" style={{ background: series[gi]?.color }} />
                    {series[gi]?.label}
                  </th>
                  <td>{num(hist.totals[gi] ?? 0, 0)}</td>
                  <td>{pct(share(hist.missing[gi] ?? 0, total), 1)}</td>
                  <td>{num(stats.mean, 2)}</td>
                  <td>{num(stats.median, 2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="insight-note">
        Toàn tập train (chính xác, không phụ thuộc bộ lọc): trung bình {num(s.mean, 2)}, độ lệch
        chuẩn {num(s.std, 2)}, trung vị {num(s.median, 2)}, Q1–Q3 {num(s.q1, 2)}–{num(s.q3, 2)}, độ
        xiên {fixed(s.skew, 2)}, {num(s.iqr_outliers, 0)} giá trị ngoại lai theo IQR (1,5×), thiếu{' '}
        {num(s.missing, 0)}.{' '}
        {info.kind === 'continuous' &&
          `Biểu đồ dùng 30 khoảng đều trong [P0,5; P99,5]; ${num(s.clipped_low + s.clipped_high, 0)} giá trị ngoài khoảng được gộp vào hai cột biên. `}
        Dấu ≈ là ước lượng từ các khoảng giá trị.
      </p>
    </section>
  );
}

function CrossSection({ mask }: { mask: Uint8Array }) {
  const [rowsBy, setRowsBy] = useState('Segment');
  const [target, setTarget] = useState<'Purchase_Level' | 'Churned'>('Purchase_Level');
  const table = useMemo(() => crossTab(rowsBy, target, mask), [rowsBy, target, mask]);
  const levels = levelsOf(rowsBy);
  const targetLevels = levelsOf(target);
  const key = target === 'Purchase_Level' ? targetLevels.indexOf('High') : 1;
  const rows = levels
    .map((level, i) => {
      const counts = table[i] ?? [];
      const total = counts.reduce((a, b) => a + b, 0);
      return { level, i, counts, total };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => (rowsBy === 'City' ? b.total - a.total : a.i - b.i))
    .slice(0, 15);
  const association = (
    eda.association as Record<string, Record<string, { cramers_v: number; p_value: number }>>
  )[rowsBy]?.[target === 'Purchase_Level' ? 'purchase_level' : 'churned'];
  return (
    <section className="panel insight-section" aria-labelledby="x-cross">
      <div className="panel-heading">
        <h2 id="x-cross">
          <ScanSearch size={16} /> Biến phân loại so với mức mua và rời bỏ
        </h2>
        {association && (
          <span className="subtle-tag">
            Cramér&apos;s V = {fixed(association.cramers_v, 3)} (toàn tập train)
          </span>
        )}
      </div>
      <div className="x-controls">
        <label>
          Nhóm theo
          <select value={rowsBy} onChange={(e) => setRowsBy(e.target.value)}>
            {CROSS_COLUMNS.map((name) => (
              <option key={name} value={name}>
                {columnLabel(name)}
              </option>
            ))}
          </select>
        </label>
        <label>
          So với
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as 'Purchase_Level' | 'Churned')}
          >
            <option value="Purchase_Level">Mức mua</option>
            <option value="Churned">Rời bỏ</option>
          </select>
        </label>
      </div>
      <Legend
        items={targetLevels.map((level, i) => ({
          key: level,
          label: levelLabel(target, level),
          color: levelColor(target, i),
        }))}
      />
      <ul className="x-share-rows">
        {rows.map((row) => (
          <li key={row.level}>
            <span className="x-share-label">
              {levelLabel(rowsBy, row.level)}
              <small>{num(row.total, 0)} bản ghi</small>
            </span>
            <ShareBar
              label={`${row.level}: ${targetLevels.map((t, j) => `${levelLabel(target, t)} ${pct(share(row.counts[j] ?? 0, row.total), 1)}`).join(', ')}`}
              parts={targetLevels.map((t, j) => ({
                key: t,
                value: share(row.counts[j] ?? 0, row.total),
                color: levelColor(target, j),
                title: `${levelLabel(target, t)}: ${pct(share(row.counts[j] ?? 0, row.total), 1)}`,
              }))}
            />
            <strong>{pct(share(row.counts[key] ?? 0, row.total), 1)}</strong>
          </li>
        ))}
      </ul>
      <p className="insight-note">
        Cột phải: tỷ lệ {target === 'Purchase_Level' ? 'mức mua Cao' : 'đã rời bỏ'} trong nhóm.
        {rowsBy === 'City' && ' Thành phố: 15 nhóm đông nhất.'} Cramér&apos;s V gần 0 nghĩa là biến
        hầu như không liên quan; từ khoảng 0,3 trở lên là liên hệ đáng kể. Phân khúc K-Means dùng
        Total_Purchases làm đầu vào nên liên hệ với mức mua một phần là do cách xây dựng; Churned
        không phải đầu vào nên là kiểm tra độc lập.
      </p>
    </section>
  );
}

function CorrelationSection({ onPick }: { onPick: (a: string, b: string) => void }) {
  const [minimum, setMinimum] = useState(0);
  const order = eda.spearman.order;
  const matrix = eda.spearman.matrix;
  const names = order.map((name) =>
    name === 'Purchase_Level' ? 'Mức mua (thứ bậc)' : columnLabel(name),
  );
  const values = matrix.map((row, i) =>
    row.map((v, j) => (i === j || v === null || Math.abs(v) < minimum ? null : v)),
  );
  const pairs = order
    .flatMap((a, i) => order.slice(i + 1).map((b, k) => ({ a, b, v: matrix[i]?.[i + 1 + k] ?? 0 })))
    .sort((x, y) => Math.abs(y.v) - Math.abs(x.v))
    .slice(0, 8);
  return (
    <section className="panel insight-section" aria-labelledby="x-corr">
      <div className="panel-heading">
        <h2 id="x-corr">
          <Grid3x3 size={16} /> Ma trận tương quan Spearman
        </h2>
        <label className="x-inline">
          Ẩn |ρ| dưới
          <select value={minimum} onChange={(e) => setMinimum(Number(e.target.value))}>
            {[0, 0.05, 0.1, 0.2, 0.3].map((v) => (
              <option key={v} value={v}>
                {fixed(v, 2)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="insight-lead">
        Tương quan hạng trên toàn tập train (chính xác). Màu xanh: cùng chiều, màu cam: ngược chiều.
        Nhấp một ô để xem mật độ hai chiều của cặp đó bên dưới.
      </p>
      <div className="x-scroll" role="region" aria-label="Ma trận tương quan" tabIndex={0}>
        <HeatGrid
          rows={names}
          cols={names}
          values={values}
          label="Ma trận tương quan Spearman giữa các thuộc tính"
          format={(v) => fixed(v, 2).replace(/^(-?)0,/, '$1,')}
          domain={[-1, 1]}
          cell={30}
          rowLabelWidth={170}
          colLabelHeight={130}
          onCell={(i, j) => onPick(order[i] ?? '', order[j] ?? '')}
          cellTitle={(i, j) => `${names[i]} × ${names[j]}: ρ = ${fixed(matrix[i]?.[j] ?? null, 3)}`}
        />
      </div>
      <h3 className="insight-h3">Tám cặp tương quan mạnh nhất</h3>
      <BarList
        label="Các cặp tương quan mạnh nhất"
        max={1}
        rows={pairs.map((p) => ({
          key: `${p.a}-${p.b}`,
          label: `${columnLabel(p.a)} × ${columnLabel(p.b)}`,
          value: Math.abs(p.v),
          display: fixed(p.v, 3),
        }))}
      />
      <p className="insight-note">
        Lifetime_Value tương quan rất mạnh với Total_Purchases, mà Total_Purchases lại quyết định
        trực tiếp nhãn mức mua. Vì vậy Lifetime_Value bị loại khỏi mô hình chính (xem trang Kết quả
        mô hình, phần rò rỉ dữ liệu).
      </p>
    </section>
  );
}

function DensitySection({
  mask,
  x,
  y,
  setX,
  setY,
}: {
  mask: Uint8Array;
  x: string;
  y: string;
  setX: (v: string) => void;
  setY: (v: string) => void;
}) {
  const [colour, setColour] = useState<'count' | 'high'>('high');
  const result = useMemo(() => density(x, y, mask), [x, y, mask]);
  const xBins = binCount(x);
  const yBins = binCount(y);
  const every = (n: number) => Math.max(1, Math.ceil(n / 8));
  const cols = Array.from({ length: xBins }, (_, i) =>
    i % every(xBins) ? '' : binLabel(x, i, short),
  );
  const rowsDesc = Array.from({ length: yBins }, (_, k) => yBins - 1 - k);
  const rows = rowsDesc.map((j) => (j % every(yBins) ? '' : binLabel(y, j, short)));
  const max = Math.max(1, ...result.counts.flat());
  const values = rowsDesc.map((j) =>
    colour === 'count'
      ? (result.counts[j] ?? []).map((c) => (c ? Math.sqrt(c / max) : null))
      : (result.highShare[j] ?? []).map((v, i) => ((result.counts[j]?.[i] ?? 0) >= 5 ? v : null)),
  );
  return (
    <section className="panel insight-section" aria-labelledby="x-density">
      <div className="panel-heading">
        <h2 id="x-density">
          <Grid3x3 size={16} /> Mật độ hai chiều
        </h2>
        <span className="subtle-tag">{num(result.rows, 0)} bản ghi có đủ hai giá trị</span>
      </div>
      <div className="x-controls">
        <label>
          Trục hoành
          <select value={x} onChange={(e) => setX(e.target.value)}>
            {NUMERIC.map((name) => (
              <option key={name} value={name}>
                {columnLabel(name)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Trục tung
          <select value={y} onChange={(e) => setY(e.target.value)}>
            {NUMERIC.map((name) => (
              <option key={name} value={name}>
                {columnLabel(name)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tô màu theo
          <select value={colour} onChange={(e) => setColour(e.target.value as 'count' | 'high')}>
            <option value="high">Tỷ lệ mức mua Cao trong ô</option>
            <option value="count">Mật độ bản ghi</option>
          </select>
        </label>
      </div>
      <div className="x-scroll" role="region" aria-label="Biểu đồ mật độ" tabIndex={0}>
        <HeatGrid
          rows={rows}
          cols={cols}
          values={values}
          label={`Mật độ ${columnLabel(x)} × ${columnLabel(y)}`}
          format={(v) => pct(100 * v, 0)}
          domain={[0, 1]}
          showValues={false}
          cell={15}
          rowLabelWidth={80}
          colLabelHeight={60}
          positiveColor={colour === 'count' ? 'var(--chart-2)' : 'var(--insight-high)'}
          cellTitle={(i, j) => {
            const yBin = rowsDesc[i] ?? 0;
            const count = result.counts[yBin]?.[j] ?? 0;
            const high = result.highShare[yBin]?.[j];
            return `${columnLabel(x)} ${binLabel(x, j, short)} · ${columnLabel(y)} ${binLabel(y, yBin, short)}: ${num(count, 0)} bản ghi${high === null || high === undefined ? '' : `, ${pct(100 * high, 0)} mức Cao`}`;
          }}
        />
      </div>
      <p className="insight-note">
        {colour === 'high'
          ? 'Ô càng đậm thì tỷ lệ bản ghi mức mua Cao càng lớn; ô có dưới 5 bản ghi để trống.'
          : 'Ô càng đậm càng nhiều bản ghi (thang căn bậc hai để thấy cả vùng thưa).'}{' '}
        Trục tung tăng dần từ dưới lên.
      </p>
    </section>
  );
}

function QualitySection() {
  const all = [
    ...NUMERIC,
    ...CATEGORICAL.filter((c) => !['Segment', 'Purchase_Level'].includes(c)),
  ];
  const missing = all
    .map((name) => {
      const col = column(name);
      const count =
        col.kind === 'categorical'
          ? [...col.codes].filter((c) => c === eda.missing_symbol).length
          : col.summary.missing;
      return { name, count };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
  const outliers = NUMERIC.map((name) => ({ name, ...numericColumn(name).summary }))
    .filter((row) => row.iqr_outliers > 0)
    .sort((a, b) => b.iqr_outliers - a.iqr_outliers)
    .slice(0, 8);
  return (
    <section className="panel insight-section" aria-labelledby="x-quality">
      <div className="panel-heading">
        <h2 id="x-quality">
          <ShieldCheck size={16} /> Chất lượng dữ liệu
        </h2>
        <span className="subtle-tag">Toàn tập train · không phụ thuộc bộ lọc</span>
      </div>
      <div className="x-two">
        <div>
          <h3 className="insight-h3">Tỷ lệ giá trị thiếu</h3>
          <BarList
            label="Tỷ lệ thiếu theo thuộc tính"
            rows={missing.map((row) => ({
              key: row.name,
              label: columnLabel(row.name),
              value: share(row.count, ROWS),
              display: pct(share(row.count, ROWS), 1),
            }))}
          />
        </div>
        <div>
          <h3 className="insight-h3">Ngoại lai theo IQR (1,5×) và độ xiên</h3>
          <BarList
            label="Số giá trị ngoại lai theo thuộc tính"
            rows={outliers.map((row) => ({
              key: row.name,
              label: columnLabel(row.name),
              value: row.iqr_outliers,
              display: `${num(row.iqr_outliers, 0)} · xiên ${fixed(row.skew, 1)}`,
            }))}
          />
        </div>
      </div>
      <p className="insight-note">
        Giá trị thiếu được điền bằng trung vị của tập huấn luyện bên trong pipeline mô hình (không
        dùng thông tin holdout). Ngoại lai chỉ là dấu hiệu thống kê, không bị xóa khi chưa có bằng
        chứng nghiệp vụ; K-Means cắt Total_Purchases và Average_Order_Value theo phân vị trước khi
        chuẩn hóa.
      </p>
    </section>
  );
}

export default function EdaPage() {
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [feature, setFeature] = useState('Session_Duration_Avg');
  const [x, setX] = useState('Session_Duration_Avg');
  const [y, setY] = useState('Pages_Per_Session');
  const { mask, rows } = useMemo(() => buildMask(filters), [filters]);
  const pick = (a: string, b: string) => {
    const numeric = [a, b].filter((name) => NUMERIC.includes(name));
    if (numeric.length === 2) {
      setX(a);
      setY(b);
      document.getElementById('x-density')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (numeric[0]) {
      setFeature(numeric[0]);
      document.getElementById('x-dist')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  return (
    <div className="insights-page explorer-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">NGHIÊN CỨU · EDA TƯƠNG TÁC</span>
          <h1>Khám phá dữ liệu hành vi</h1>
          <p>
            Lọc, tách nhóm và so sánh trực tiếp trên {num(ROWS, 0)} bản ghi của tập huấn luyện. Tập
            holdout 9.992 bản ghi không có mặt ở trang này, nên việc khám phá không làm lộ dữ liệu
            đánh giá cuối.
          </p>
        </div>
        <span className="scope-badge">
          <BookOpenCheck size={14} />
          Tập train · {num(ROWS, 0)} dòng
        </span>
      </div>
      <FilterBar filters={filters} setFilters={setFilters} rows={rows} />
      {rows === 0 ? (
        <section className="panel">
          <p className="insight-lead">Không có bản ghi nào khớp bộ lọc. Hãy bỏ bớt điều kiện.</p>
        </section>
      ) : (
        <>
          <SubsetKpis mask={mask} rows={rows} />
          <DistributionSection
            mask={mask}
            filters={filters}
            setFilters={setFilters}
            feature={feature}
            setFeature={setFeature}
          />
          <CrossSection mask={mask} />
          <DensitySection mask={mask} x={x} y={y} setX={setX} setY={setY} />
        </>
      )}
      <CorrelationSection onPick={pick} />
      <QualitySection />
    </div>
  );
}
