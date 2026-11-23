import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWorkspace } from '../../app/context';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { TechnicalDetails } from '../../components/presentation';
import { dateTime } from '../customers/customers';
import { labels, type Spec } from '../predictions/prediction';
import { verifyProfiles, type Profiles } from './profiles';
import './profiles.css';
const number = (n: number | null) =>
  n === null ? 'Không đủ quan sát' : n.toLocaleString('vi-VN', { maximumFractionDigits: 4 });
export function ResearchProfiles({ spec }: { spec: Spec }) {
  const { session, revision } = useWorkspace();
  const [requested, setRequested] = useState(false);
  const query = useQuery({
    queryKey: [
      'research-segment-profiles',
      revision,
      spec.model.model_version,
      spec.model.artifact_sha256,
    ],
    enabled: requested,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const params = { model_version: spec.model.model_version, research_profiles: true };
      return verifyProfiles(
        (
          await session.client.request('get', '/api/v1/segments', {
            query: params,
            signal,
            timeoutMs: 60000,
          })
        ).data,
        spec,
      );
    },
  });
  return (
    <section className="panel research-profiles" aria-label="Hồ sơ phân khúc nghiên cứu">
      <h2>Hồ sơ phân khúc từ dữ liệu nghiên cứu</h2>
      <p>Dữ liệu nghiên cứu; không phải khách hàng đang quản lý. Đơn vị: bản ghi nghiên cứu.</p>
      <button
        type="button"
        className="button button-secondary"
        disabled={query.isFetching}
        onClick={() => {
          if (requested) void query.refetch();
          else setRequested(true);
        }}
      >
        Phân tích dataset nghiên cứu
      </button>
      {!requested ? (
        <EmptyState
          title="Chưa phân tích dữ liệu nghiên cứu"
          description="Bấm phân tích để lấy profile thật từ pipeline của phiên bản đang chọn; không lưu vào database."
        />
      ) : query.isFetching ? (
        <LoadingState label="Đang phân nhóm dataset và tính hồ sơ…" />
      ) : query.isError ? (
        <ErrorState error={query.error} />
      ) : query.data ? (
        <ProfileView key={query.data.model_version + query.data.dataset_sha256} data={query.data} />
      ) : null}
    </section>
  );
}
export function ProfileView({ data }: { data: Profiles }) {
  const [selected, setSelected] = useState(0);
  const cluster = data.clusters.find((c) => c.cluster_id === selected)!;
  return (
    <>
      <p>
        <strong>{number(data.total_records)} bản ghi</strong> · Thực tế dùng{' '}
        {number(data.records_used)} bản ghi · {data.actual_cluster_count}/
        {data.configured_cluster_count} cụm có dữ liệu
      </p>
      <p>
        Nguồn: {data.source_name} · Phiên bản {data.model_version} · Phân tích lúc{' '}
        {dateTime(data.computed_at)}
      </p>
      <TechnicalDetails>
        <p>Dataset SHA256: {data.dataset_sha256}</p>
        <p>Artifact SHA256: {data.artifact_sha256}</p>
      </TechnicalDetails>
      <p>Số nhóm không phải thứ hạng. Trung bình dùng dữ liệu gốc trước tiền xử lý.</p>
      {data.status === 'insufficient_data' ? (
        <EmptyState
          title="Không đủ dữ liệu để tạo hồ sơ"
          description="Cần ít nhất hai bản ghi và hai giá trị quan sát hợp lệ cho từng trung bình. Không suy diễn đặc điểm cụm từ một bản ghi."
        />
      ) : (
        <>
          <div className="segment-bars">
            {data.clusters.map((c) => (
              <div key={c.cluster_id}>
                <strong>Cluster {c.cluster_id}</strong>
                <span>
                  {number(c.record_count)} bản ghi · {number(c.share_percent)}%
                </span>
                <progress
                  aria-label={`Tỷ trọng Cluster ${c.cluster_id}`}
                  max={100}
                  value={c.share_percent ?? 0}
                />
                {c.status === 'insufficient_data' && (
                  <small>Chưa đủ bản ghi để diễn giải cụm.</small>
                )}
              </div>
            ))}
          </div>
          <div
            className="profile-table"
            role="region"
            aria-label="Bảng so sánh trung bình các cụm"
            tabIndex={0}
          >
            <table>
              <caption>
                Trung bình và số quan sát hợp lệ n; mỗi ô chỉ dùng dữ liệu của tập nghiên cứu này.
              </caption>
              <thead>
                <tr>
                  <th>Đặc trưng</th>
                  <th>Toàn tập</th>
                  {data.clusters.map((c) => (
                    <th key={c.cluster_id}>Cluster {c.cluster_id}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.feature_names.map((n) => (
                  <tr key={n}>
                    <th>{labels[n] ?? n}</th>
                    <td>
                      {number(data.overall[n]!.mean)} (n={data.overall[n]!.observed_count})
                    </td>
                    {data.clusters.map((c) => (
                      <td key={c.cluster_id}>
                        {number(c.features[n]!.mean)} (n={c.features[n]!.observed_count})
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label>
            So sánh đặc trưng nổi bật của cụm
            <select value={selected} onChange={(e) => setSelected(Number(e.target.value))}>
              {data.clusters.map((c) => (
                <option key={c.cluster_id} value={c.cluster_id}>
                  Cluster {c.cluster_id}
                </option>
              ))}
            </select>
          </label>
          <p>
            Chọn tối đa ba đặc trưng lệch nhiều nhất so với toàn tập theo số độ lệch chuẩn. Đây là
            so sánh mô tả, không phải feature importance hoặc bằng chứng nhân quả.
          </p>
          {cluster.notable_features.length === 0 ? (
            <p>Không đủ quan sát hoặc không có chênh lệch để nêu đặc trưng nổi bật.</p>
          ) : (
            cluster.notable_features.map((f) => {
              const max = Math.max(f.cluster_mean, f.overall_mean, Number.EPSILON);
              return (
                <div className="profile-comparison" key={f.feature}>
                  <h3>{labels[f.feature] ?? f.feature}</h3>
                  <p>
                    Cluster {cluster.cluster_id}: {number(f.cluster_mean)} · Toàn tập:{' '}
                    {number(f.overall_mean)} · Chênh lệch: {number(f.difference)}
                  </p>
                  <div>
                    <span>Cluster {cluster.cluster_id}</span>
                    <progress
                      aria-label={`Trung bình cụm ${f.feature}`}
                      max={max}
                      value={f.cluster_mean}
                    />
                  </div>
                  <div>
                    <span>Toàn tập</span>
                    <progress
                      aria-label={`Trung bình toàn tập ${f.feature}`}
                      max={max}
                      value={f.overall_mean}
                    />
                  </div>
                </div>
              );
            })
          )}
        </>
      )}
      <p>{data.disclaimer}</p>
    </>
  );
}
