import { useEffect, useRef, useState } from 'react';
import { FileDown } from 'lucide-react';
import { useWorkspace } from '../../app/context';
import { ApiError } from '../../api/errors';
import type { ReportRequest, ReportTarget } from '../../api/reports';
import { downloadBlob } from '../predictions/csv';
import './reports.css';

export function ExportButtons({
  target,
  research = false,
}: {
  target?: ReportTarget;
  research?: boolean;
}) {
  const { session, status, authState, revision, user, hasCapability } = useWorkspace();
  if (
    !session.accountMode ||
    status !== 'connected' ||
    authState !== 'authenticated' ||
    !hasCapability('models.read')
  )
    return null;
  if (!target)
    return (
      <p className="prediction-help">
        Chạy lại phân tích đơn lẻ để xuất PDF/Excel từ kết quả đã xác minh. Batch/CSV chưa hỗ trợ
        báo cáo này.
      </p>
    );
  return (
    <ExportBody
      key={`${revision}:${user?.id}:${JSON.stringify(target)}`}
      target={target}
      research={research}
    />
  );
}

function ExportBody({ target, research }: { target: ReportTarget; research: boolean }) {
  const { session } = useWorkspace();
  const [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [done, setDone] = useState('');
  const [includeAi, setIncludeAi] = useState(false),
    [includeResearch, setIncludeResearch] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );
  async function run(format: 'pdf' | 'xlsx') {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(format);
    setError('');
    setDone('');
    try {
      const body: ReportRequest = {
        ...target,
        format,
        ...(target.source === 'preview'
          ? { include_ai: includeAi, include_research: research && includeResearch }
          : {}),
      };
      const file = await session.client.requestReport(body, { signal: controller.signal });
      if (controller.signal.aborted || active.current !== controller) return;
      downloadBlob(file.blob, file.filename);
      setDone('Đã tải báo cáo.');
    } catch (failure) {
      if (!controller.signal.aborted && active.current === controller) {
        const known: Record<string, string> = {
          NARRATIVE_RESULT_EXPIRED: 'Kết quả đã hết hạn xác minh. Hãy chạy lại phân tích rồi xuất.',
          REPORT_AI_UNAVAILABLE:
            'Chưa có nhận xét AI đã xác minh. Hãy bấm AI nhận xét trước, hoặc bỏ tùy chọn kèm AI.',
          REPORT_RESEARCH_INCOMPATIBLE: 'Hồ sơ nghiên cứu không tương thích. Hãy bỏ tùy chọn này.',
          REPORT_FONT_UNAVAILABLE: 'Máy chủ chưa có font Unicode phù hợp cho PDF.',
          REPORT_DEPENDENCY_MISSING: 'Máy chủ chưa cài thư viện xuất báo cáo cần thiết.',
        };
        setError(
          failure instanceof ApiError
            ? (known[failure.code] ?? failure.message)
            : 'Chưa thể xuất báo cáo. Vui lòng thử lại.',
        );
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy('');
      }
    }
  }
  return (
    <section className="report-export" aria-label="Xuất báo cáo">
      <div className="report-export-actions">
        <button
          type="button"
          className="button button-secondary"
          disabled={!!busy}
          onClick={() => void run('pdf')}
        >
          <FileDown size={16} />
          {busy === 'pdf' ? 'Đang xuất PDF…' : 'Xuất PDF'}
        </button>
        <button
          type="button"
          className="button button-secondary"
          disabled={!!busy}
          onClick={() => void run('xlsx')}
        >
          <FileDown size={16} />
          {busy === 'xlsx' ? 'Đang xuất Excel…' : 'Xuất Excel'}
        </button>
      </div>
      {target.source === 'preview' && (
        <details>
          <summary>Tùy chọn báo cáo</summary>
          <label>
            <input
              type="checkbox"
              checked={includeAi}
              disabled={!!busy}
              onChange={(event) => setIncludeAi(event.target.checked)}
            />
            Kèm nhận xét AI đã tạo (bản mới nhất của kết quả này)
          </label>
          {research && (
            <label>
              <input
                type="checkbox"
                checked={includeResearch}
                disabled={!!busy}
                onChange={(event) => setIncludeResearch(event.target.checked)}
              />
              Kèm hồ sơ phân nhóm từ dữ liệu nghiên cứu
            </label>
          )}
        </details>
      )}
      {target.source === 'customer' && (
        <small>
          Một khách hàng; tối đa {target.limit ?? 20} bản ghi mới nhất mỗi nguồn. Báo cáo ghi rõ số
          lượng đã xuất/tổng hiện có.
        </small>
      )}
      {target.source === 'churn_watchlist' && (
        <small>
          Máy chủ tính lại danh sách từ bản ghi hành vi mới nhất, xuất các mức rủi ro đang chọn kèm
          3 yếu tố làm tăng nguy cơ của từng khách; không lưu kết quả.
        </small>
      )}
      {busy && <small role="status">Đang chuẩn bị báo cáo từ dữ liệu đã xác minh…</small>}
      {error && (
        <p role="alert" className="report-export-error">
          {error}
        </p>
      )}
      {done && <small role="status">{done}</small>}
    </section>
  );
}
