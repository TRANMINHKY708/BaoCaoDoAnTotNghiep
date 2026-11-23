import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../../app/context';
import { ErrorState, LoadingState } from '../../components/states';
import type { AnalysisDetail, AnalysisJob, AnalysisTask } from './analysisTypes';
import { vietnamDateTime } from './time';

type Model = { task: string; model_version: string; available: boolean };
const names = { classification: 'Mức độ mua hàng', segmentation: 'Phân nhóm khách hàng' };
const states = {
  queued: 'Chờ xử lý',
  running: 'Đang xử lý / có thể tiếp tục',
  completed: 'Hoàn tất',
  failed: 'Tác vụ gặp lỗi',
};

export function BatchAnalysis({ importJobId }: { importJobId: string }) {
  const { session, hasCapability } = useWorkspace();
  const [models, setModels] = useState<Model[] | null>(null);
  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const [detail, setDetail] = useState<AnalysisDetail | null>(null);
  const [versions, setVersions] = useState<Record<AnalysisTask, string>>({
    classification: '1.0.0',
    segmentation: '1.0.0',
  });
  const [selected, setSelected] = useState<Record<AnalysisTask, boolean>>({
    classification: true,
    segmentation: true,
  });
  const [save, setSave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const upsert = (job: AnalysisJob) =>
    setJobs((old) => [job, ...old.filter((j) => j.job_id !== job.job_id)]);
  async function action(fn: (signal: AbortSignal) => Promise<void>) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError(null);
    try {
      await fn(controller.signal);
    } catch (e) {
      if (!controller.signal.aborted) setError(e);
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
        active.current = null;
      }
    }
  }
  async function load(signal: AbortSignal) {
    const catalog = await session.client.request('get', '/api/v1/model-info', { signal });
    setModels(catalog.data.models);
    setJobs((await session.client.listAnalyses(importJobId, signal)).items);
    setDetail(null);
  }
  async function run(job: AnalysisJob, signal: AbortSignal, retry = false) {
    let current = job;
    setDetail(null);
    if (retry) current = await session.client.advanceAnalysis(job.job_id, 'retry', signal);
    upsert(current);
    while (!signal.aborted && ['queued', 'running'].includes(current.status)) {
      current = await session.client.advanceAnalysis(current.job_id, 'advance', signal);
      if (signal.aborted) return;
      upsert(current);
    }
    if (!signal.aborted) setDetail(await session.client.analysisDetail(current.job_id, 0, signal));
  }
  async function start(signal: AbortSignal) {
    setDetail(null);
    for (const task of ['classification', 'segmentation'] as const) {
      if (!selected[task]) continue;
      const job = await session.client.createAnalysis(
        {
          import_job_id: importJobId,
          task,
          model_version: versions[task],
          save_results: save && versions[task] === '1.0.0',
        },
        signal,
      );
      await run(job, signal);
    }
  }
  const canRun = hasCapability('inference.csv.run');
  return (
    <section className="panel bulk-section">
      <h3>Phân tích khách hàng trong lô</h3>
      <p>
        Chỉ dùng snapshot đã nhập. Phân loại mô tả mức mua hiện tại; phân nhóm không phải thứ hạng
        hoặc dự báo tương lai.
      </p>
      {!canRun && (
        <p className="bulk-notice">
          Tài khoản của bạn xem được các tác vụ và kết quả đã lưu của lô; việc chạy phân tích cần
          quyền vận hành dữ liệu.
        </p>
      )}
      <button className="button button-secondary" disabled={busy} onClick={() => void action(load)}>
        Chuẩn bị phân tích / tải tác vụ
      </button>
      {models && (
        <>
          {(['classification', 'segmentation'] as const).map((task) => (
            <div key={task} className="bulk-actions">
              <label>
                <input
                  type="checkbox"
                  checked={selected[task]}
                  disabled={busy}
                  onChange={(e) => {
                    setSelected({ ...selected, [task]: e.target.checked });
                    setDetail(null);
                  }}
                />{' '}
                {names[task]}
              </label>
              <select
                aria-label={`Mô hình ${names[task]}`}
                value={versions[task]}
                disabled={busy}
                onChange={(e) => {
                  setVersions({ ...versions, [task]: e.target.value });
                  setDetail(null);
                }}
              >
                {models
                  .filter((m) => m.task === task)
                  .map((m) => (
                    <option key={m.model_version} value={m.model_version} disabled={!m.available}>
                      {m.model_version === '1.0.0'
                        ? 'Bản ban đầu · hỗ trợ lưu'
                        : 'Bản phân tích nâng cao · chỉ xem tạm'}
                      {!m.available ? ' · không khả dụng' : ''}
                    </option>
                  ))}
              </select>
            </div>
          ))}
          <label>
            <input
              type="checkbox"
              checked={save}
              disabled={busy || !hasCapability('analysis.legacy.save')}
              onChange={(e) => setSave(e.target.checked)}
            />{' '}
            Lưu kết quả bản ban đầu vào đúng hồ sơ khách hàng
          </label>
          <p>
            Bản nâng cao chỉ xem tạm trong phiên này (15 phút trên một tiến trình). Không lưu
            database; sau restart hoặc hết hạn cần chủ động chạy lại.
          </p>
          <button
            className="button"
            disabled={
              busy ||
              !canRun ||
              !Object.values(selected).some(Boolean) ||
              (Object.keys(selected) as AnalysisTask[]).some(
                (t) =>
                  selected[t] &&
                  !models.some(
                    (m) => m.task === t && m.model_version === versions[t] && m.available,
                  ),
              )
            }
            onClick={() => void action(start)}
          >
            Phân tích hàng loạt
          </button>
        </>
      )}
      {busy && <LoadingState label="Đang xử lý từng lượt, tối đa 50 snapshot…" />}
      {!!error && (
        <>
          <ErrorState error={error} />
          <p>
            Không tự gửi lại thao tác ghi. Hãy tải tác vụ để kiểm tra tiến độ đã lưu, rồi bấm Tiếp
            tục khi cần.
          </p>
        </>
      )}
      <p>
        Giữ trang mở để tự động chạy các lượt tiếp theo. Đóng trang sẽ tạm dừng; mở lại, tải tác vụ
        và bấm Tiếp tục. Kết quả đã lưu không bị ghi đè.
      </p>
      {jobs.map((job) => (
        <div key={job.job_id} className="bulk-section">
          <strong>
            {names[job.task]} · {job.model_version === '1.0.0' ? 'Bản ban đầu' : 'Bản nâng cao'} —{' '}
            {states[job.status]}
          </strong>
          <p>
            {job.counts.success ?? 0}/{job.counts.total ?? 0} thành công · {job.counts.skipped ?? 0}{' '}
            bỏ qua · {job.counts.failed ?? 0} lỗi · {job.counts.source_rows_without_snapshot ?? 0}{' '}
            dòng thiếu snapshot. {job.persist_results ? 'Có lưu vào hồ sơ' : 'Chỉ xem, không lưu'}.
          </p>
          {job.persist_results && (
            <p>
              Đã lưu mới: {job.counts.saved_new ?? 0} · Dùng lại kết quả đã lưu:{' '}
              {job.counts.saved_reused ?? 0}.
            </p>
          )}
          <progress
            aria-label={`Tiến độ ${names[job.task]}`}
            max={job.counts.total || 1}
            value={(job.counts.success || 0) + (job.counts.failed || 0) + (job.counts.skipped || 0)}
          />
          {job.error_code && (
            <p role="alert">{job.error_code} — phần đã ghi thành công được giữ nguyên.</p>
          )}
          <div className="bulk-actions">
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={() =>
                void action(async (signal) =>
                  setDetail(await session.client.analysisDetail(job.job_id, 0, signal)),
                )
              }
            >
              Xem kết quả
            </button>
            {['queued', 'running'].includes(job.status) && (
              <button
                className="button"
                disabled={busy || !canRun}
                onClick={() => void action((signal) => run(job, signal))}
              >
                Tiếp tục
              </button>
            )}
            {(job.status === 'failed' ||
              (job.counts.failed ?? 0) > 0 ||
              (!job.persist_results && job.status === 'completed')) && (
              <button
                className="button button-secondary"
                disabled={busy || !canRun}
                onClick={() => void action((signal) => run(job, signal, true))}
              >
                {job.persist_results ? 'Thử lại phần chưa thành công' : 'Chạy lại bản xem trước'}
              </button>
            )}
          </div>
          <details>
            <summary>Thông tin tác vụ</summary>
            <p>
              Mã: {job.job_id} · Phiên bản: {job.model_version}
            </p>
            <p>
              Bắt đầu: {vietnamDateTime(job.started_at, 'Chưa chạy')} · Kết thúc:{' '}
              {vietnamDateTime(job.completed_at, 'Chưa hoàn tất')}
            </p>
          </details>
        </div>
      ))}
      {detail && (
        <div>
          <h4>Kết quả {names[detail.job.task]}</h4>
          <p>
            Phân bố từ {detail.preview_available} kết quả thực tế đang truy xuất được trong lô này;
            đơn vị: snapshot. Cluster ID không phải thứ hạng.
          </p>
          {!detail.job.persist_results &&
            detail.preview_available < (detail.job.counts.success ?? 0) && (
              <p role="status">
                Một phần bản xem trước đã hết hạn hoặc thuộc tiến trình/phiên khác. Chạy lại bản xem
                trước để xem đầy đủ; không có số liệu thay thế.
              </p>
            )}
          <dl className="bulk-counts">
            {Object.entries(detail.distribution).map(([label, n]) => (
              <div key={label}>
                <dt>{detail.job.task === 'classification' ? label : `Nhóm ${label}`}</dt>
                <dd>{n}</dd>
              </div>
            ))}
          </dl>
          <div className="bulk-table">
            <table>
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Trạng thái</th>
                  <th>Kết quả</th>
                  <th>Lưu trữ</th>
                </tr>
              </thead>
              <tbody>
                {detail.rows.map((row) => (
                  <tr key={row.snapshot_id}>
                    <td>
                      <p>{row.customer_reference ?? 'Khách hàng trong lô'}</p>
                      <Link to={`/customers/${row.customer_id}/analysis`}>Xem hồ sơ phân tích</Link>
                      <details>
                        <summary>Snapshot</summary>
                        {row.snapshot_id}
                      </details>
                    </td>
                    <td>
                      {row.status === 'success'
                        ? 'Thành công'
                        : row.status === 'queued'
                          ? 'Chưa xử lý'
                          : row.status === 'skipped'
                            ? 'Bỏ qua'
                            : 'Lỗi'}{' '}
                      {row.error_code}
                    </td>
                    <td>
                      {row.result ? (
                        <>
                          {row.result.purchase_level ??
                            `Nhóm ${row.result.cluster}: ${row.result.segment_name}`}{' '}
                          {row.result.probabilities && (
                            <p>
                              {Object.entries(row.result.probabilities)
                                .map(([label, p]) => `${label}: ${(p * 100).toFixed(2)}%`)
                                .join(' · ')}
                            </p>
                          )}
                          {row.result.distance_to_centroid !== undefined && (
                            <p>
                              Khoảng cách chuẩn hóa: {row.result.distance_to_centroid.toFixed(4)};
                              không phải xác suất.
                            </p>
                          )}
                        </>
                      ) : (
                        'Chưa có kết quả để hiển thị'
                      )}
                    </td>
                    <td>{row.saved ? 'Đã lưu vào hồ sơ' : 'Không lưu'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bulk-actions">
            {[-1, 1].map((dir) => (
              <button
                key={dir}
                className="button button-secondary"
                disabled={
                  busy ||
                  (dir < 0
                    ? detail.offset === 0
                    : detail.offset + detail.limit >= (detail.job.counts.total ?? 0))
                }
                onClick={() =>
                  void action(async (signal) =>
                    setDetail(
                      await session.client.analysisDetail(
                        detail.job.job_id,
                        detail.offset + dir * detail.limit,
                        signal,
                      ),
                    ),
                  )
                }
              >
                {dir < 0 ? 'Trang trước' : 'Trang sau'}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
