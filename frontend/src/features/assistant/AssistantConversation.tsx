import { useEffect, useRef, useState } from 'react';
import { Bot, Copy, Plus, Send, Sparkles } from 'lucide-react';
import { useWorkspace } from '../../app/context';
import {
  assistantError,
  boundedHistory,
  checkedReply,
  sourceKindLabels,
  sourceLabels,
  textLength,
  type AssistantReply,
  type Turn,
} from './assistant';
import { SafeMarkdown } from './SafeMarkdown';
import { narrativeText } from '../../utils/narrativeText';
import './assistant.css';

const suggestions = [
  'Mô hình dự báo rời bỏ chính xác đến đâu và dùng những thuộc tính nào?',
  'So sánh kết quả các thuật toán dự đoán mức độ mua hàng.',
  'Hệ thống đang quản lý bao nhiêu khách hàng và kết quả?',
  'Gợi ý chiến lược giữ chân khách hàng có nguy cơ rời bỏ cao.',
];
const customerSuggestions = [
  'Khách hàng này có nguy cơ rời bỏ không? Vì sao?',
  'Tóm tắt các kết quả phân tích đã lưu của khách hàng này.',
  'Nên làm gì để giữ chân khách hàng này?',
  'Giải thích cách đọc biểu đồ SHAP.',
];
type Message = Turn & { reply?: AssistantReply };

