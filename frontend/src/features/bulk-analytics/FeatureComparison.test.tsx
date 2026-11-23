import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { FeatureComparison } from './FeatureComparison';
import { initialDraft, filterRequest } from './filters';
import type { BatchView } from './types';
import { supportedFeatures, valueScale } from './comparisonData';

const model = {
  task: 'segmentation',
  model_version: '1.0.0',
  artifact_sha256: 'a'.repeat(64),
  metadata_sha256: 'b'.repeat(64),
};
const view: BatchView = {
  source: 'postgresql_f09_f10_saved_history',
  as_of: '2026-11-06T01:00:00Z',
  timezone: 'Asia/Ho_Chi_Minh',
  filters: filterRequest(initialDraft),
  fingerprint: 'c'.repeat(64),
  models: [model],
  rows: [],
  offset: 0,
  limit: 50,
  total_rows: 0,
  kpis: {},
  definitions: {},
  data_origins: ['TEST_ONLY'],
  purchase_distribution: [],
  cluster_distribution: [],
  trend: [],
  trend_available: false,
  warnings: [],
  cluster_profiles: [
    {
      cluster: 0,
      records: 3,
      status: 'available',
      means: { Login_Frequency: 47.25, Cart_Abandonment_Rate: 32.75 },
    },
    {
      cluster: 1,
      records: 2,
      status: 'available',
      means: { Login_Frequency: 12.5, Cart_Abandonment_Rate: 69.25 },
    },
  ],
  overall_means: { Login_Frequency: 33.35, Cart_Abandonment_Rate: 47.35 },
};
const group = (id: number) =>
  screen
    .getByText(`Nhóm khách hàng ${id}`, { selector: 'strong' })
    .closest<HTMLElement>('.comparison-row')!;

