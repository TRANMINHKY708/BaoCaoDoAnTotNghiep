import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { ModelDetails } from './presentation';
import { modelName, segmentCaption } from './presentationLabels';

it('distinguishes exact task/version identities without implying a better scientific model', () => {
  const names = [
    modelName('classification', '1.0.0'),
    modelName('classification', '2.0.0-snapshot-conservative12'),
    modelName('segmentation', '1.0.0'),
    modelName('segmentation', '2.0.0-snapshot-k3'),
  ];
  expect(new Set(names).size).toBe(4);
  for (const name of names)
    expect(name).not.toMatch(/T[0-9]|legacy|conservative|snapshot|tốt nhất|nâng cao/i);
  expect(modelName('classification', '2.0.0-snapshot-k3')).toBe('Phiên bản khác');
  expect(modelName('segmentation', '2.0.0-snapshot-conservative12')).toBe('Phiên bản khác');
});
it('keeps exact metadata behind a closed, keyboard-accessible technical disclosure', async () => {
  const sha = 'a'.repeat(64);
  render(
    <ModelDetails
      model={{
        model_id: 'purchase-level-xgboost',
        model_version: '2.0.0-snapshot-conservative12',
        feature_count: 12,
        artifact_sha256: sha,
        features: ['Login_Frequency'],
      }}
    />,
  );
  expect(screen.getByText(sha)).not.toBeVisible();
  await userEvent.click(screen.getByText('Thông tin kỹ thuật'));
  expect(screen.getByText(sha)).toBeVisible();
  expect(screen.getByText('2.0.0-snapshot-conservative12')).toBeVisible();
  expect(screen.getByText('purchase-level-xgboost')).toBeVisible();
  expect(screen.getByText('Login_Frequency')).toBeVisible();
});
it('does not give historical cluster IDs the meaning of engagement levels', () => {
  expect(segmentCaption('legacy:1.0.0:cluster:0')).toBe('Nhóm 0 · bản ban đầu');
  expect(segmentCaption('engagement_low')).toBe('Tương tác thấp');
  expect(segmentCaption('legacy:1.0.0:cluster:0')).not.toBe(segmentCaption('engagement_low'));
  expect(segmentCaption('unknown')).toBe('Nhóm chưa có tên');
});
