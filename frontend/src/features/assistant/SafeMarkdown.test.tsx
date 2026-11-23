import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { SafeMarkdown } from './SafeMarkdown';
it('presents existing technical narratives as product language without changing statistics', () => {
  render(
    <SafeMarkdown
      text={
        '**Tổng hợp từ PostgreSQL (F09/F10)**: 10 khách hàng, 20 kết quả.\nChưa đủ xu hướng do trend_available là false.\nAverage_Order_Value chưa xác minh đơn vị.'
      }
    />,
  );
  expect(screen.getByText('Tổng hợp từ hệ thống')).toBeInTheDocument();
  expect(screen.getByText(/10 khách hàng, 20 kết quả/)).toBeInTheDocument();
  expect(screen.getByText('Chưa đủ xu hướng.')).toBeInTheDocument();
  expect(screen.getByText('giá trị đơn hàng trung bình chưa xác minh đơn vị.')).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/F09|F10|PostgreSQL|trend_available|false/);
});
it('preserves real identifiers and keeps untrusted HTML escaped', () => {
  const { container } = render(
    <SafeMarkdown
      text={'Khách hàng F09\n<img src=x onerror=alert(1)>\n```text\ncustomer_id = F09\n```'}
    />,
  );
  expect(screen.getByText('Khách hàng F09')).toBeInTheDocument();
  expect(container.querySelector('pre')).toHaveTextContent('customer_id = F09');
  expect(container.querySelector('img')).toBeNull();
});
