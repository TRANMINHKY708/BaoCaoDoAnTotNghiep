import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Bot, Minus } from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../../app/context';
import { isCustomerId } from '../customers/customers';
import { AssistantContext } from './AssistantContext';
import { Conversation } from './AssistantConversation';
import './assistant.css';

export function AssistantDock({ children }: { children: ReactNode }) {
  const { session, revision, status, authState, user, hasCapability } = useWorkspace();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<{ opened: boolean; started: boolean; customerId?: string }>({
    opened: false,
    started: false,
  });
  const launcher = useRef<HTMLButtonElement>(null);
  const allowed =
    session.accountMode &&
    status === 'connected' &&
    authState === 'authenticated' &&
    hasCapability('models.read');
  useEffect(
    () =>
      session.subscribe(() => {
        if (session.getSnapshot().revision !== revision)
          setState({ opened: false, started: false });
      }),
    [session, revision],
  );
  const open = useCallback(
    (customerId?: string) => {
      if (!allowed || (customerId && !isCustomerId(customerId))) return;
      setState({ opened: true, started: true, customerId });
    },
    [allowed],
  );
  const minimize = () => {
    setState((current) => ({ ...current, opened: false }));
    launcher.current?.focus();
  };
  useEffect(() => {
    if (!state.opened) return;
    const frame = requestAnimationFrame(() =>
      document.getElementById('assistant-message')?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [state.opened]);
  return (
    <AssistantContext.Provider value={{ open }}>
      {children}
      {allowed && (
        <div className="assistant-dock">
          {state.started && (
            <section
              id="assistant-dock-dialog"
              className="assistant-dock-window"
              role="dialog"
              aria-modal="false"
              aria-label="Trợ lý MK eAI"
              hidden={!state.opened}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  minimize();
                }
              }}
            >
              <header className="assistant-dock-bar">
                <span>
                  <Bot size={20} />
                  <strong>Trợ lý MK eAI</strong>
                </span>
                <button className="icon-button" aria-label="Thu gọn trợ lý" onClick={minimize}>
                  <Minus size={20} />
                </button>
              </header>
              <Conversation
                key={`${revision}:${user?.id}:${state.customerId?.toLowerCase() ?? ''}`}
                customerId={state.customerId}
                clearContext={() => {
                  open();
                  if (location.pathname === '/assistant') {
                    const next = new URLSearchParams(params);
                    next.delete('customer_id');
                    setParams(next, { replace: true });
                  }
                }}
              />
            </section>
          )}
          <button
            ref={launcher}
            className="assistant-launcher"
            aria-label={state.opened ? 'Thu gọn Trợ lý AI' : 'Mở Trợ lý AI'}
            aria-expanded={state.opened}
            aria-controls={state.started ? 'assistant-dock-dialog' : undefined}
            onClick={() =>
              state.opened
                ? minimize()
                : setState((current) => ({ ...current, opened: true, started: true }))
            }
          >
            <Bot size={24} />
            <span>Trợ lý AI</span>
          </button>
        </div>
      )}
    </AssistantContext.Provider>
  );
}
