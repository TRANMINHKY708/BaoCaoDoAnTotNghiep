import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ClusterReportPage from './ClusterReportPage';
import EdaPage from './EdaPage';
import { ModelLab } from './ModelLab';
import clusterReport from './data/clusterReport.json';
import {
  CATEGORICAL,
  MISSING_CODE,
  NUMERIC,
  ROWS,
  binnedStats,
  buildMask,
  codes,
  crossTab,
  density,
  eda,
  histogram,
  levelsOf,
  noFilters,
  numericColumn,
} from './explorer';
import { acceptedScores, modelLab, pairs, runs } from './labData';

// Training-partition class counts of the locked T3 split.
const TRAIN_CLASSES = { Low: 15162, Medium: 12104, High: 12702 };

describe('EDA data (training partition only)', () => {
  it('ships one code per training row for every column and never the holdout', () => {
    expect(ROWS).toBe(39968);
    expect(eda.scope).toMatch(/holdout is excluded/);
    for (const name of [...NUMERIC, ...CATEGORICAL]) expect(codes(name)).toHaveLength(ROWS);
    expect(levelsOf('Segment')).toEqual([
      'Tương tác thấp',
      'Tương tác trung bình',
      'Tương tác cao',
    ]);
  });

  it('filters exactly: the label filter reproduces the split class counts', () => {
    const levels = levelsOf('Purchase_Level');
    for (const [name, count] of Object.entries(TRAIN_CLASSES)) {
      const { rows } = buildMask({
        levels: { Purchase_Level: [levels.indexOf(name)] },
        range: null,
      });
      expect(rows).toBe(count);
    }
    expect(buildMask(noFilters).rows).toBe(ROWS);
    const both = buildMask({
      levels: { Purchase_Level: [levels.indexOf('High')], Churned: [1] },
      range: null,
    });
    expect(both.rows).toBeLessThan(TRAIN_CLASSES.High);
  });

  it('keeps missing values out of ranges and out of histogram bins', () => {
    const { mask } = buildMask(noFilters);
    const hist = histogram('Social_Media_Engagement_Score', mask, 'Purchase_Level');
    const total = hist.totals.reduce((a, b) => a + b, 0) + hist.missing.reduce((a, b) => a + b, 0);
    expect(total).toBe(ROWS);
    expect(hist.missing.reduce((a, b) => a + b, 0)).toBe(
      numericColumn('Social_Media_Engagement_Score').summary.missing,
    );
    const ranged = buildMask({
      levels: {},
      range: { column: 'Social_Media_Engagement_Score', from: 0, to: 100 },
    });
    expect(ranged.rows).toBe(ROWS - numericColumn('Social_Media_Engagement_Score').summary.missing);
    expect(codes('Social_Media_Engagement_Score').includes(MISSING_CODE)).toBe(true);
  });

  it('estimates the median from bins within one bin width of the exact value', () => {
    const { mask } = buildMask(noFilters);
    for (const name of ['Session_Duration_Avg', 'Pages_Per_Session', 'Login_Frequency']) {
      const column = numericColumn(name);
      const estimate = binnedStats(name, histogram(name, mask, null).counts[0] ?? []);
      const width = (column.edges[1] ?? 0) - (column.edges[0] ?? 0);
      expect(Math.abs((estimate.median ?? 0) - (column.summary.median ?? 0))).toBeLessThanOrEqual(
        width,
      );
    }
  });

  it('cross-tabulates and builds 2D densities consistently with the mask', () => {
    const { mask, rows } = buildMask({ levels: { Gender: [0] }, range: null });
    const table = crossTab('Segment', 'Purchase_Level', mask);
    expect(table.flat().reduce((a, b) => a + b, 0)).toBe(rows);
    const grid = density('Session_Duration_Avg', 'Pages_Per_Session', mask);
    expect(grid.rows).toBeLessThanOrEqual(rows);
    expect(grid.counts.flat().reduce((a, b) => a + b, 0)).toBe(grid.rows);
  });
});

