import { useQuery } from '@tanstack/react-query';
import { useWorkspace } from '../../app/context';
import { ApiError } from '../../api/errors';
import { ErrorState, LoadingState } from '../../components/states';
import { vietnamDateTime } from '../bulk/time';
import { comparisonFeatures, type ComparisonFeature } from './comparisonData';
import { filterRequest, type Draft } from './filters';
import type { BatchView } from './types';
import { checkedInsights, type InsightTarget } from './insights';

export function InsightPanel({
  data,
  applied,
  feature,
  onEvidence,
}: {
  data: BatchView;
  applied: Draft;
  feature?: ComparisonFeature;
  onEvidence: (target: InsightTarget) => void;
}) {
  const { session, revision } = useWorkspace();
  const filters = filterRequest(applied);
  const query = useQuery({
    queryKey: ['batch-insights', revision, filters, data.fingerprint, feature, '1.0.0'],
    staleTime: 0,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) =>
      checkedInsights(
        await session.client.batchAnalyticsInsights(filters, data.fingerprint, feature, signal),
        data,
        feature,
      ),
  });
  const conflict = query.error instanceof ApiError && query.error.status === 409;
  return (
    <section className="panel insight-panel" aria-labelledby="insight-title">
      <h2 id="insight-title">Nhận xét từ dữ liệu</h2>
      {query.isFetching ? (
        <LoadingState label="Đang đọc nhận xét theo phạm vi đã chọn…" />
      ) : query.isError ? (
        conflict ? (
          <p role="alert">
            Dữ liệu đã thay đổi hoặc chưa nhất quán. Bấm “Tải lại số liệu” để kiểm tra lại.
          </p>
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        )
      ) : !query.data?.insights.length ? (
        <p>Chưa có đủ dữ liệu để nhận xét.</p>
      ) : (
        <div className="insight-list">
          {query.data.insights.map((item) => (
            <article key={item.insight_id}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <button
                className="button button-secondary"
                onClick={() => onEvidence(item.navigation_target)}
              >
                Xem bằng chứng
              </button>
              <details>
                <summary>Về nhận xét</summary>
                <p>
                  {vietnamDateTime(query.data!.as_of)} ·{' '}
                  {item.model_identity
                    ? `${item.model_identity.task === 'classification' ? 'Mức mua' : 'Phân nhóm'} · ${item.model_identity.model_version}`
                    : 'Chưa có mô hình cho dữ liệu này'}
                </p>
                {item.feature_key && (
                  <p>
                    {comparisonFeatures[item.feature_key].label} · {item.unit?.label}
                  </p>
                )}
                {item.sample_counts.map((count, i) => (
                  <p key={i}>
                    {count.unit}: {count.value === null ? 'Chưa được nguồn cung cấp' : count.value}{' '}
                    · {count.scope}
                  </p>
                ))}
                {item.limitations.map((limit) => (
                  <p key={limit.code}>{limit.description}</p>
                ))}
                <dl>
                  <dt>Quy tắc</dt>
                  <dd>
                    {item.rule_id} · {item.rule_version}
                  </dd>
                  <dt>Nguồn</dt>
                  <dd>Kết quả đã lưu trong phạm vi bộ lọc đang áp dụng</dd>
                  <dt>Dấu đối chiếu dữ liệu</dt>
                  <dd>{query.data!.aggregate_fingerprint}</dd>
                  <dt>Bộ lọc đã áp dụng</dt>
                  <dd>
                    <pre>{JSON.stringify(query.data!.filter_scope, null, 2)}</pre>
                  </dd>
                </dl>
                {item.model_identity && (
                  <p>
                    Artifact: {item.model_identity.artifact_sha256}
                    <br />
                    Metadata: {item.model_identity.metadata_sha256}
                  </p>
                )}
                <div className="bulk-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Số liệu nguồn</th>
                        <th>Giá trị gốc</th>
                        <th>Đơn vị</th>
                        <th>Trường nguồn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.observed_values.map((v) => (
                        <tr key={v.evidence_id}>
                          <td>{v.metric}</td>
                          <td>{v.value === null ? 'Chưa được cung cấp' : String(v.value)}</td>
                          <td>{v.unit}</td>
                          <td>
                            {item.evidence.find((e) => e.evidence_id === v.evidence_id)
                              ?.source_field ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
