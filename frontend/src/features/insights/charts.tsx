import type { ReactNode } from 'react';
import { num } from './insights';

export interface BarRow {
  key: string;
  label: ReactNode;
  value: number;
  display: string;
  parts?: { value: number; color: string; title: string }[];
  muted?: boolean;
}

/** Horizontal bars. With `parts`, each bar is stacked (parts must sum to `value`). */
export function BarList({ rows, max, label }: { rows: BarRow[]; max?: number; label: string }) {
  const top = max ?? Math.max(...rows.map((row) => row.value), Number.EPSILON);
  return (
    <ul className="bar-list" aria-label={label}>
      {rows.map((row) => (
        <li key={row.key} className={row.muted ? 'bar-muted' : undefined}>
          <span className="bar-label">{row.label}</span>
          <span className="bar-track" aria-hidden="true">
            {row.parts ? (
              row.parts.map((part, i) => (
                <span
                  key={i}
                  className="bar-fill"
                  title={part.title}
                  style={{ width: `${(100 * part.value) / top}%`, background: part.color }}
                />
              ))
            ) : (
              <span className="bar-fill" style={{ width: `${(100 * row.value) / top}%` }} />
            )}
          </span>
          <span className="bar-value">{row.display}</span>
        </li>
      ))}
    </ul>
  );
}

/** One 100% stacked bar, e.g. purchase-level mix of a segment. */
export function ShareBar({
  parts,
  label,
}: {
  parts: { key: string; value: number; color: string; title: string }[];
  label: string;
}) {
  return (
    <div className="share-bar" role="img" aria-label={label}>
      {parts.map((part) => (
        <span
          key={part.key}
          title={part.title}
          style={{ width: `${part.value}%`, background: part.color }}
        />
      ))}
    </div>
  );
}

/** Small SVG line chart with a zero line and an optional vertical reference. */
export function LineChart({
  points,
  label,
  yLabel,
  reference,
  zeroLine = false,
  yDomain,
  height = 120,
}: {
  points: { x: number; y: number }[];
  label: string;
  yLabel: string;
  reference?: { x: number; text: string };
  zeroLine?: boolean;
  yDomain?: [number, number];
  height?: number;
}) {
  const width = 280;
  const pad = { left: 30, right: 8, top: 10, bottom: 18 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = yDomain ?? [Math.min(...ys, zeroLine ? 0 : Infinity), Math.max(...ys)];
  const sx = (x: number) => pad.left + ((x - x0) / (x1 - x0 || 1)) * (width - pad.left - pad.right);
  const sy = (y: number) =>
    pad.top + (1 - (y - y0) / (y1 - y0 || 1)) * (height - pad.top - pad.bottom);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`);
  return (
    <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <line
        x1={pad.left}
        x2={width - pad.right}
        y1={height - pad.bottom}
        y2={height - pad.bottom}
        className="axis"
      />
      {zeroLine && y0 < 0 && y1 > 0 && (
        <line x1={pad.left} x2={width - pad.right} y1={sy(0)} y2={sy(0)} className="zero" />
      )}
      {reference && reference.x >= x0 && reference.x <= x1 && (
        <g>
          <line
            x1={sx(reference.x)}
            x2={sx(reference.x)}
            y1={pad.top}
            y2={height - pad.bottom}
            className="reference"
          />
          <text
            x={sx(reference.x) + 3}
            y={pad.top + 8}
            className="reference-text"
            textAnchor={sx(reference.x) > width * 0.7 ? 'end' : 'start'}
            dx={sx(reference.x) > width * 0.7 ? -6 : 0}
          >
            {reference.text}
          </text>
        </g>
      )}
      <path d={path.join(' ')} className="series" />
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={2.2} className="dot">
          <title>{`${num(p.x, 1)} → ${num(p.y, 2)}`}</title>
        </circle>
      ))}
      <text x={pad.left - 4} y={pad.top + 6} textAnchor="end" className="tick">
        {num(y1, 0)}
      </text>
      <text x={pad.left - 4} y={height - pad.bottom} textAnchor="end" className="tick">
        {num(y0, 0)}
      </text>
      <text x={pad.left} y={height - 4} className="tick">
        {num(x0, 0)}
      </text>
      <text x={width - pad.right} y={height - 4} textAnchor="end" className="tick">
        {num(x1, 0)}
      </text>
      <text
        x={10}
        y={height / 2}
        className="tick"
        transform={`rotate(-90 10 ${height / 2})`}
        textAnchor="middle"
      >
        {yLabel}
      </text>
    </svg>
  );
}

export function ConfusionMatrix({
  matrix,
  labels,
  caption,
}: {
  matrix: number[][];
  labels: string[];
  caption: string;
}) {
  const max = Math.max(...matrix.flat());
  return (
    <div className="matrix-wrap" role="region" aria-label={caption} tabIndex={0}>
      <table className="confusion">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Thực tế \ Dự đoán</th>
            {labels.map((l) => (
              <th key={l} scope="col">
                {l}
              </th>
            ))}
            <th scope="col">Đúng</th>
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => {
            const total = row.reduce((a, b) => a + b, 0);
            return (
              <tr key={labels[i]}>
                <th scope="row">{labels[i]}</th>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={i === j ? 'diag' : undefined}
                    style={{ ['--heat' as string]: (cell / max).toFixed(3) }}
                  >
                    {num(cell, 0)}
                  </td>
                ))}
                <td className="recall">{num((100 * (row[i] ?? 0)) / (total || 1), 1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="insight-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}
