import edaData from './data/edaData.json';
import { classLabel, type PurchaseClass } from '../insights/insights';
import { labels } from '../predictions/prediction';

/**
 * Interactive EDA over the T3 training partition (scripts/export_research_explorer.py).
 * Every column is shipped as one symbol per row: numeric values as a bin code, categorical
 * values as a level code. Filtering and aggregation run in the browser on these codes, so
 * counts are exact while means/medians of numeric columns are bin-based estimates.
 */
export const eda = edaData;

export interface NumericColumn {
  kind: 'integer' | 'continuous';
  edges: number[];
  codes: string;
  summary: {
    count: number;
    missing: number;
    mean: number | null;
    std: number | null;
    min: number | null;
    q1: number | null;
    median: number | null;
    q3: number | null;
    max: number | null;
    skew: number | null;
    iqr_outliers: number;
    clipped_low: number;
    clipped_high: number;
  };
}
export interface CategoricalColumn {
  kind: 'categorical';
  levels: string[];
  codes: string;
}
export type Column = NumericColumn | CategoricalColumn;

const columns = eda.columns as unknown as Record<string, Column>;
export const NUMERIC = eda.numeric as string[];
export const CATEGORICAL = eda.categorical as string[];
export const ROWS = eda.rows;
export const MISSING_CODE = 255;

export function column(name: string): Column {
  const item = columns[name];
  if (!item) throw new Error(`Unknown EDA column ${name}`);
  return item;
}
export function numericColumn(name: string): NumericColumn {
  const item = column(name);
  if (item.kind === 'categorical') throw new Error(`${name} is categorical`);
  return item;
}
export function categoricalColumn(name: string): CategoricalColumn {
  const item = column(name);
  if (item.kind !== 'categorical') throw new Error(`${name} is numeric`);
  return item;
}
export const binCount = (name: string) => numericColumn(name).edges.length - 1;
export const levelsOf = (name: string) => categoricalColumn(name).levels;

const decoded = new Map<string, Uint8Array>();
const symbol = new Map([...eda.alphabet].map((char, index) => [char, index]));

/** Decoded codes of one column (memoised); MISSING_CODE marks a missing value. */
export function codes(name: string): Uint8Array {
  const cached = decoded.get(name);
  if (cached) return cached;
  const text = column(name).codes;
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = symbol.get(text[i] ?? '') ?? MISSING_CODE;
  decoded.set(name, out);
  return out;
}

export interface RangeFilter {
  column: string;
  from: number;
  to: number;
}
export interface Filters {
  /** Selected level indices per categorical column; an empty or absent list keeps every level. */
  levels: Record<string, number[]>;
  range: RangeFilter | null;
}
export const noFilters: Filters = { levels: {}, range: null };

export function activeFilterCount(filters: Filters) {
  return (
    Object.values(filters.levels).filter((selected) => selected.length > 0).length +
    (filters.range ? 1 : 0)
  );
}

/** Row mask (1 = kept) for the given filters, plus the number of rows kept. */
export function buildMask(filters: Filters): { mask: Uint8Array; rows: number } {
  const mask = new Uint8Array(ROWS).fill(1);
  for (const [name, selected] of Object.entries(filters.levels)) {
    if (!selected.length) continue;
    const allowed = new Set(selected);
    const values = codes(name);
    for (let i = 0; i < ROWS; i++) if (!allowed.has(values[i] ?? MISSING_CODE)) mask[i] = 0;
  }
  if (filters.range) {
    const { from, to } = filters.range;
    const values = codes(filters.range.column);
    for (let i = 0; i < ROWS; i++) {
      const value = values[i] ?? MISSING_CODE;
      if (value === MISSING_CODE || value < from || value > to) mask[i] = 0;
    }
  }
  let rows = 0;
  for (let i = 0; i < ROWS; i++) rows += mask[i] ?? 0;
  return { mask, rows };
}

export interface Histogram {
  groups: string[];
  /** counts[group][bin] */
  counts: number[][];
  missing: number[];
  totals: number[];
}

/** Bin counts of a numeric column within the mask, optionally split by a categorical column. */
export function histogram(name: string, mask: Uint8Array, groupBy: string | null): Histogram {
  const bins = binCount(name);
  const groups = groupBy ? levelsOf(groupBy) : ['Tất cả'];
  const counts = groups.map(() => new Array<number>(bins).fill(0));
  const missing = groups.map(() => 0);
  const values = codes(name);
  const group = groupBy ? codes(groupBy) : null;
  for (let i = 0; i < ROWS; i++) {
    if (!mask[i]) continue;
    const g = group ? (group[i] ?? MISSING_CODE) : 0;
    const row = counts[g];
    if (!row) continue;
    const value = values[i] ?? MISSING_CODE;
    if (value === MISSING_CODE) missing[g] = (missing[g] ?? 0) + 1;
    else row[value] = (row[value] ?? 0) + 1;
  }
  const totals = counts.map((row) => row.reduce((a, b) => a + b, 0));
  return { groups, counts, missing, totals };
}