describe('EdaPage', () => {
  it('filters the whole page from the shared filter bar', () => {
    render(
      <MemoryRouter>
        <EdaPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Khám phá dữ liệu hành vi' }),
    ).toBeVisible();
    const filters = screen.getByRole('region', { name: 'Bộ lọc dữ liệu' });
    expect(within(filters).getByText('39.968 / 39.968 bản ghi (100%)')).toBeVisible();
    const label = within(filters).getByRole('group', { name: 'Mức mua (nhãn)' });
    fireEvent.click(within(label).getByRole('button', { name: 'Cao' }));
    expect(within(label).getByRole('button', { name: 'Cao' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(filters).getByText(/12\.702 \/ 39\.968 bản ghi/)).toBeVisible();
    fireEvent.click(within(filters).getByRole('button', { name: /Xóa tất cả bộ lọc/ }));
    expect(within(filters).getByText('39.968 / 39.968 bản ghi (100%)')).toBeVisible();
    expect(
      screen.getByRole('img', { name: 'Ma trận tương quan Spearman giữa các thuộc tính' }),
    ).toBeVisible();
  });
});

describe('Model lab (R2-02)', () => {
  it('pairs every configuration once and uses the T4 out-of-fold predictions', () => {
    expect(runs).toHaveLength(8);
    expect(pairs).toHaveLength(28);
    for (const run of runs) expect(run.metrics.macro_f1).toHaveLength(15);
    expect(modelLab.oof.rows).toBe(39968);
    expect(modelLab.oof.scope).toMatch(/not the holdout/);
    const first = modelLab.oof.confidence_curve[0];
    const scores = acceptedScores(first?.matrix ?? [], modelLab.oof.rows);
    expect(scores.coverage).toBeGreaterThan(0.999);
    expect(scores.macroF1 ?? 0).toBeCloseTo(modelLab.oof.macro_f1, 3);
  });

  it('computes accepted-only scores from a confusion matrix', () => {
    const scores = acceptedScores(
      [
        [8, 2, 0],
        [1, 8, 1],
        [0, 0, 10],
      ],
      40,
    );
    expect(scores.accepted).toBe(30);
    expect(scores.coverage).toBeCloseTo(0.75);
    expect(scores.accuracy).toBeCloseTo(26 / 30);
  });

  it('compares two configurations and reacts to the confidence slider', () => {
    render(<ModelLab />);
    expect(screen.getByRole('status')).toHaveTextContent(/Chưa đủ bằng chứng|có ý nghĩa thống kê/);
    const selects = screen.getAllByRole('combobox');
    const modelB = selects.find((s) => s.closest('label')?.textContent?.startsWith('Mô hình B'));
    fireEvent.change(modelB as HTMLElement, { target: { value: 'conservative12:XGBoost' } });
    expect(screen.getByText('Chọn hai cấu hình khác nhau để so sánh.')).toBeVisible();
    const kpis = screen.getByRole('region', { name: 'Kết quả theo ngưỡng tin cậy' });
    const before = within(kpis).getAllByText(/%/)[0]?.textContent;
    fireEvent.change(screen.getByRole('slider', { name: 'Ngưỡng tin cậy' }), {
      target: { value: 40 },
    });
    expect(within(kpis).getAllByText(/%/)[0]?.textContent).not.toBe(before);
  });
});

describe('ClusterReportPage (R2-03)', () => {
  it('shows the fixed K, diagnostics and stability of the T5 artifact', () => {
    expect(clusterReport.k).toBe(3);
    expect(clusterReport.pca.points.x).toHaveLength(3000);
    render(
      <MemoryRouter>
        <ClusterReportPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Đánh giá phân cụm K-Means' }),
    ).toBeVisible();
    const table = screen.getByRole('region', { name: 'Bảng chẩn đoán K' });
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    expect(
      screen.getByRole('img', { name: 'Biểu đồ phân tán PCA của các phân khúc' }),
    ).toBeVisible();
    const hide = screen.getByRole('group', { name: 'Ẩn hoặc hiện nhóm' });
    fireEvent.click(within(hide).getByRole('button', { name: 'Tương tác cao' }));
    expect(within(hide).getByRole('button', { name: 'Tương tác cao' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
