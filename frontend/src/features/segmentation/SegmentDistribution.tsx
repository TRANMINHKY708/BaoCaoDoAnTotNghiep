import { useQuery } from '@tanstack/react-query';
import { useWorkspace } from '../../app/context';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import type { Spec } from '../predictions/prediction';
import { verifyDistribution } from './segmentation';

export function SegmentDistribution({ spec }: { spec: Spec }) {
  const { session, revision } = useWorkspace();
  const query = useQuery({
    queryKey: ['segment-distribution', revision, spec.model.model_version],
    queryFn: async ({ signal }) =>
      verifyDistribution(
        (
          await session.client.request('get', '/api/v1/segments', {
            signal,
            query: { model_version: spec.model.model_version },
          })
        ).data,
        spec,
      ),
  });
  const total = query.data
    ? Object.values(query.data.stored_result_counts).reduce((a, b) => a + b, 0)
    : null;
  return (
    <section className="panel segment-distribution" aria-label="Phân bố phân nhóm đã lưu">
      <div className="prediction-section-heading">
        <div>
          <span className="eyebrow">KẾT QUẢ ĐÃ LƯU / TOÀN BỘ THỜI GIAN</span>
          <h2>Phân bố kết quả phân nhóm đã lưu</h2>
        </div>
        <button
          className="button button-secondary"
          onClick={() => {
            void query.refetch();
          }}
        >
          Tải lại thống kê
        </button>
      </div>
      <p className="prediction-help">
        Lịch sử đã lưu · Đơn vị: lượt kết quả, không phải khách hàng duy nhất.
      </p>
      {query.isPending ? (
        <LoadingState label="Đang đọc phân bố phân nhóm…" />
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        query.data && (
          <>
            {total === 0 ? (
              <EmptyState
                title="Chưa có kết quả lưu cho phiên bản này"
                description={
                  spec.model.persistence_supported
                    ? 'Bạn có thể phân tích khách hàng bên dưới. Chỉ các kết quả đã lưu mới xuất hiện trên biểu đồ.'
                    : 'Phiên bản này chưa hỗ trợ lưu. Biểu đồ chỉ đếm lượt kết quả đã lưu, không phải số khách hàng thuộc từng nhóm.'
                }
              />
            ) : (
              <>
                <p className="segment-total">
                  <strong>{total}</strong> lượt kết quả đã lưu
                </p>
                <div className="segment-bars">
                  {Object.entries(query.data.definitions).map(([id, def]) => (
                    <div key={id}>
                      <div>
                        <strong>{def.display_label}</strong>
                        <span>{query.data!.stored_result_counts[id]} lượt</span>
                      </div>
                      <progress
                        aria-label={`Lượt lưu ${def.display_label}`}
                        max={total!}
                        value={query.data!.stored_result_counts[id]}
                      />
                      <small>
                        {((query.data!.stored_result_counts[id]! / total!) * 100).toLocaleString(
                          'vi-VN',
                          { maximumFractionDigits: 2 },
                        )}
                        % số lượt lưu
                      </small>
                    </div>
                  ))}
                </div>
                <p className="segment-notice">
                  Phân bố lịch sử có thể chưa đại diện toàn bộ khách hàng; không phải xác suất dự
                  đoán.
                </p>
              </>
            )}
            <details className="segment-definitions">
              <summary>Thông tin kỹ thuật</summary>
              {Object.entries(query.data.definitions).map(([id, def]) => (
                <p key={id}>
                  <strong>
                    Cluster {def.cluster} · {def.display_label}
                  </strong>
                  <br />
                  {id}
                </p>
              ))}
              <p className="prediction-help">
                Không đối chiếu số nhóm giữa các phiên bản hoặc dùng dữ liệu nghiên cứu để suy ra
                đặc điểm khách hàng.
              </p>
            </details>
          </>
        )
      )}
    </section>
  );
}