it('selects only known features present in profiles and renders exact raw means, units and native tooltips', () => {
  const data = {
    ...view,
    cluster_profiles: view.cluster_profiles.map((p) => ({
      ...p,
      means: { ...p.means, Unknown_Index: 999 },
    })),
    overall_means: { ...view.overall_means, Average_Order_Value: 99 },
  };
  render(<FeatureComparison data={data} applied={initialDraft} />);
  const selector = screen.getByLabelText('Đặc điểm cần xem');
  expect(within(selector).getAllByRole('option')).toHaveLength(2);
  expect(screen.queryByRole('option', { name: 'Unknown_Index' })).not.toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'Giá trị đơn trung bình' })).not.toBeInTheDocument();
  expect(group(0).querySelector('rect')).toHaveAttribute('data-value', '47.25');
  expect(screen.getByTitle(/Nhóm khách hàng 0: 47.25 lượt/)).toBeInTheDocument();
  expect(screen.getAllByText(/bản ghi kết quả phân nhóm/)).toHaveLength(2);
  fireEvent.change(selector, { target: { value: 'Cart_Abandonment_Rate' } });
  expect(group(0).querySelector('rect')).toHaveAttribute('data-value', '32.75');
  expect(group(1).querySelector('rect')).toHaveAttribute('data-value', '69.25');
  expect(screen.getByTitle(/Nhóm khách hàng 0: 32.75 %/)).toBeInTheDocument();
  expect(group(0).querySelectorAll('rect')).toHaveLength(1);
  expect(screen.queryByTitle(/Nhóm khách hàng 0: 47.25 lượt/)).not.toBeInTheDocument();
});
it('null/missing have no bar, real zero has a zero marker and no fabricated data', () => {
  const data: BatchView = {
    ...view,
    cluster_profiles: [
      { ...view.cluster_profiles[0]!, means: { Login_Frequency: 0 } },
      { ...view.cluster_profiles[1]!, means: { Login_Frequency: null } },
      { ...view.cluster_profiles[1]!, cluster: 2, means: {} },
    ],
    overall_means: {},
  };
  render(<FeatureComparison data={data} applied={initialDraft} />);
  expect(group(0).querySelector('circle')).toHaveAttribute('data-value', '0');
  for (const id of [1, 2]) {
    expect(within(group(id)).getByText('Không có dữ liệu')).toBeInTheDocument();
    expect(group(id).querySelector('svg')).toBeNull();
  }
  expect(screen.queryByText('0%')).not.toBeInTheDocument();
  expect(document.querySelector('.comparison-reference')).toBeNull();
});
it('plots negative means to the left of zero without truncating the axis', () => {
  render(
    <FeatureComparison
      applied={initialDraft}
      data={{
        ...view,
        cluster_profiles: view.cluster_profiles.map((p, i) => ({
          ...p,
          means: { Login_Frequency: i ? 10 : -5 },
        })),
        overall_means: {},
      }}
    />,
  );
  const bar = group(0).querySelector('rect')!,
    zero = group(0).querySelector('.comparison-zero')!;
  expect(bar).toHaveAttribute('data-value', '-5');
  expect(Number(bar.getAttribute('x'))).toBeLessThan(Number(zero.getAttribute('x1')));
  expect(Number(bar.getAttribute('width'))).toBeGreaterThan(0);
  expect(screen.getByText('-5', { selector: '.comparison-axis span' })).toBeInTheDocument();
});
it.each(
  [
    [],
    [model, { ...model, artifact_sha256: 'd'.repeat(64) }],
    [{ ...model, model_version: '2.0.0-snapshot-k3' }],
  ].map((models) => ({ models })),
)('blocks absent, ambiguous or mismatched model identities', ({ models }) => {
  render(<FeatureComparison data={{ ...view, models }} applied={initialDraft} />);
  expect(screen.getByText(/Chưa xác minh được phạm vi/)).toBeInTheDocument();
  expect(screen.queryByLabelText('Đặc điểm cần xem')).not.toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
it('does not borrow overall means from another response scope or data source', () => {
  const rendered = render(
    <FeatureComparison
      data={{ ...view, filters: { ...view.filters, cluster: 2 } }}
      applied={initialDraft}
    />,
  );
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  rendered.rerender(
    <FeatureComparison
      data={{ ...view, source: 'research' } as unknown as BatchView}
      applied={initialDraft}
    />,
  );
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(document.querySelector('.comparison-reference')).toBeNull();
});
it('shows the verified overall reference in the same raw output unit', () => {
  render(<FeatureComparison data={view} applied={initialDraft} />);
  expect(document.querySelectorAll('.comparison-reference')).toHaveLength(2);
  document.querySelectorAll('.comparison-reference title').forEach((title) => {
    expect(title).toHaveTextContent('Trung bình trong phạm vi lọc: 33.35 lượt đăng nhập');
  });
  expect(
    screen.queryByText(/Trung bình toàn phạm vi đang lọc:/, { selector: 'p' }),
  ).not.toBeInTheDocument();
});
it('a single applied cluster remains explicit, with no reset action in this component', () => {
  const applied = { ...initialDraft, cluster: '1' };
  render(
    <FeatureComparison
      data={{
        ...view,
        filters: filterRequest(applied),
        cluster_profiles: [view.cluster_profiles[1]!],
      }}
      applied={applied}
    />,
  );
  expect(screen.getByText(/Chỉ có một nhóm được trả về/)).toBeInTheDocument();
  expect(screen.getByText(/Đang lọc nhóm khách hàng 1/)).toBeInTheDocument();
  expect(screen.getAllByRole('img')).toHaveLength(1);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('empty segmentation history, missing all features and all-null mean have honest states', () => {
  const rendered = render(
    <FeatureComparison data={{ ...view, cluster_profiles: [] }} applied={initialDraft} />,
  );
  expect(screen.getByText(/Chưa có kết quả phân nhóm đã lưu/)).toBeInTheDocument();
  rendered.rerender(
    <FeatureComparison
      data={{
        ...view,
        cluster_profiles: [{ ...view.cluster_profiles[0]!, means: { Unknown: 1 } }],
      }}
      applied={initialDraft}
    />,
  );
  expect(screen.getByText(/Không có đặc điểm phù hợp/)).toBeInTheDocument();
  rendered.rerender(
    <FeatureComparison
      data={{
        ...view,
        cluster_profiles: [{ ...view.cluster_profiles[0]!, means: { Login_Frequency: null } }],
      }}
      applied={initialDraft}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Không có dữ liệu trung bình hợp lệ');
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
it('insufficient samples and non-finite values cannot produce bars or zero placeholders', () => {
  render(
    <FeatureComparison
      data={{
        ...view,
        cluster_profiles: [
          {
            ...view.cluster_profiles[0]!,
            records: 1,
            status: 'insufficient_data',
            means: { Login_Frequency: 12 },
          },
          { ...view.cluster_profiles[1]!, means: { Login_Frequency: NaN } },
        ],
        overall_means: { Login_Frequency: Infinity },
      }}
      applied={initialDraft}
    />,
  );
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(document.querySelector('.comparison-reference')).toBeNull();
});
it('incomplete profiles fail closed without inventing sample counts', () => {
  render(
    <FeatureComparison
      data={
        {
          ...view,
          cluster_profiles: [{ cluster: 0, means: { Login_Frequency: 10 } }],
        } as unknown as BatchView
      }
      applied={initialDraft}
    />,
  );
  expect(screen.getByText(/Chưa xác minh được phạm vi/)).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
it('keeps unclear duration/currency units explicit and retains responsive SVG + readable HTML labels', () => {
  render(
    <FeatureComparison
      data={{
        ...view,
        data_origins: ['TEST_ONLY_' + 'source'.repeat(80)],
        cluster_profiles: [
          {
            ...view.cluster_profiles[0]!,
            means: { Session_Duration_Avg: 2.5, Average_Order_Value: 120.75 },
          },
        ],
      }}
      applied={initialDraft}
    />,
  );
  expect(
    screen.getByText(/đơn vị thời lượng của nguồn, chưa xác minh/, { selector: 'p' }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Đặc điểm cần xem'), {
    target: { value: 'Average_Order_Value' },
  });
  expect(
    screen.getByText(/đơn vị tiền tệ của nguồn, chưa xác minh/, { selector: 'p' }),
  ).toBeInTheDocument();
  expect(screen.queryByText('VND')).not.toBeInTheDocument();
  expect(screen.getByRole('img')).toHaveAttribute('viewBox', '0 0 600 40');
});
it('coordinate scaling is finite, includes zero and preserves relative raw distances', () => {
  const scale = valueScale([-5, 10]);
  expect(scale.low).toBe(-5);
  expect(scale.high).toBe(10);
  expect((scale.x(0) - scale.x(-5)) / (scale.x(10) - scale.x(0))).toBeCloseTo(0.5);
  expect(valueScale([0]).x(0)).toBe(16);
  expect(Number.isFinite(valueScale([-1e308, 1e308]).x(0))).toBe(true);
  expect(supportedFeatures([{ ...view.cluster_profiles[0]!, means: { Unknown: 1 } }])).toEqual([]);
});
