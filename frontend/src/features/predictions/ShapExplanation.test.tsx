import { verifyResult } from './prediction';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import fixture from '../../test/fixtures/t14_predictions.json';
import { ShapExplanation } from './ShapExplanation';
import { readExplanation } from './explanation';
const prediction = verifyResult(fixture.rows[0]!.result, fixture.rows[0]!.version);
const explanation = {
  method: 'xgboost_native_exact_treeshap',
  explanation_scope: 'local',
  model_id: prediction.model_id,
  model_version: prediction.model_version,
  predicted_class: prediction.predicted_class,
  purchase_level: prediction.purchase_level,
  artifact_sha256: 'a'.repeat(64),
  input_source: 'request_payload',
  feature_space: 'preprocessed',
  output_space: 'raw_margin',
  base_value: 0.5,
  model_output: 0.7,
  additivity_error: 0,
  features: [
    { feature_name: 'small_positive', feature_value: 2, shap_value: 0.1 },
    { feature_name: 'largest_negative', feature_value: null, shap_value: -0.3 },
    { feature_name: 'large_positive', feature_value: 8, shap_value: 0.4 },
  ],
};
it('sorts signed contributions and displays exact values, base, version and raw margin disclaimer', () => {
  render(<ShapExplanation value={explanation} prediction={prediction} artifact={'a'.repeat(64)} />);
  const rows = within(screen.getByRole('list', { name: 'Đóng góp đặc trưng có dấu' })).getAllByRole(
    'listitem',
  );
  expect(rows[0]).toHaveTextContent('large_positive');
  expect(rows[1]).toHaveTextContent('largest_negative');
  expect(rows[0]).toHaveTextContent('+0.4');
  expect(rows[1]).toHaveTextContent('-0.3');
  expect(rows[1]).toHaveTextContent('Thiếu dữ liệu (null)');
  expect(screen.getByText('0.5')).toBeInTheDocument();
  expect(screen.getByText(/không phải phần trăm xác suất/)).toBeInTheDocument();
  expect(screen.getByText(/không chứng minh quan hệ nhân quả/)).toBeInTheDocument();
});
it('rejects incompatible identity, shapes, nonfinite, duplicate features and bad additivity', () => {
  for (const value of [
    undefined,
    {},
    { ...explanation, model_version: 'wrong' },
    { ...explanation, predicted_class: 99 },
    { ...explanation, output_space: 'probability' },
    { ...explanation, features: [] },
    { ...explanation, base_value: Infinity },
    { ...explanation, model_output: 9 },
    { ...explanation, features: [explanation.features[0], explanation.features[0]] },
  ]) {
    expect(readExplanation(value, prediction)).toBeNull();
  }
  expect(readExplanation(explanation, prediction, 'b'.repeat(64))).toBeNull();
});
it('removes old chart when the next result lacks a valid explanation', () => {
  const view = render(<ShapExplanation value={explanation} prediction={prediction} />);
  expect(screen.getByRole('list')).toBeInTheDocument();
  view.rerender(<ShapExplanation value={undefined} prediction={prediction} />);
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('không khả dụng');
});
it('handles zero contributions and expands beyond twelve without mutating feature order', async () => {
  const value = {
    ...explanation,
    base_value: 0,
    model_output: 0,
    features: Array.from({ length: 14 }, (_, i) => ({
      feature_name: 'feature_' + i,
      feature_value: 0,
      shap_value: 0,
    })),
  };
  render(<ShapExplanation value={value} prediction={prediction} />);
  expect(screen.getAllByRole('listitem')).toHaveLength(12);
  await userEvent.click(screen.getByRole('button', { name: 'Xem tất cả đặc trưng' }));
  expect(screen.getAllByRole('listitem')).toHaveLength(14);
  expect(value.features[0]!.feature_name).toBe('feature_0');
});
