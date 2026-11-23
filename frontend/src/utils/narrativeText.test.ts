import { expect, it } from 'vitest';
import { narrativeText } from './narrativeText';
it('cleans technical wording in an existing answer while retaining all numbers and safeguards', () => {
  const input =
    'Tổng hợp từ PostgreSQL (F09/F10): 10 khách hàng, 10 snapshot, 4 tác vụ, 20 kết quả.\nLow 50% (5 kết quả).\nChưa đủ dữ liệu xu hướng do trend_available là false.\nĐơn vị Average_Order_Value chưa xác minh; không chứng minh nhân quả.';
  const output = narrativeText(input);
  expect(output).not.toMatch(/F09|F10|PostgreSQL|trend_available|false|Average_Order_Value/);
  expect(output.match(/\d+/g)).toEqual(['10', '10', '4', '20', '50', '5']);
  expect(output).toContain(
    'Đơn vị giá trị đơn hàng trung bình chưa xác minh; không chứng minh nhân quả.',
  );
});
it('does not remove a real customer identifier that resembles a milestone or change versions/units', () => {
  expect(narrativeText('Khách hàng F09 · phiên bản 1.0.0 · raw margin -0.25 · Low 50%')).toBe(
    'Khách hàng F09 · phiên bản 1.0.0 · raw margin -0.25 · Low 50%',
  );
});
