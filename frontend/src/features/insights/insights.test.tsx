import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import InsightsPage from './InsightsPage';
import ModelReportPage from './ModelReportPage';
import { BehaviourAdvice } from './BehaviourAdvice';
import { ENGAGEMENT_FEATURES, behaviourGaps, fixed, num, pValue, research } from './insights';

const thresholds = research.shap.thresholds;

function atThreshold(scale: number) {
  return Object.fromEntries(
    ENGAGEMENT_FEATURES.map((feature) => [feature, (thresholds[feature].threshold ?? 0) * scale]),
  );
}

describe('research insights data', () => {
  it('ships the locked R2 headline results', () => {
    expect(research.eda.rows).toBe(49960);
    expect(research.holdout.rows).toBe(9992);
    expect(research.holdout.conservative12.metrics.macro_f1).toBeCloseTo(0.7034, 4);
    expect(research.leakage.spearman_ltv_over_aov).toBeGreaterThan(0.9);
    const shares = research.shap.ranking.reduce((sum, row) => sum + row.share_percent, 0);
    expect(shares).toBeGreaterThan(99);
    expect(shares).toBeLessThan(101);
    for (const feature of ENGAGEMENT_FEATURES) {
      expect(thresholds[feature].threshold).toBeGreaterThan(0);
      expect(research.eda.behaviour_curves[feature].length).toBeGreaterThanOrEqual(5);
    }
  });

  it('formats numbers the Vietnamese way', () => {
    expect(fixed(0.70341, 3)).toBe('0,703');
    expect(num(49960, 0)).toBe('49.960');
    expect(pValue(0.0001)).toBe('p < 0,001');
    expect(pValue(0.1074)).toBe('p = 0,107');
  });
});

describe('behaviourGaps', () => {
  it('flags every behaviour below threshold and orders the strongest lever first', () => {
    const result = behaviourGaps(atThreshold(0.5));
    expect(result.below).toHaveLength(6);
    expect(result.above).toEqual([]);
    // Equal relative gaps: ordering falls back to global SHAP share (session duration is top).
    expect(result.below[0]?.feature).toBe('Session_Duration_Avg');
    expect(result.below[0]?.gapPercent).toBeCloseTo(50, 5);
  });

  it('treats values at or above threshold as reached and never imputes missing values', () => {
    const values: Record<string, number | null> = atThreshold(1);
    values.Wishlist_Items = null;
    delete values.Email_Open_Rate;
    const result = behaviourGaps(values);
    expect(result.below).toEqual([]);
    expect(result.above).toHaveLength(4);
    expect(result.missing).toEqual(['Email_Open_Rate', 'Wishlist_Items']);
  });
});

describe('research pages', () => {
  it('renders behaviour insights with SHAP ranking, thresholds and segments', () => {
    render(
      <MemoryRouter>
        <InsightsPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Phân tích hành vi mua hàng' }),
    ).toBeVisible();
    const ranking = screen.getByRole('list', { name: 'Xếp hạng mức ảnh hưởng SHAP' });
    expect(within(ranking).getAllByRole('listitem')).toHaveLength(research.shap.ranking.length);
    expect(within(ranking).getAllByRole('listitem')[0]).toHaveTextContent('Thời lượng phiên TB');
    expect(screen.getAllByRole('img', { name: /Tỷ lệ mua cao theo/ })).toHaveLength(6);
    for (const name of ['Tương tác thấp', 'Tương tác trung bình', 'Tương tác cao']) {
      expect(screen.getByRole('heading', { level: 3, name })).toBeVisible();
    }
    expect(screen.getByText(/không phải dự báo/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Kết quả mô hình' })).toHaveAttribute(
      'href',
      '/model-report',
    );
  });

  it('renders the model report with holdout metrics, comparison and leakage evidence', () => {
    render(
      <MemoryRouter>
        <ModelReportPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Kết quả mô hình' })).toBeVisible();
    expect(screen.getByText('0,703')).toBeVisible();
    const matrix = screen.getByRole('table', { name: /Ma trận nhầm lẫn trên .* holdout/ });
    expect(within(matrix).getAllByRole('row')).toHaveLength(4);
    const comparison = screen.getByRole('region', { name: 'So sánh mô hình conservative12' });
    expect(within(comparison).getAllByRole('row')).toHaveLength(5);
    expect(within(comparison).getByText('Tốt nhất')).toBeVisible();
    expect(screen.getByText(/Spearman\(LTV \/ AOV, Total_Purchases\)/)).toBeVisible();
    expect(screen.getByText(/không dự báo hành vi tương lai/)).toBeVisible();
  });
});

describe('BehaviourAdvice', () => {
  it('lists at most three gaps with concrete thresholds', () => {
    render(
      <MemoryRouter>
        <BehaviourAdvice values={atThreshold(0.4)} capturedAt="01/11/2026" />
      </MemoryRouter>,
    );
    const panel = screen.getByRole('region', { name: 'Gợi ý hành động theo hành vi' });
    expect(within(panel).getAllByRole('listitem')).toHaveLength(3);
    expect(panel).toHaveTextContent('Còn 3 hành vi khác dưới ngưỡng');
    expect(panel).toHaveTextContent('01/11/2026');
  });

  it('suggests loyalty care when all behaviours reach the thresholds', () => {
    render(
      <MemoryRouter>
        <BehaviourAdvice values={atThreshold(1.2)} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Các hành vi tương tác đều đạt hoặc vượt ngưỡng')).toBeVisible();
  });

  it('does not invent advice when no engagement data exists', () => {
    render(
      <MemoryRouter>
        <BehaviourAdvice values={{}} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Chưa đủ dữ liệu hành vi để gợi ý')).toBeVisible();
  });
});
