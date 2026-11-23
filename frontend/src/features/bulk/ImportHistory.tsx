import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../app/context';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../../components/states';
import { JobResult } from './ImportConfirmation';
import type { ImportDetail, ImportJob } from './importTypes';
import { BatchAnalysis } from './BatchAnalysis';
import { vietnamDateTime } from './time';

export function ImportHistory() {
  const { session } = useWorkspace();
  const [jobs, setJobs] = useState<ImportJob[] | null>(null);
  const [detail, setDetail] = useState<ImportDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const active = useRef<AbortController | null>(null);
  const [params] = useSearchParams();
  const lot = params.get('lot');
  useEffect(() => () => active.current?.abort(), []);
  // K16: a link from the batch dashboard opens one lot directly (read-only lookup by id).
  useEffect(() => {
    if (lot && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lot))
      void load({ job_id: lot } as ImportJob);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per lot in the URL
  }, [lot]);
  async function load(job?: ImportJob, offset = 0) {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError(null);
    try {
      if (job) {
        const result = await session.client.importDetail(job.job_id, offset, controller.signal);
        if (!controller.signal.aborted) setDetail(result);
      } else {
        const result = await session.client.listImports(undefined, controller.signal);
        if (!controller.signal.aborted) {
          setJobs(result.items);
          setDetail(null);
        }
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="panel bulk-section">
      <h2>Lịch sử nhập dữ liệu</h2>
      <button className="button button-secondary" disabled={busy} onClick={() => void load()}>
        Tải lịch sử nhập
      </button>
      <p>20 lần nhập gần nhất trong hệ thống, gồm cả các lần do người dùng khác thực hiện.</p>
      {busy && <LoadingState label="Đang tải lịch sử nhập…" />}
      {!!error && <ErrorState error={error} />}
      {jobs?.length === 0 && <p>Chưa có lịch sử nhập.</p>}
      {jobs && (
        <div className="bulk-table">
          <table>
            <thead>
              <tr>
                <th>Tệp / thời gian</th>
                <th>Trạng thái</th>
                <th>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.job_id}>
                  <td>
                    {job.metadata.filename} · {vietnamDateTime(job.created_at)}
                  </td>
                  <td>
                    {job.status === 'completed'
                      ? 'Hoàn tất'
                      : job.status === 'failed'
                        ? 'Thất bại, đã rollback'
                        : 'Chưa hoàn tất'}
                  </td>
                  <td>
                    <button
                      className="button button-secondary"
                      disabled={busy}
                      onClick={() => void load(job)}
                    >
                      Xem dòng
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {detail && (
        <>
          <JobResult job={detail.job} />
          {detail.job.status === 'completed' && (
            <BatchAnalysis key={detail.job.job_id} importJobId={detail.job.job_id} />
          )}
          <p>
            {detail.total_rows} dòng có kết quả lưu. Job thất bại không giữ các dòng nghiệp vụ đã
            rollback.
          </p>
          <div className="bulk-table">
            <table>
              <thead>
                <tr>
                  <th>Dòng</th>
                  <th>Nguồn / mã khách</th>
                  <th>Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {detail.rows.map((row) => (
                  <tr key={row.row}>
                    <td>{row.row}</td>
                    <td>
                      {row.outcome.identity
                        ? `${row.outcome.identity.source_system} / ${row.outcome.identity.external_customer_id}`
                        : 'Dòng bị cách ly'}
                      {row.customer_id && (
                        <p>
                          <Link to={`/customers/${row.customer_id}`}>Mở hồ sơ khách hàng</Link>
                        </p>
                      )}
                    </td>
                    <td>
                      {row.status === 'excluded'
                        ? 'Không nhập'
                        : row.outcome.snapshot_action === 'created'
                          ? 'Đã tạo snapshot'
                          : ['reused', 'reused_existing'].includes(
                                row.outcome.snapshot_action ?? '',
                              )
                            ? 'Dùng lại snapshot'
                            : 'Chỉ hồ sơ; thiếu feature'}
                      {row.outcome.missing_features?.length
                        ? ` · thiếu ${row.outcome.missing_features.join(', ')}`
                        : ''}
                      {row.outcome.codes?.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bulk-actions">
            <button
              className="button button-secondary"
              disabled={busy || detail.offset === 0}
              onClick={() => void load(detail.job, Math.max(0, detail.offset - detail.limit))}
            >
              Dòng trước
            </button>
            <button
              className="button button-secondary"
              disabled={busy || detail.offset + detail.limit >= detail.total_rows}
              onClick={() => void load(detail.job, detail.offset + detail.limit)}
            >
              Dòng sau
            </button>
          </div>
        </>
      )}
    </section>
  );
}
