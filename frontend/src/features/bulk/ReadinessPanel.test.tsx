import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ReadinessPanel } from './ReadinessPanel';
import type { BulkConfig, Preview } from './types';

const config: BulkConfig = {
  mapping: {},
  profile: 'model_input',
  models: [{ task: 'classification', version: '2.0.0-snapshot-conservative12' }],
};
function result(): Preview {
  return {
    preview_reference: 'test-only-reference',
    expires_at: '2099-01-01T00:00:00Z',
    valid: true,
    mapping_valid: true,
    stats: {
      total: 1,
      valid: 1,
      error: 0,
      warning: 0,
      duplicate: 0,
      skipped: 0,
      snapshot_eligible: 0,
      snapshot_ineligible: 1,
    },
    rows: [
      {
        row: 2,
        status: 'valid',
        valid: true,
        error: false,
        warning: false,
        duplicate: false,
        skipped: false,
        identity: null,
        snapshot_eligible: false,
        missing_features: ['Total_Purchases', 'Lifetime_Value'],
        values: {},
      },
    ],
    issues: [],
    page: 1,
    page_size: 25,
    filtered_rows: 1,
    database_written: false,
  };
}

it('separates valid T4 input from missing snapshot25 and never claims batch readiness', () => {
  render(<ReadinessPanel dataset="behavior" config={config} preview={result()} state="ready" />);
  expect(screen.getByText('Hợp lệ theo cấu hình đã chọn')).toBeInTheDocument();
  expect(screen.getByText('Có thể chuẩn bị xác nhận')).toBeInTheDocument();
  expect(screen.getByText('Chưa có dòng đủ snapshot')).toBeInTheDocument();
  expect(screen.getByText('Chưa xác minh ở bước này')).toBeInTheDocument();
  expect(screen.getByText(/Thiếu: Total_Purchases, Lifetime_Value/)).toBeInTheDocument();
  expect(screen.getByText(/2.0.0-snapshot-conservative12/)).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('uses the server snapshot flag rather than counting or validating feature values', () => {
  const preview = result();
  preview.stats.snapshot_eligible = 1;
  preview.stats.snapshot_ineligible = 0;
  preview.rows[0]!.snapshot_eligible = true;
  preview.rows[0]!.missing_features = [];
  // No 25-field payload in this fixture: eligibility comes from backend flags only.
  render(
    <ReadinessPanel
      dataset="behavior"
      config={{ ...config, profile: 'snapshot', models: [] }}
      preview={preview}
      state="ready"
    />,
  );
  expect(screen.getByText('Có dòng đủ 25 đặc trưng')).toBeInTheDocument();
  expect(screen.getByText('Chưa xác minh ở bước này')).toBeInTheDocument();
  expect(screen.getByText(/chưa phải nhập thành công/)).toBeInTheDocument();
});

it('keeps orders preview-only even when source flags would describe complete behavior rows', () => {
  const preview = result();
  preview.stats.snapshot_eligible = 1;
  render(<ReadinessPanel dataset="orders" config={config} preview={preview} state="ready" />);
  expect(screen.getByText('Chỉ xem trước')).toBeInTheDocument();
  expect(screen.getByText('Không áp dụng cho đơn hàng')).toBeInTheDocument();
  expect(screen.getByText('Chưa hỗ trợ với đơn hàng')).toBeInTheDocument();
  expect(screen.queryByText('Có thể chuẩn bị xác nhận')).not.toBeInTheDocument();
  expect(screen.queryByText(/Thiếu:/)).not.toBeInTheDocument();
});

it('does not turn a valid warning into an error or add overlapping counters', () => {
  const preview = result();
  preview.stats.warning = 1;
  preview.rows[0]!.warning = true;
  preview.rows[0]!.status = 'warning';
  render(<ReadinessPanel dataset="behavior" config={config} preview={preview} state="ready" />);
  expect(screen.getByText('Hợp lệ, có cảnh báo')).toBeInTheDocument();
  expect(screen.getByText('Có thể chuẩn bị xác nhận')).toBeInTheDocument();
  expect(screen.getByText(/có thể chồng lấn/i)).toBeInTheDocument();
  expect(screen.queryByText('Có dòng lỗi')).not.toBeInTheDocument();
});

it('distinguishes duplicate, error and missing without treating them as independent totals', () => {
  const preview = result();
  preview.valid = false;
  preview.stats.valid = 0;
  preview.stats.error = 1;
  preview.stats.duplicate = 1;
  preview.stats.skipped = 1;
  preview.stats.snapshot_ineligible = 0;
  Object.assign(preview.rows[0]!, { valid: false, error: true, duplicate: true, skipped: true });
  render(<ReadinessPanel dataset="behavior" config={config} preview={preview} state="ready" />);
  expect(screen.getByText('Có dòng lỗi')).toBeInTheDocument();
  expect(screen.getByText('Chưa thể chuẩn bị xác nhận')).toBeInTheDocument();
  expect(screen.getByText(/Trùng — cách ly/)).toHaveTextContent(
    'Có lỗi. Trùng — cách ly. Bị bỏ qua.',
  );
  expect(screen.getByText(/Thiếu:/)).toBeInTheDocument();
});

it('does not let valid row counts override a rejected mapping', () => {
  const preview = result();
  preview.mapping_valid = false;
  render(<ReadinessPanel dataset="behavior" config={config} preview={preview} state="ready" />);
  expect(screen.getByText('Cần sửa ánh xạ')).toBeInTheDocument();
  expect(screen.getByText('Chưa thể chuẩn bị xác nhận')).toBeInTheDocument();
});

it.each(['loading', 'expired', 'error'] as const)(
  'hides every old positive assessment when %s',
  (state) => {
    const view = render(
      <ReadinessPanel dataset="behavior" config={config} preview={result()} state="ready" />,
    );
    expect(screen.getByText('Hợp lệ theo cấu hình đã chọn')).toBeInTheDocument();
    view.rerender(
      <ReadinessPanel dataset="behavior" config={config} preview={result()} state={state} />,
    );
    const panel = screen.getByRole('region', { name: 'Khả năng sử dụng dữ liệu' });
    expect(within(panel).getByRole('status')).toBeInTheDocument();
    expect(within(panel).queryByText('Hợp lệ theo cấu hình đã chọn')).not.toBeInTheDocument();
    expect(within(panel).queryByText(/Thiếu:/)).not.toBeInTheDocument();
    expect(panel).toHaveAttribute('aria-busy', String(state === 'loading'));
  },
);

it('distinguishes an empty dataset from an empty page/filter without recomputing totals', () => {
  const preview = result();
  preview.rows = [];
  preview.filtered_rows = 0;
  const view = render(
    <ReadinessPanel dataset="behavior" config={config} preview={preview} state="ready" />,
  );
  expect(screen.getByText(/Không có dòng trong bộ lọc hiện tại/)).toBeInTheDocument();
  expect(screen.getByText('Có thể chuẩn bị xác nhận')).toBeInTheDocument();
  preview.stats = {
    total: 0,
    valid: 0,
    error: 0,
    warning: 0,
    duplicate: 0,
    skipped: 0,
    snapshot_eligible: 0,
    snapshot_ineligible: 0,
  };
  view.rerender(
    <ReadinessPanel dataset="behavior" config={config} preview={preview} state="ready" />,
  );
  expect(screen.getByText('Chưa có dòng dữ liệu để đánh giá.')).toBeInTheDocument();
  expect(screen.queryByText('Có thể chuẩn bị xác nhận')).not.toBeInTheDocument();
});
