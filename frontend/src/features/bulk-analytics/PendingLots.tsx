import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../../app/context';
import { vietnamDateTime } from '../bulk/time';
import { pendingLots } from './pending';

/**
 * K16: the batch dashboard aggregates analysed lots only. Lots that were imported but never analysed with saved
 * results are listed here with a direct link, so their customers are not silently missing from the numbers.
 */
export function PendingLots() {
  const { session, revision, hasCapability } = useWorkspace();
  const query = useQuery({
    queryKey: ['batch-pending-lots', revision],
    retry: false,
    staleTime: 30_000,
    queryFn: async ({ signal }) =>
      pendingLots(
        (await session.client.listImports(undefined, signal)).items,
        async (id) => (await session.client.listAnalyses(id, signal)).items,
      ),
  });
  const lots = query.data ?? [];
  if (!lots.length) return null; // loading, error or nothing pending: the page works as before
  const rows = lots.reduce((sum, job) => sum + (job.counts.valid ?? 0), 0);
  const canRun = hasCapability('inference.csv.run');
  return (
    <section className="panel batch-pending" role="status" aria-labelledby="batch-pending-title">
      <h2 id="batch-pending-title">
        {lots.length} lô đã nhập nhưng chưa được phân tích ({rows} dòng hợp lệ)
      </h2>
      <p>
        Trang này chỉ tổng hợp các lô đã chạy phân tích có lưu kết quả với mô hình bản ban đầu.
        Khách hàng của các lô dưới đây chưa được tính.{' '}
        {canRun
          ? 'Mở lô, chọn mô hình bản ban đầu, tick lưu kết quả rồi bấm Phân tích hàng loạt.'
          : 'Cần tài khoản vận hành hoặc quản trị để chạy phân tích.'}
      </p>
      <ul>
        {lots.map((job) => (
          <li key={job.job_id}>
            <span>
              {job.metadata.filename ?? `Lô ${job.job_id.slice(0, 8)}`} · nhập lúc{' '}
              {vietnamDateTime(job.created_at)} · {job.counts.valid ?? 0} dòng hợp lệ
            </span>{' '}
            <Link className="text-link" to={`/bulk-import?lot=${encodeURIComponent(job.job_id)}`}>
              Mở lô để phân tích
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
