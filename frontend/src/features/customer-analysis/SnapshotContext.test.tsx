import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import fixture from '../../test/fixtures/t16_what_if.json';
import type { AnalysisData } from './analysis';
import { SnapshotContext } from './SnapshotContext';

const customerId = fixture.customer.id;
const a = { ...fixture.snapshot, customer_id: customerId, id: 'snapshot-a', source: 'Nguồn A' };
const b = { ...a, id: 'snapshot-b', source: 'Nguồn B', captured_at: '2026-11-01T00:00:00Z' };
const base = {
  customer_id: customerId,
  behavior_snapshot_id: a.id,
  run_id: 'run-a',
  model_registry_id: 'registry-a',
  model_name: 'TEST_ONLY',
  model_version: '1.0.0',
  created_at: '2026-11-02T00:00:00Z',
};
const prediction = {
  ...base,
  id: 'prediction-a',
  model_id: 'purchase-level-xgboost',
  predicted_class: 0 as const,
  purchase_level: 'Low' as const,
  probability_low: 0.8,
  probability_medium: 0.1,
  probability_high: 0.1,
};
const segment = {
  ...base,
  id: 'segment-b',
  model_id: 'customer-segmentation-kmeans',
  behavior_snapshot_id: b.id,
  cluster: 2,
  segment_name: 'Nhóm của B',
  segment_id: 'legacy:1.0.0:cluster:2',
  distance_to_centroid: 1.2,
};
const data: AnalysisData = {
  snapshots: [a, b],
  predictions: [
    prediction,
    {
      ...prediction,
      id: 'prediction-b',
      behavior_snapshot_id: b.id,
      predicted_class: 2,
      purchase_level: 'High',
    },
  ],
  segments: [segment],
  scenarios: [],
};
function choose(value: string) {
  fireEvent.change(screen.getByLabelText('Chọn snapshot hành vi'), { target: { value } });
}
const scope = () => within(screen.getByRole('region', { name: 'Kết quả của snapshot đang chọn' }));

it('starts in overview and never merges predictions and segments from different snapshots', () => {
  render(<SnapshotContext data={data} customerId={customerId} />);
  expect(screen.getByLabelText('Chọn snapshot hành vi')).toHaveValue('');
  expect(
    screen.queryByRole('region', { name: 'Kết quả của snapshot đang chọn' }),
  ).not.toBeInTheDocument();
  choose(a.id);
  expect(scope().getByText('Low', { selector: '.customer-purchase' })).toBeInTheDocument();
  expect(scope().queryByText('High', { selector: '.customer-purchase' })).not.toBeInTheDocument();
  expect(scope().queryByText('Nhóm của B')).not.toBeInTheDocument();
  expect(screen.getByText('Nguồn A', { selector: 'dd' })).toBeInTheDocument();
  choose(b.id);
  expect(scope().getByText('High', { selector: '.customer-purchase' })).toBeInTheDocument();
  expect(scope().getByText('Nhóm của B')).toBeInTheDocument();
  expect(scope().queryByText('Low', { selector: '.customer-purchase' })).not.toBeInTheDocument();
  choose('');
  expect(
    screen.queryByRole('region', { name: 'Kết quả của snapshot đang chọn' }),
  ).not.toBeInTheDocument();
});

it('retains every run and exact model identity on one snapshot, without inventing checksums', () => {
  render(
    <SnapshotContext
      customerId={customerId}
      data={{
        ...data,
        predictions: [
          prediction,
          {
            ...prediction,
            id: 'other-run',
            model_version: 'other-version',
            model_registry_id: 'other-registry',
            run_id: 'other-run',
          },
          { ...prediction, id: 'third-result', run_id: 'third-run' },
        ],
        segments: [],
      }}
    />,
  );
  choose(a.id);
  expect(scope().getAllByText('Low', { selector: '.customer-purchase' })).toHaveLength(3);
  expect(scope().getByText(/Phiên bản other-version/)).toBeInTheDocument();
  expect(scope().getByText('other-registry')).toBeInTheDocument();
  expect(scope().getByText('third-run', { selector: 'dd' })).toBeInTheDocument();
  expect(scope().getAllByText(/API lịch sử không trả checksum/)).toHaveLength(3);
});

it('separates missing or unknown snapshot links and preserves segmentation namespaces', () => {
  render(
    <SnapshotContext
      customerId={customerId}
      data={{
        ...data,
        predictions: [{ ...prediction, behavior_snapshot_id: null }],
        segments: [{ ...segment, behavior_snapshot_id: 'missing-id' }],
      }}
    />,
  );
  choose(a.id);
  expect(scope().queryByText('Low', { selector: '.customer-purchase' })).not.toBeInTheDocument();
  expect(scope().getByText('Chưa có kết quả liên kết snapshot')).toBeInTheDocument();
  const unlinked = screen
    .getByText('Kết quả chưa xác định snapshot liên kết (2)')
    .closest('details')!;
  fireEvent.click(within(unlinked).getByText(/Kết quả chưa xác định/, { selector: 'summary' }));
  expect(within(unlinked).getByText('Low', { selector: '.customer-purchase' })).toBeInTheDocument();
  expect(within(unlinked).getByText('legacy:1.0.0:cluster:2')).toBeInTheDocument();
});

it('shows honest empty state without inference and leaves What-if out of snapshot scope', () => {
  render(
    <SnapshotContext
      customerId={customerId}
      data={{
        ...data,
        predictions: [],
        segments: [],
        scenarios: fixture.history.items as AnalysisData['scenarios'],
      }}
    />,
  );
  choose(a.id);
  expect(scope().getByText('Chưa có kết quả liên kết snapshot')).toBeInTheDocument();
  expect(scope().queryByText(/What-if/)).not.toBeInTheDocument();
  expect(screen.getByText(/Kịch bản mô phỏng nằm trong lịch sử bên dưới/)).toBeInTheDocument();
});

it('clears selection when a snapshot disappears and does not restore it if it returns', () => {
  const view = render(<SnapshotContext data={data} customerId={customerId} />);
  choose(a.id);
  view.rerender(<SnapshotContext data={{ ...data, snapshots: [b] }} customerId={customerId} />);
  expect(screen.getByLabelText('Chọn snapshot hành vi')).toHaveValue('');
  expect(screen.getByRole('status')).toHaveTextContent('Đã trở về tổng quan');
  view.rerender(<SnapshotContext data={data} customerId={customerId} />);
  expect(screen.getByLabelText('Chọn snapshot hành vi')).toHaveValue('');
});

it('rejects foreign snapshots and history when customer changes', () => {
  const view = render(<SnapshotContext data={data} customerId={customerId} />);
  choose(a.id);
  view.rerender(<SnapshotContext data={data} customerId="another-customer" />);
  expect(screen.getByLabelText('Chọn snapshot hành vi')).toHaveValue('');
  expect(screen.queryByRole('option', { name: /Nguồn A/ })).not.toBeInTheDocument();
  expect(screen.queryByText('Low', { selector: '.customer-purchase' })).not.toBeInTheDocument();
});
