import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ChurnReportPage from './ChurnReportPage';
import { churnReport, riskLevel, thresholdIndex, thresholdPoint } from './churn';

describe('churn report data (K4)', () => {
  it('matches the locked K3 holdout scoring', () => {
    expect(churnReport.model.input_features).toHaveLength(21);
    expect(churnReport.model.excluded_features).toEqual(
      expect.arrayContaining(['Churned', 'Lifetime_Value', 'Total_Purchases']),
    );
    expect(churnReport.holdout.rows).toBe(9992);
    const point = thresholdPoint('holdout', thresholdIndex(churnReport.model.decision_threshold));
    expect(point.threshold).toBe(0.37);
    expect([point.tn, point.fp, point.fn, point.tp]).toEqual(
      churnReport.holdout.confusion_matrix.flat(),
    );
    expect(point.f1).toBeCloseTo(churnReport.holdout.primary.f1, 3);
    expect(point.tp + point.fp + point.fn + point.tn).toBe(9992);
  });
  it('trades precision for recall as the threshold drops', () => {
    const low = thresholdPoint('oof', thresholdIndex(0.2));
    const high = thresholdPoint('oof', thresholdIndex(0.7));
    expect(low.recall).toBeGreaterThan(high.recall);
    expect(low.precision ?? 0).toBeLessThan(high.precision ?? 0);
    expect(low.contacted).toBeGreaterThan(high.contacted);
  });
  it('uses the same risk cut points as the artifact', () => {
    expect(riskLevel(0.12)).toBe('low');
    expect(riskLevel(0.13)).toBe('medium');
    expect(riskLevel(0.58)).toBe('high');
  });
});

describe('ChurnReportPage (K4)', () => {
  it('renders holdout KPIs and reacts to the threshold and budget sliders', () => {
    render(
      <MemoryRouter>
        <ChurnReportPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Dự báo nguy cơ rời bỏ' })).toBeVisible();
    const kpis = screen.getByRole('region', { name: 'Chỉ số trên tập kiểm tra' });
    expect(within(kpis).getByText('0,886')).toBeVisible();
    const table = screen.getByRole('region', { name: 'Bảng so sánh thuật toán' });
    expect(within(table).getAllByRole('row')).toHaveLength(4);

    const result = screen.getByRole('region', { name: 'Kết quả theo ngưỡng cảnh báo' });
    expect(within(result).getByText('2.997')).toBeVisible();
    fireEvent.change(screen.getByRole('slider', { name: 'Ngưỡng cảnh báo' }), {
      target: { value: thresholdIndex(0.8) },
    });
    expect(within(result).queryByText('2.997')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('slider', { name: 'Phần trăm khách liên hệ' }), {
      target: { value: 10 },
    });
    expect(screen.getByRole('status')).toHaveTextContent('33,4%');

    fireEvent.change(screen.getByRole('combobox', { name: 'Bộ thuộc tính' }), {
      target: { value: 'reference22' },
    });
    expect(within(table).getByText(/0,9006/)).toBeVisible();
  });
});