/** Bin midpoint (integer bins are centred on their value). */
export function midpoints(name: string): number[] {
  const { edges } = numericColumn(name);
  return edges.slice(0, -1).map((edge, i) => (edge + (edges[i + 1] ?? edge)) / 2);
}

/** Mean and median estimated from bin counts (linear interpolation inside the median bin). */
export function binnedStats(
  name: string,
  counts: number[],
): { mean: number | null; median: number | null } {
  const { edges, kind } = numericColumn(name);
  const mids = midpoints(name);
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return { mean: null, median: null };
  const mean = counts.reduce((sum, count, i) => sum + count * (mids[i] ?? 0), 0) / total;
  let seen = 0;
  for (let i = 0; i < counts.length; i++) {
    const count = counts[i] ?? 0;
    if (seen + count >= total / 2) {
      if (kind === 'integer') return { mean, median: mids[i] ?? null };
      const lo = edges[i] ?? 0;
      const hi = edges[i + 1] ?? lo;
      return { mean, median: lo + ((total / 2 - seen) / (count || 1)) * (hi - lo) };
    }
    seen += count;
  }
  return { mean, median: null };
}

/** counts[rowLevel][columnLevel] of two categorical columns within the mask. */
export function crossTab(rowsBy: string, columnsBy: string, mask: Uint8Array): number[][] {
  const a = codes(rowsBy);
  const b = codes(columnsBy);
  const table = levelsOf(rowsBy).map(() => new Array<number>(levelsOf(columnsBy).length).fill(0));
  for (let i = 0; i < ROWS; i++) {
    if (!mask[i]) continue;
    const row = table[a[i] ?? MISSING_CODE];
    const j = b[i] ?? MISSING_CODE;
    if (row && j < row.length) row[j] = (row[j] ?? 0) + 1;
  }
  return table;
}

export interface Density {
  counts: number[][];
  /** Share of High purchase level per cell (null when the cell is empty). */
  highShare: (number | null)[][];
  rows: number;
}

/** 2D bin counts (y rows × x columns) of two numeric columns within the mask. */
export function density(x: string, y: string, mask: Uint8Array): Density {
  const xs = codes(x);
  const ys = codes(y);
  const level = codes('Purchase_Level');
  const high = levelsOf('Purchase_Level').indexOf('High');
  const counts = Array.from({ length: binCount(y) }, () => new Array<number>(binCount(x)).fill(0));
  const highs = counts.map((row) => row.map(() => 0));
  let rows = 0;
  for (let i = 0; i < ROWS; i++) {
    const a = xs[i] ?? MISSING_CODE;
    const b = ys[i] ?? MISSING_CODE;
    if (!mask[i] || a === MISSING_CODE || b === MISSING_CODE) continue;
    const row = counts[b];
    const highRow = highs[b];
    if (!row || !highRow) continue;
    row[a] = (row[a] ?? 0) + 1;
    if (level[i] === high) highRow[a] = (highRow[a] ?? 0) + 1;
    rows++;
  }
  const highShare = counts.map((row, j) =>
    row.map((count, i) => (count ? (highs[j]?.[i] ?? 0) / count : null)),
  );
  return { counts, highShare, rows };
}

/** Human label of a column. */
export function columnLabel(name: string): string {
  if (name === 'Purchase_Level') return 'Mức mua (nhãn)';
  if (name === 'Segment') return 'Phân khúc K-Means';
  if (name === 'Churned') return 'Đã rời bỏ';
  return labels[name] ?? name;
}

/** Human label of one categorical level. */
export function levelLabel(name: string, level: string): string {
  if (name === 'Purchase_Level') return classLabel[level as PurchaseClass] ?? level;
  return level;
}

const FALLBACK = 'var(--chart-1)';
const PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--insight-low)',
  'var(--insight-risk)',
  'var(--insight-ok)',
  'var(--chart-3)',
  'var(--insight-mid)',
  'var(--teal)',
];

/** Stable colour per level, with semantic colours for the label, segment and churn columns. */
export function levelColor(name: string, index: number): string {
  if (name === 'Purchase_Level' || name === 'Segment') {
    return ['var(--insight-low)', 'var(--insight-mid)', 'var(--insight-high)'][index] ?? FALLBACK;
  }
  if (name === 'Churned') return index === 1 ? 'var(--insight-risk)' : 'var(--insight-ok)';
  return PALETTE[index % PALETTE.length] ?? FALLBACK;
}

/** Bin label such as "12–15" (continuous) or "12" (integer). */
export function binLabel(name: string, bin: number, format: (value: number) => string): string {
  const { edges, kind } = numericColumn(name);
  const lo = edges[bin] ?? 0;
  const hi = edges[bin + 1] ?? lo;
  return kind === 'integer' ? format((lo + hi) / 2) : `${format(lo)}–${format(hi)}`;
}
