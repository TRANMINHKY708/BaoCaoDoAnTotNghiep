import { expect, it } from 'vitest';
import { productText } from './productText';
it('removes internal delivery steps from explanatory text without changing meaning', () => {
  expect(productText('Lô nhập F09 được các dòng tham chiếu.')).toBe(
    'Lô nhập được các dòng tham chiếu.',
  );
  expect(productText('Khoảng ngày tạo tác vụ F10, cuối khoảng không bao gồm.')).toBe(
    'Khoảng ngày tạo tác vụ, cuối khoảng không bao gồm.',
  );
  expect(productText('Hồ sơ nghiên cứu F02.')).toBe('Hồ sơ nghiên cứu.');
  expect(productText('F09/F10')).toBe('nhập dữ liệu và phân tích');
  expect(productText('Giải thích F01.1 cho dữ liệu.')).toBe('Giải thích cho dữ liệu.');
});
it('preserves model versions, units, safeguards and technical identifiers', () => {
  const message =
    '1.0.0 · 2.0.0-snapshot-k3 · Low/Medium/High · raw margin · không phải xác suất · F10_MIGRATION_REQUIRED';
  expect(productText(message)).toBe(message);
});
