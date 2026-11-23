import type { ReactNode } from 'react';
import { modelName } from '../../components/presentationLabels';
import type { BulkConfig, Dataset, Preview } from './types';
import './readiness.css';

export type ReadinessState = 'ready' | 'loading' | 'expired' | 'error';
type Props = {
  dataset: Dataset;
  config: BulkConfig;
  preview: Preview | null;
  state: ReadinessState;
};

function Level({
  title,
  status,
  tone = 'neutral',
  children,
}: {
  title: string;
  status: string;
  tone?: 'neutral' | 'success' | 'warning' | 'error';
  children: ReactNode;
}) {
  return (
    <div className="readiness-level">
      <h4>{title}</h4>
      <strong className={`readiness-status readiness-${tone}`}>{status}</strong>
      <p>{children}</p>
    </div>
  );
}

// Presentation only: do not revalidate cells, infer missing values or decide write permissions.
export function ReadinessPanel({ dataset, config, preview, state }: Props) {
  const notice = {
    loading: 'Đang cập nhật đánh giá. Chưa có kết luận cho lần kiểm tra này.',
    expired: 'Đánh giá đã hết hiệu lực. Hãy đọc lại tệp và kiểm tra lại dữ liệu.',
    error: 'Chưa thể xác nhận đánh giá hiện tại. Xem thông báo lỗi và kiểm tra lại dữ liệu.',
  };
  return (
    <section
      className="bulk-readiness"
      aria-label="Khả năng sử dụng dữ liệu"
      aria-busy={state === 'loading'}
    >
      <h3>Khả năng sử dụng dữ liệu</h3>
      {state !== 'ready' ? (
        <p role="status">{notice[state]}</p>
      ) : !preview || preview.stats.total === 0 ? (
        <p role="status">Chưa có dòng dữ liệu để đánh giá.</p>
      ) : (
        <>
          <p className="readiness-context">
            {dataset === 'orders'
              ? 'Đang kiểm tra dữ liệu đơn hàng.'
              : config.profile === 'snapshot'
                ? 'Đang kiểm tra dữ liệu hành vi đầy đủ — 25 đặc trưng.'
                : `Đang kiểm tra đầu vào: ${config.models.map((m) => modelName(m.task, m.version)).join(', ')}.`}{' '}
            Đây là đánh giá tại bước xem trước; kết quả nhập và phân tích được báo riêng ở các bước
            sau.
          </p>
          {dataset === 'behavior' && config.models.length > 0 && (
            <details className="readiness-models">
              <summary>Phiên bản đang kiểm tra</summary>
              <ul>
                {config.models.map((m) => (
                  <li key={`${m.task}:${m.version}`}>
                    {modelName(m.task, m.version)} · {m.version}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="readiness-grid">
            <Level
              title="1. Kiểm tra cấu trúc và giá trị"
              status={
                !preview.mapping_valid
                  ? 'Cần sửa ánh xạ'
                  : preview.stats.error > 0
                    ? 'Có dòng lỗi'
                    : !preview.valid
                      ? 'Cần xem kết quả kiểm tra'
                      : preview.stats.warning > 0
                        ? 'Hợp lệ, có cảnh báo'
                        : 'Hợp lệ theo cấu hình đã chọn'
              }
              tone={
                !preview.mapping_valid || preview.stats.error > 0 || !preview.valid
                  ? 'error'
                  : preview.stats.warning > 0
                    ? 'warning'
                    : 'success'
              }
            >
              Kết quả theo cấu hình đã chọn, do máy chủ kiểm tra. Cảnh báo không đồng nghĩa dòng
              không hợp lệ; dòng trùng bị cách ly. Xem lỗi và cảnh báo ở bảng bên dưới.
            </Level>
            <Level
              title="2. Khả năng nhập dữ liệu"
              status={
                dataset === 'orders'
                  ? 'Chỉ xem trước'
                  : !preview.mapping_valid || preview.stats.valid === 0
                    ? 'Chưa thể chuẩn bị xác nhận'
                    : 'Có thể chuẩn bị xác nhận'
              }
            >
              {dataset === 'orders'
                ? 'Đơn hàng chưa được hỗ trợ nhập vào hồ sơ. Không tạo snapshot hoặc chạy phân tích hàng loạt từ dữ liệu này.'
                : !preview.mapping_valid || preview.stats.valid === 0
                  ? 'Sửa ánh xạ và các dòng lỗi, sau đó kiểm tra lại. Chưa có dữ liệu hợp lệ để chuyển tiếp.'
                  : 'Chỉ chuyển các dòng hợp lệ sau khi bạn xem và xác nhận. Nếu có dòng lỗi, cần xác nhận cách ly riêng. Máy chủ còn kiểm tra quyền, thời hạn và xung đột khi nhập; đây chưa phải nhập thành công.'}
            </Level>
            <Level
              title="3. Khả năng tạo snapshot"
              status={
                dataset === 'orders'
                  ? 'Không áp dụng cho đơn hàng'
                  : preview.stats.snapshot_eligible > 0
                    ? preview.stats.snapshot_ineligible > 0
                      ? 'Có dòng đủ và dòng thiếu snapshot'
                      : 'Có dòng đủ 25 đặc trưng'
                    : 'Chưa có dòng đủ snapshot'
              }
              tone={
                dataset === 'behavior' && preview.stats.snapshot_ineligible > 0
                  ? 'warning'
                  : 'neutral'
              }
            >
              {dataset === 'orders'
                ? 'Luồng hiện tại không chuyển đơn hàng thành snapshot hành vi.'
                : `${preview.stats.snapshot_eligible.toLocaleString('vi-VN')} dòng đủ điều kiện snapshot; ${preview.stats.snapshot_ineligible.toLocaleString('vi-VN')} dòng hợp lệ nhưng chưa đủ snapshot theo máy chủ. Đầu vào hợp lệ cho một mô hình vẫn có thể thiếu các trường trong bộ 25. Chưa có snapshot mới được xác nhận từ bước xem trước.`}
            </Level>
            <Level
              title="4. Phân tích hàng loạt"
              status={
                dataset === 'orders' ? 'Chưa hỗ trợ với đơn hàng' : 'Chưa xác minh ở bước này'
              }
            >
              {dataset === 'orders'
                ? 'Không dùng các dòng đơn hàng này để chạy mô hình trong luồng hiện tại.'
                : 'Cần lô nhập hoàn tất và snapshot hợp lệ. Bước phân tích còn kiểm tra khách hàng, phiên bản mô hình và quyền lưu. Đủ cấu trúc không chứng minh dữ liệu phù hợp về ý nghĩa hoặc đơn vị với mô hình.'}
            </Level>
          </div>
          <p className="readiness-count-note">Các số đếm có thể chồng lấn.</p>
          <details className="readiness-reasons">
            <summary>Lý do theo các dòng trên trang đang xem</summary>
            {!preview.rows.length ? (
              <p>Không có dòng trong bộ lọc hiện tại. Đánh giá trên vẫn theo thống kê toàn lô.</p>
            ) : (
              <ul>
                {preview.rows.map((row) => (
                  <li key={row.row}>
                    <strong>Dòng {row.row}:</strong> {row.valid && 'Hợp lệ. '}
                    {row.error && 'Có lỗi. '}
                    {row.warning && 'Có cảnh báo. '}
                    {row.duplicate && 'Trùng — cách ly. '}
                    {row.skipped && 'Bị bỏ qua. '}
                    {dataset === 'behavior' && (
                      <>
                        {row.snapshot_eligible ? 'Đủ điều kiện snapshot. ' : 'Chưa đủ snapshot. '}
                        {row.missing_features.length > 0 &&
                          `Thiếu: ${row.missing_features.join(', ')}.`}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </details>
        </>
      )}
    </section>
  );
}
