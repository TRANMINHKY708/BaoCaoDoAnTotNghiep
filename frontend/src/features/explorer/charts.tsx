import type { ReactNode } from 'react';
import { num } from '../insights/insights';
import { tint } from './colors';

export interface Series {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
}

const W = 640;

function ticks(lo: number, hi: number, count = 4) {
  if (hi === lo) return [lo];
  return Array.from({ length: count + 1 }, (_, i) => lo + ((hi - lo) * i) / count);
}

/**
 * Vertical bars (one series) or lines (several series) over ordered categories.
 * `references` are vertical markers at fractional category positions (0 = first category centre).
 */
export function ColumnChart({
  categories,
  series,
  label,
  yLabel,
  yFormat = (v) => num(v, 1),
  mode,
  references = [],
  highlight,
  onSelect,
  height = 230,
  yMin,
  everyLabel,
}: {
  categories: string[];
  series: Series[];
  label: string;
  yLabel: string;
  yFormat?: (value: number) => string;
  mode?: 'bars' | 'lines';
  references?: { at: number; text: string }[];
  highlight?: { from: number; to: number } | null;
  onSelect?: (index: number) => void;
  height?: number;
  yMin?: number;
  everyLabel?: number;
}) {
  const kind = mode ?? (series.length > 1 ? 'lines' : 'bars');
  const pad = { left: 52, right: 12, top: 14, bottom: 46 };
  const values = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const top = Math.max(...values, Number.EPSILON);
  const bottom = yMin ?? Math.min(0, ...values);
  const span = top - bottom || 1;
  const zero = Math.min(Math.max(0, bottom), top);
  const plotW = W - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const step = plotW / Math.max(categories.length, 1);
  const cx = (i: number) => pad.left + step * (i + 0.5);
  const sy = (v: number) => pad.top + (1 - (v - bottom) / span) * plotH;
  const labelEvery = everyLabel ?? Math.max(1, Math.ceil(categories.length / 10));
  return (
    <svg className="x-chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label}>
      {ticks(bottom, top).map((t) => (
        <g key={t}>
          <line x1={pad.left} x2={W - pad.right} y1={sy(t)} y2={sy(t)} className="x-grid" />
          <text x={pad.left - 6} y={sy(t) + 3} textAnchor="end" className="x-tick">
            {yFormat(t)}
          </text>
        </g>
      ))}
      {highlight && (
        <rect
          x={pad.left + step * highlight.from}
          width={step * (highlight.to - highlight.from + 1)}
          y={pad.top}
          height={plotH}
          className="x-highlight"
        />
      )}
      {kind === 'bars'
        ? series.map((s) =>
            s.values.map((v, i) =>
              v === null ? null : (
                <rect
                  key={`${s.key}-${i}`}
                  x={cx(i) - step * 0.42}
                  width={step * 0.84}
                  y={Math.min(sy(v), sy(zero))}
                  height={Math.abs(sy(v) - sy(zero))}
                  fill={s.color}
                  className={onSelect ? 'x-bar x-clickable' : 'x-bar'}
                  onClick={onSelect ? () => onSelect(i) : undefined}
                >
                  <title>{`${categories[i]}: ${yFormat(v)}`}</title>
                </rect>
              ),
            ),
          )
        : series.map((s) => {
            const points = s.values
              .map((v, i) => (v === null ? null : `${cx(i).toFixed(1)},${sy(v).toFixed(1)}`))
              .filter(Boolean);
            return (
              <g key={s.key}>
                <polyline points={points.join(' ')} stroke={s.color} className="x-line" />
                {s.values.map((v, i) =>
                  v === null ? null : (
                    <circle key={i} cx={cx(i)} cy={sy(v)} r={2.6} fill={s.color}>
                      <title>{`${s.label} · ${categories[i]}: ${yFormat(v)}`}</title>
                    </circle>
                  ),
                )}
              </g>
            );
          })}
      {references.map((r) => (
        <g key={r.text}>
          <line
            x1={cx(r.at)}
            x2={cx(r.at)}
            y1={pad.top}
            y2={pad.top + plotH}
            className="x-reference"
          />
          <text x={cx(r.at) + 4} y={pad.top + 10} className="x-reference-text">
            {r.text}
          </text>
        </g>
      ))}
      <line
        x1={pad.left}
        x2={W - pad.right}
        y1={pad.top + plotH}
        y2={pad.top + plotH}
        className="x-axis"
      />
      {categories.map((c, i) =>
        i % labelEvery === 0 ? (
          <text
            key={c + i}
            x={cx(i)}
            y={pad.top + plotH + 14}
            textAnchor="end"
            transform={`rotate(-35 ${cx(i)} ${pad.top + plotH + 14})`}
            className="x-tick"
          >
            {c}
          </text>
        ) : null,
      )}
      <text
        x={12}
        y={pad.top + plotH / 2}
        transform={`rotate(-90 12 ${pad.top + plotH / 2})`}
        textAnchor="middle"
        className="x-tick"
      >
        {yLabel}
      </text>
    </svg>
  );
}

