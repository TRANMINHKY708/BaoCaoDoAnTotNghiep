import { useEffect, useRef, useState } from 'react';
import { Copy, Sparkles } from 'lucide-react';
import { ApiError } from '../../api/errors';
import { useWorkspace } from '../../app/context';
import { assistantError } from './assistant';
import { SafeMarkdown } from './SafeMarkdown';
import { narrativeText } from '../../utils/narrativeText';
import './narrative.css';

type Content = {
  overview: string;
  notable_factors: string[];
  interpretation: string;
  limitations: string[];
  reference_suggestions: string[];
};
type Narrative = {
  narrative: Content;
  analysis_kind: 'prediction' | 'segmentation' | 'what_if';
  source: 'verified_live_backend_result';
  result_fingerprint: string;
  model_versions: string[];
  research_profile_used: boolean;
  generated_at: string;
  history_persisted: false;
};
declare module '../../api/generated' {
  interface paths {
    '/api/v1/assistant/narrative': {
      post: {
        requestBody: { content: { 'application/json': { receipt: string } } };
        responses: { 200: { content: { 'application/json': Narrative } } };
      };
    };
  }
}
const titles: Record<keyof Content, string> = {
  overview: 'Tổng quan',
  notable_factors: 'Điểm đáng chú ý',
  interpretation: 'Diễn giải',
  limitations: 'Giới hạn',
  reference_suggestions: 'Gợi ý tham khảo',
};
function checked(value: Narrative, kind: Narrative['analysis_kind']) {
  if (
    !value ||
    value.analysis_kind !== kind ||
    value.source !== 'verified_live_backend_result' ||
    value.history_persisted !== false ||
    !/^[a-f0-9]{64}$/.test(value.result_fingerprint) ||
    !value.narrative
  )
    throw new ApiError('protocol');
  for (const field of Object.keys(titles) as (keyof Content)[]) {
    const content = value.narrative[field];
    if (field === 'overview' || field === 'interpretation') {
      if (typeof content !== 'string' || !content.trim() || content.length > 4000)
        throw new ApiError('protocol');
    } else if (
      !Array.isArray(content) ||
      content.length > 6 ||
      content.some((x) => typeof x !== 'string' || x.length > 2000)
    )
      throw new ApiError('protocol');
  }
  return value;
}

export function NarrativePanel({
  receipt,
  kind,
}: {
  receipt?: string | null;
  kind: Narrative['analysis_kind'];
}) {
  const { revision, user, session, status, authState, hasCapability } = useWorkspace();
  if (
    !session.accountMode ||
    status !== 'connected' ||
    authState !== 'authenticated' ||
    !hasCapability('models.read')
  )
    return null;
  if (!receipt)
    return (
      <p className="prediction-help">
        AI nhận xét hỗ trợ kết quả JSON đơn lẻ vừa được backend xác minh. Nếu cần, hãy chạy lại phân
        tích; batch/CSV và kết quả cũ chưa có mã tham chiếu chưa được hỗ trợ.
      </p>
    );
  return (
    <NarrativeBody
      key={`${revision}:${user?.id}:${kind}:${receipt}`}
      receipt={receipt}
      kind={kind}
    />
  );
}

function NarrativeBody({ receipt, kind }: { receipt: string; kind: Narrative['analysis_kind'] }) {
  const { session } = useWorkspace();
  const [result, setResult] = useState<Narrative | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [copied, setCopied] = useState('');
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );
  async function run() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError('');
    setResult(null);
    setCopied('');
    try {
      const response = await session.client.request('post', '/api/v1/assistant/narrative', {
        body: { receipt },
        signal: controller.signal,
        timeoutMs: 60000,
      });
      if (!controller.signal.aborted && active.current === controller)
        setResult(checked(response.data, kind));
    } catch (failure) {
      if (!controller.signal.aborted && active.current === controller)
        setError(
          failure instanceof ApiError && failure.status === 409
            ? 'Kết quả đã hết thời hạn xác minh hoặc thuộc phiên khác. Hãy chạy lại phân tích rồi yêu cầu nhận xét.'
            : assistantError(failure),
        );
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }
  async function copy() {
    if (!result) return;
    const text = (Object.keys(titles) as (keyof Content)[])
      .map(
        (key) =>
          `${titles[key]}\n${Array.isArray(result.narrative[key]) ? result.narrative[key].join('\n') : result.narrative[key]}`,
      )
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(narrativeText(text));
      setCopied('Đã sao chép nhận xét');
    } catch {
      setCopied('Chưa sao chép được. Hãy chọn và sao chép nội dung.');
    }
  }
  return (
    <section className="ai-narrative" aria-label="AI nhận xét kết quả">
      <div className="ai-narrative-actions">
        <button
          type="button"
          className="button button-secondary"
          disabled={busy}
          onClick={() => void run()}
        >
          <Sparkles size={16} />
          {busy
            ? 'AI đang nhận xét…'
            : error
              ? 'Thử lại AI nhận xét'
              : result
                ? 'Tạo lại nhận xét'
                : 'AI nhận xét'}
        </button>
        {result && (
          <button type="button" className="button button-secondary" onClick={() => void copy()}>
            <Copy size={15} />
            Sao chép nhận xét
          </button>
        )}
      </div>
      {busy && <p role="status">Đang tổng hợp nhận xét từ kết quả đã được xác minh…</p>}
      {error && (
        <p className="assistant-error" role="alert">
          {error}
        </p>
      )}
      {copied && <small role="status">{copied}</small>}
      {result && (
        <div className="ai-narrative-content">
          {(Object.keys(titles) as (keyof Content)[]).map((key) => (
            <div key={key}>
              <h3>{titles[key]}</h3>
              {Array.isArray(result.narrative[key]) ? (
                <ul>
                  {result.narrative[key].map((text, i) => (
                    <li key={i}>
                      <SafeMarkdown text={text} />
                    </li>
                  ))}
                </ul>
              ) : (
                <SafeMarkdown text={result.narrative[key]} />
              )}
            </div>
          ))}
          <small>
            {result.research_profile_used
              ? 'Có đối chiếu hồ sơ dataset nghiên cứu cùng phiên bản mô hình; không đại diện đặc điểm chắc chắn của cá nhân.'
              : 'Nguồn: kết quả backend vừa phân tích; không tự lưu vào lịch sử.'}
          </small>
        </div>
      )}
      <p className="ai-narrative-limits">
        Nhận xét AI để tham khảo, có thể sai; không chứng minh nhân quả hoặc bảo đảm kết quả tương
        lai.
      </p>
    </section>
  );
}
