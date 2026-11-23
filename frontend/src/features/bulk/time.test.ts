import { dateTime } from '../customers/customers';
import { localTime } from '../dashboard/dashboard';
import { expect, it } from 'vitest';
import { vietnamDateTime } from './time';

it('shows UTC instants in Vietnam time with an explicit timezone', () => {
  const display = vietnamDateTime('2026-11-05T00:00:00Z');
  expect(display).toContain('07:00:00');
  expect(display).toContain('05/11/2026');
  expect(display).toContain('(UTC+7)');
});

it('rolls the calendar date forward correctly across midnight in Vietnam', () => {
  const display = vietnamDateTime('2026-11-05T20:30:00+00:00');
  expect(display).toContain('03:30:00');
  expect(display).toContain('06/11/2026');
});

it('does not add seven hours again to timestamps already carrying a Vietnam offset', () => {
  expect(vietnamDateTime('2026-11-05T07:00:00+07:00')).toBe(
    vietnamDateTime('2026-11-05T00:00:00Z'),
  );
});

it('handles pending or invalid timestamps without crashing the page', () => {
  expect(vietnamDateTime(null, 'Chưa chạy')).toBe('Chưa chạy');
  expect(vietnamDateTime(undefined)).toBe('Chưa có');
  expect(vietnamDateTime('invalid')).toBe('Thời gian không hợp lệ');
});

it('uses the same Vietnam clock for customer, prediction, history and dashboard displays', () => {
  const value = '2026-11-05T20:30:00Z';
  expect(dateTime(value)).toBe(vietnamDateTime(value));
  expect(localTime(value)).toBe(vietnamDateTime(value));
});