function Answer({ reply }: { reply: AssistantReply }) {
  const [copyState, setCopyState] = useState('');
  return (
    <>
      <SafeMarkdown text={reply.message} />
      <div className="assistant-answer-meta">
        <button
          type="button"
          className="button button-secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(narrativeText(reply.message));
              setCopyState('Đã sao chép');
            } catch {
              setCopyState('Chưa sao chép được. Bạn có thể chọn và sao chép nội dung.');
            }
          }}
        >
          <Copy size={14} />
          Sao chép câu trả lời
        </button>
      </div>
      {copyState && <small role="status">{copyState}</small>}
      {!!reply.sources.length && (
        <details className="assistant-sources">
          <summary>Nguồn dữ liệu đã sử dụng ({reply.sources.length})</summary>
          <ul>
            {reply.sources.map((source, index) => (
              <li key={index}>
                <strong>{sourceKindLabels[source.source]}</strong>
                <br />
                {sourceLabels[source.tool]} · {source.records_returned} bản ghi được trả về
                {source.customer_id && <small>Khách hàng: {source.customer_id}</small>}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="assistant-disclaimer">{reply.disclaimer}</p>
    </>
  );
}

export function Conversation({
  customerId,
  clearContext,
}: {
  customerId?: string;
  clearContext: () => void;
}) {
  const { session } = useWorkspace();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState(''),
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const active = useRef<AbortController | null>(null),
    end = useRef<HTMLDivElement>(null),
    input = useRef<HTMLTextAreaElement>(null);
  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );
  useEffect(() => {
    end.current?.scrollIntoView?.({
      block: 'nearest',
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  }, [messages, pending, error]);
  const length = textLength(draft.trim());
  async function send(value = draft) {
    const message = value.trim();
    if (active.current) return;
    if (!message || textLength(message) > 4000) {
      setError('Vui lòng nhập câu hỏi từ 1 đến 4.000 ký tự.');
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    setDraft(message);
    setPending(true);
    setError('');
    try {
      const result = await session.client.request('post', '/api/v1/assistant/chat', {
        body: {
          message,
          history: boundedHistory(messages, message),
          ...(customerId ? { customer_id: customerId } : {}),
        },
        signal: controller.signal,
        timeoutMs: 60000,
      });
      if (controller.signal.aborted || active.current !== controller) return;
      const reply = checkedReply(result.data, customerId);
      setMessages((current) => [
        ...current,
        { role: 'user', content: message },
        { role: 'assistant', content: reply.message, reply },
      ]);
      setDraft('');
    } catch (failure) {
      if (!controller.signal.aborted && active.current === controller)
        setError(assistantError(failure));
    } finally {
      if (active.current === controller) {
        active.current = null;
        setPending(false);
        if (!input.current?.closest('[hidden]')) input.current?.focus();
      }
    }
  }
  function reset() {
    active.current?.abort();
    active.current = null;
    setMessages([]);
    setDraft('');
    setError('');
    setPending(false);
    if (!input.current?.closest('[hidden]')) input.current?.focus();
  }
  return (
    <div className="assistant-workspace">
      <header className="assistant-heading">
        <div>
          <span className="assistant-eyebrow">
            <Sparkles size={15} />
            ĐỒNG HÀNH CÙNG DỮ LIỆU
          </span>
          <h1>Trợ lý MK eAI</h1>
        </div>
        <button className="button button-secondary" onClick={reset}>
          <Plus size={16} />
          Cuộc trò chuyện mới
        </button>
      </header>
      {customerId && (
        <div className="assistant-context">
          <div>
            <strong>Đang phân tích trong ngữ cảnh khách hàng đã chọn</strong>
            <small>{customerId}</small>
            <span>
              Chỉ đọc dữ liệu được phép; có thể tính nguy cơ rời bỏ nhưng không lưu kết quả hay thay
              đổi dữ liệu.
            </span>
          </div>
          <button className="button button-secondary" onClick={clearContext}>
            Bỏ ngữ cảnh khách hàng
          </button>
        </div>
      )}
      <section className="assistant-panel" aria-label="Hội thoại với Trợ lý MK eAI">
        <div
          className="assistant-messages"
          role="log"
          aria-label="Nội dung hội thoại"
          aria-live="polite"
          aria-relevant="additions"
          aria-busy={pending}
        >
          {!messages.length && !pending && (
            <div className="assistant-welcome">
              <span className="assistant-avatar assistant-avatar-large">
                <Bot size={30} />
              </span>
              <h2>Xin chào! Tôi là Trợ lý MK eAI.</h2>
              <p>
                Tôi đọc dữ liệu của hệ thống để giải thích dự đoán mức độ mua hàng, nguy cơ rời bỏ,
                phân nhóm khách hàng và kết quả nghiên cứu của đồ án. Bạn cũng có thể hỏi tôi về học
                máy, thương mại điện tử hay bất kỳ chủ đề nào khác.
              </p>
              <div className="assistant-suggestions">
                {(customerId ? customerSuggestions : suggestions).map((text) => (
                  <button key={text} onClick={() => void send(text)}>
                    {text}
                    <Send size={15} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message, index) => (
            <article
              key={index}
              className={`assistant-message assistant-${message.role}`}
              aria-label={message.role === 'user' ? 'Tin nhắn của bạn' : 'Câu trả lời của trợ lý'}
            >
              <span className="assistant-avatar" aria-hidden="true">
                {message.role === 'assistant' ? <Bot size={20} /> : 'Bạn'}
              </span>
              <div className="assistant-bubble">
                {message.reply ? (
                  <Answer reply={message.reply} />
                ) : (
                  <p className="assistant-user-text">{message.content}</p>
                )}
              </div>
            </article>
          ))}
          {pending && (
            <>
              <article className="assistant-message assistant-user">
                <span className="assistant-avatar">Bạn</span>
                <div className="assistant-bubble">
                  <p className="assistant-user-text">{draft}</p>
                </div>
              </article>
              <div className="assistant-pending" role="status">
                <Bot size={20} />
                <span>Trợ lý đang đọc và tổng hợp câu trả lời…</span>
                <button
                  className="text-link"
                  onClick={() => {
                    active.current?.abort();
                    active.current = null;
                    setPending(false);
                  }}
                >
                  Dừng chờ
                </button>
              </div>
            </>
          )}
          <div ref={end} />
        </div>
        <form
          className="assistant-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          {length > 4000 && (
            <p className="assistant-error" role="alert">
              Câu hỏi vượt giới hạn 4.000 ký tự. Hãy rút gọn trước khi gửi.
            </p>
          )}
          {error && (
            <p className="assistant-error" role="alert">
              {error}
            </p>
          )}
          <label className="sr-only" htmlFor="assistant-message">
            Tin nhắn cho trợ lý
          </label>
          <div className="assistant-input-row">
            <textarea
              ref={input}
              id="assistant-message"
              rows={3}
              placeholder="Hỏi về dữ liệu hoặc kết quả phân tích…"
              value={draft}
              readOnly={pending}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send();
                }
              }}
              aria-describedby="assistant-input-hint"
            />
            <button
              className="button button-primary"
              type="submit"
              disabled={pending || !length || length > 4000}
            >
              <Send size={18} />
              <span>Gửi</span>
            </button>
          </div>
          <div className="assistant-input-hint" id="assistant-input-hint">
            <span>Enter để gửi · Shift+Enter để xuống dòng</span>
            <span className={length > 4000 ? 'assistant-limit-error' : ''}>
              {length.toLocaleString('vi-VN')} / 4.000 ký tự
            </span>
          </div>
          <p className="assistant-footnote">Hội thoại chỉ giữ trong phiên này.</p>
        </form>
      </section>
      <p className="assistant-scientific">
        AI có thể sai; không chứng minh nhân quả hoặc bảo đảm hành vi mua hàng tương lai.
      </p>
    </div>
  );
}