export function Legend({ items }: { items: { key: string; label: ReactNode; color: string }[] }) {
  return (
    <div className="legend">
      {items.map((item) => (
        <span key={item.key}>
          <i style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Heat grid. `diverging` colours negative values with `negativeColor` and positive ones with
 * `positiveColor`, scaled by |value| / max(|domain|).
 */
export function HeatGrid({
  rows,
  cols,
  values,
  label,
  format,
  domain,
  positiveColor = 'var(--insight-high)',
  negativeColor = 'var(--insight-low)',
  onCell,
  selected,
  cellTitle,
  showValues = true,
  rowLabelWidth = 150,
  colLabelHeight = 110,
  cell = 26,
}: {
  rows: string[];
  cols: string[];
  values: (number | null)[][];
  label: string;
  format: (value: number) => string;
  domain: [number, number];
  positiveColor?: string;
  negativeColor?: string;
  onCell?: (row: number, col: number) => void;
  selected?: [number, number] | null;
  cellTitle?: (row: number, col: number, value: number | null) => string;
  showValues?: boolean;
  rowLabelWidth?: number;
  colLabelHeight?: number;
  cell?: number;
}) {
  const width = rowLabelWidth + cols.length * cell + 4;
  const height = colLabelHeight + rows.length * cell + 4;
  const scale = Math.max(Math.abs(domain[0]), Math.abs(domain[1])) || 1;
  return (
    <svg
      className="x-heat"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      style={{ maxWidth: width * 1.25 }}
    >
      {cols.map((c, j) => (
        <text
          key={j}
          x={rowLabelWidth + j * cell + cell / 2}
          y={colLabelHeight - 6}
          transform={`rotate(-50 ${rowLabelWidth + j * cell + cell / 2} ${colLabelHeight - 6})`}
          className="x-tick"
        >
          {c}
        </text>
      ))}
      {rows.map((r, i) => (
        <g key={i}>
          <text
            x={rowLabelWidth - 6}
            y={colLabelHeight + i * cell + cell / 2 + 3}
            textAnchor="end"
            className="x-tick"
          >
            {r}
          </text>
          {cols.map((c, j) => {
            const v = values[i]?.[j] ?? null;
            const fill =
              v === null
                ? 'var(--surface-soft)'
                : tint(v < 0 ? negativeColor : positiveColor, Math.abs(v) / scale);
            const isSelected = selected?.[0] === i && selected?.[1] === j;
            return (
              <g
                key={j}
                className={onCell ? 'x-clickable' : undefined}
                onClick={onCell ? () => onCell(i, j) : undefined}
              >
                <rect
                  x={rowLabelWidth + j * cell}
                  y={colLabelHeight + i * cell}
                  width={cell - 1.5}
                  height={cell - 1.5}
                  rx={2}
                  fill={fill}
                  className={isSelected ? 'x-cell-selected' : undefined}
                >
                  <title>
                    {cellTitle
                      ? cellTitle(i, j, v)
                      : `${r} × ${c}: ${v === null ? '—' : format(v)}`}
                  </title>
                </rect>
                {showValues && v !== null && (
                  <text
                    x={rowLabelWidth + j * cell + cell / 2 - 0.75}
                    y={colLabelHeight + i * cell + cell / 2 + 3}
                    textAnchor="middle"
                    className={Math.abs(v) / scale > 0.55 ? 'x-cell-text strong' : 'x-cell-text'}
                  >
                    {format(v)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

/** Box rows: one horizontal box (p5, q1, median, q3, p95) per group on a shared axis. */
export function BoxRows({
  rows,
  label,
  format = (v) => num(v, 1),
}: {
  rows: {
    key: string;
    label: string;
    color: string;
    q: [number, number, number, number, number];
  }[];
  label: string;
  format?: (value: number) => string;
}) {
  const height = 34 * rows.length + 30;
  const pad = { left: 150, right: 20 };
  const lo = Math.min(...rows.map((r) => r.q[0]));
  const hi = Math.max(...rows.map((r) => r.q[4]));
  const sx = (v: number) => pad.left + ((v - lo) / (hi - lo || 1)) * (W - pad.left - pad.right);
  return (
    <svg className="x-chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label}>
      {ticks(lo, hi).map((t) => (
        <g key={t}>
          <line x1={sx(t)} x2={sx(t)} y1={6} y2={height - 22} className="x-grid" />
          <text x={sx(t)} y={height - 8} textAnchor="middle" className="x-tick">
            {format(t)}
          </text>
        </g>
      ))}
      {rows.map((r, i) => {
        const y = 12 + i * 34;
        const [p5, q1, median, q3, p95] = r.q;
        return (
          <g key={r.key}>
            <title>{`${r.label}: P5 ${format(p5)} · Q1 ${format(q1)} · trung vị ${format(median)} · Q3 ${format(q3)} · P95 ${format(p95)}`}</title>
            <text x={pad.left - 8} y={y + 14} textAnchor="end" className="x-tick">
              {r.label}
            </text>
            <line
              x1={sx(p5)}
              x2={sx(p95)}
              y1={y + 10}
              y2={y + 10}
              stroke={r.color}
              className="x-whisker"
            />
            <rect
              x={sx(q1)}
              width={Math.max(2, sx(q3) - sx(q1))}
              y={y}
              height={20}
              rx={3}
              fill={tint(r.color, 0.35)}
              stroke={r.color}
            />
            <line
              x1={sx(median)}
              x2={sx(median)}
              y1={y}
              y2={y + 20}
              stroke={r.color}
              className="x-median"
            />
          </g>
        );
      })}
    </svg>
  );
}

/** Rows of dots (e.g. one dot per CV fold) with a mean tick and a ±1 SD band per row. */
export function DotStrip({
  rows,
  label,
  format,
}: {
  rows: { key: string; label: string; color: string; values: number[]; emphasis?: boolean }[];
  label: string;
  format: (value: number) => string;
}) {
  const height = 30 * rows.length + 30;
  const pad = { left: 190, right: 70 };
  const all = rows.flatMap((r) => r.values);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const margin = (hi - lo) * 0.06 || 0.001;
  const sx = (v: number) =>
    pad.left + ((v - lo + margin) / (hi - lo + 2 * margin)) * (W - pad.left - pad.right);
  return (
    <svg className="x-chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label}>
      {ticks(lo, hi).map((t) => (
        <g key={t}>
          <line x1={sx(t)} x2={sx(t)} y1={4} y2={height - 22} className="x-grid" />
          <text x={sx(t)} y={height - 8} textAnchor="middle" className="x-tick">
            {format(t)}
          </text>
        </g>
      ))}
      {rows.map((r, i) => {
        const y = 18 + i * 30;
        const mean = r.values.reduce((a, b) => a + b, 0) / r.values.length;
        const sd = Math.sqrt(
          r.values.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, r.values.length - 1),
        );
        return (
          <g key={r.key}>
            <text
              x={pad.left - 10}
              y={y + 4}
              textAnchor="end"
              className={r.emphasis ? 'x-tick strong' : 'x-tick'}
            >
              {r.label}
            </text>
            <rect
              x={sx(mean - sd)}
              width={Math.max(1, sx(mean + sd) - sx(mean - sd))}
              y={y - 8}
              height={16}
              rx={3}
              fill={tint(r.color, 0.18)}
            />
            {r.values.map((v, j) => (
              <circle key={j} cx={sx(v)} cy={y} r={3} fill={r.color} className="x-dot">
                <title>{`${r.label} · lần ${j + 1}: ${format(v)}`}</title>
              </circle>
            ))}
            <line x1={sx(mean)} x2={sx(mean)} y1={y - 10} y2={y + 10} className="x-mean" />
            <text x={W - pad.right + 8} y={y + 4} className="x-tick strong">
              {format(mean)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Scatter of up to a few thousand points with optional large markers (e.g. centroids). */
export function Scatter({
  points,
  markers = [],
  label,
  xLabel,
  yLabel,
  height = 380,
}: {
  points: { x: number; y: number; color: string }[];
  markers?: { x: number; y: number; color: string; label: string }[];
  label: string;
  xLabel: string;
  yLabel: string;
  height?: number;
}) {
  const pad = { left: 44, right: 14, top: 12, bottom: 40 };
  const xs = [...points.map((p) => p.x), ...markers.map((m) => m.x)];
  const ys = [...points.map((p) => p.y), ...markers.map((m) => m.y)];
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const sx = (v: number) => pad.left + ((v - x0) / (x1 - x0 || 1)) * (W - pad.left - pad.right);
  const sy = (v: number) =>
    pad.top + (1 - (v - y0) / (y1 - y0 || 1)) * (height - pad.top - pad.bottom);
  return (
    <svg className="x-chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label}>
      {ticks(x0, x1).map((t) => (
        <g key={`x${t}`}>
          <line x1={sx(t)} x2={sx(t)} y1={pad.top} y2={height - pad.bottom} className="x-grid" />
          <text x={sx(t)} y={height - pad.bottom + 14} textAnchor="middle" className="x-tick">
            {num(Math.abs(t) < 0.05 ? 0 : t, 1)}
          </text>
        </g>
      ))}
      {ticks(y0, y1).map((t) => (
        <g key={`y${t}`}>
          <line x1={pad.left} x2={W - pad.right} y1={sy(t)} y2={sy(t)} className="x-grid" />
          <text x={pad.left - 6} y={sy(t) + 3} textAnchor="end" className="x-tick">
            {num(Math.abs(t) < 0.05 ? 0 : t, 1)}
          </text>
        </g>
      ))}
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={2} fill={p.color} className="x-point" />
      ))}
      {markers.map((m) => (
        <g key={m.label}>
          <circle cx={sx(m.x)} cy={sy(m.y)} r={9} fill={m.color} className="x-marker" />
          <text x={sx(m.x)} y={sy(m.y) - 15} textAnchor="middle" className="x-marker-text">
            {m.label}
          </text>
        </g>
      ))}
      <text x={(W + pad.left) / 2} y={height - 6} textAnchor="middle" className="x-tick">
        {xLabel}
      </text>
      <text
        x={12}
        y={height / 2}
        transform={`rotate(-90 12 ${height / 2})`}
        textAnchor="middle"
        className="x-tick"
      >
        {yLabel}
      </text>
    </svg>
  );
}

/** Accessible toggle chips for a multi-select filter. */
export function Chips({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: number; label: string; color?: string }[];
  selected: number[];
  onToggle: (value: number) => void;
}) {
  return (
    <div className="x-chips" role="group" aria-label={label}>
      <span className="x-chips-label">{label}</span>
      {options.map((option) => {
        const pressed = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            className="x-chip"
            aria-pressed={pressed}
            onClick={() => onToggle(option.value)}
          >
            {option.color && <i style={{ background: option.color }} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
