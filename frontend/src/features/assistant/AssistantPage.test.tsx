import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Link, MemoryRouter, useLocation } from 'react-router-dom';
import { WorkspaceContext } from '../../app/context';
import { WorkspaceSession } from '../auth/session';
import { ApiError } from '../../api/errors';
import {
  assistantError,
  boundedHistory,
  checkedReply,
  textLength,
  type AssistantReply,
  type Turn,
} from './assistant';
import { SafeMarkdown } from './SafeMarkdown';
import AssistantPage from './AssistantPage';
import { AssistantDock } from './AssistantDock';

const customerId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const reply: AssistantReply = {
  message: '## Phân tích\n**Low** là mức mua thấp.\n- Dữ liệu snapshot\n- Không suy ra tương lai',
  model: 'gemini-3.5-flash-lite',
  generated_at: '2026-11-04T01:00:00Z',
  sources: [],
  history_persisted: false,
  disclaimer: 'AI có thể sai; không chứng minh quan hệ nhân quả.',
};
const owned: WorkspaceSession[] = [];
afterEach(() => {
  owned.splice(0).forEach((session) => session.dispose());
  vi.unstubAllGlobals();
});
const response = (data: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Security-Profile': 'accounts' },
  });

async function setup(
  options: {
    path?: string;
    respond?: (init: RequestInit) => Promise<Response>;
    noCapability?: boolean;
  } = {},
) {
  const me = {
    user: {
      id: customerId,
      username: 'test.viewer',
      display_name: 'Test Viewer',
      role: 'VIEWER',
      is_active: true,
      must_change_password: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      row_version: 1,
      status: 'ACTIVE',
      locked_until: null,
    },
    capabilities: options.noCapability ? [] : ['models.read', 'customers.read', 'history.read'],
    session: { expires_at: '2099-01-01T00:00:00Z', idle_expires_at: '2099-01-01T00:00:00Z' },
  };
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
    if (String(url).endsWith('/csrf'))
      return response({
        csrf_token: 'n'.repeat(43),
        state: 'preauth',
        expires_at: '2099-01-01T00:00:00Z',
      });
    if (String(url).endsWith('/login')) return response({ ...me, csrf_token: 'n'.repeat(43) });
    if (String(url).endsWith('/logout')) return response(null, 204);
    if (String(url).endsWith('/assistant/chat'))
      return options.respond ? options.respond(init!) : response(reply);
    throw new Error('Unexpected test URL');
  });
  const session = new WorkspaceSession('/backend', () => {}, fetcher, { profile: 'accounts' });
  owned.push(session);
  await session.login('test.viewer', 'test-only-not-real-passphrase');
  function Harness() {
    const location = useLocation();
    return (
      <>
        <Link to={`/assistant?customer_id=${otherId}`}>Khách hàng khác</Link>
        <Link to="/dashboard">Trang tổng quan thử nghiệm</Link>
        <output aria-label="URL">{location.search}</output>
        {location.pathname === '/assistant' ? (
          <AssistantPage />
        ) : (
          <h1>Trang tổng quan thử nghiệm</h1>
        )}
      </>
    );
  }
  render(
    <WorkspaceContext.Provider value={session}>
      <MemoryRouter initialEntries={[options.path ?? '/assistant']}>
        <AssistantDock>
          <Harness />
        </AssistantDock>
      </MemoryRouter>
    </WorkspaceContext.Provider>,
  );
  return {
    session,
    fetcher,
    chats: () => fetcher.mock.calls.filter(([url]) => String(url).endsWith('/assistant/chat')),
  };
}
function send(text = 'Purchase_Level là gì?') {
  fireEvent.change(screen.getByLabelText('Tin nhắn cho trợ lý'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi' }));
}

it('sends accounts cookie/CSRF via existing client and displays real answer/history', async () => {
  const ui = await setup();
  expect(screen.getByText('Xin chào! Tôi là Trợ lý MK eAI.')).toBeInTheDocument();
  send();
  await screen.findByRole('heading', { name: 'Phân tích' });
  expect(ui.chats()).toHaveLength(1);
  const init = ui.chats()[0]![1]!;
  expect(init.credentials).toBe('same-origin');
  expect(new Headers(init.headers).get('X-CSRF-Token')).toBe('n'.repeat(43));
  expect(new Headers(init.headers).get('Authorization')).toBeNull();
  expect(JSON.parse(String(init.body))).toEqual({ message: 'Purchase_Level là gì?', history: [] });
  expect(screen.getByText(reply.disclaimer)).toBeInTheDocument();
  send('Giải thích thêm');
  await waitFor(() =>
    expect(screen.getAllByRole('heading', { name: 'Phân tích' })).toHaveLength(2),
  );
  expect(JSON.parse(String(ui.chats()[1]![1]!.body)).history).toEqual([
    { role: 'user', content: 'Purchase_Level là gì?' },
    { role: 'assistant', content: reply.message },
  ]);
});

it('suggestions send immediately and new conversation clears messages', async () => {
  const ui = await setup();
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Mô hình dự báo rời bỏ chính xác đến đâu và dùng những thuộc tính nào?',
    }),
  );
  await screen.findByRole('heading', { name: 'Phân tích' });
  fireEvent.click(screen.getByRole('button', { name: 'Cuộc trò chuyện mới' }));
  expect(screen.queryByRole('heading', { name: 'Phân tích' })).not.toBeInTheDocument();
  send('Câu hỏi mới');
  await screen.findByRole('heading', { name: 'Phân tích' });
  expect(JSON.parse(String(ui.chats()[1]![1]!.body)).history).toEqual([]);
});

it('minimizes and preserves the conversation when navigating to another page', async () => {
  const ui = await setup();
  send();
  await screen.findByRole('heading', { name: 'Phân tích' });
  fireEvent.click(screen.getByRole('button', { name: 'Thu gọn trợ lý' }));
  expect(screen.queryByRole('dialog', { name: 'Trợ lý MK eAI' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Trang tổng quan thử nghiệm' }));
  fireEvent.click(screen.getByRole('button', { name: 'Mở Trợ lý AI' }));
  expect(screen.getByRole('heading', { name: 'Phân tích' })).toBeInTheDocument();
  send('Hỏi tiếp trên trang khác');
  await waitFor(() => expect(ui.chats()).toHaveLength(2));
  expect(JSON.parse(String(ui.chats()[1]![1]!.body)).history).toHaveLength(2);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.getByRole('button', { name: 'Mở Trợ lý AI' })).toHaveFocus();
});

it('keeps a pending reply while minimized without stealing focus', async () => {
  let resolve!: (value: Response) => void;
  await setup({
    respond: () =>
      new Promise((done) => {
        resolve = done;
      }),
  });
  send();
  fireEvent.click(screen.getByRole('button', { name: 'Thu gọn trợ lý' }));
  await act(async () => resolve(response(reply)));
  expect(screen.getByRole('button', { name: 'Mở Trợ lý AI' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Mở Trợ lý AI' }));
  expect(screen.getByRole('heading', { name: 'Phân tích' })).toBeInTheDocument();
});

it('prevents duplicate sends and reset discards a late response', async () => {
  let resolve!: (value: Response) => void;
  const ui = await setup({
    respond: () =>
      new Promise((done) => {
        resolve = done;
      }),
  });
  send('Chờ xử lý');
  expect(screen.getByRole('button', { name: 'Gửi' })).toBeDisabled();
  fireEvent.keyDown(screen.getByLabelText('Tin nhắn cho trợ lý'), { key: 'Enter' });
  expect(ui.chats()).toHaveLength(1);
  expect(screen.getByText('Trợ lý đang đọc và tổng hợp câu trả lời…')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cuộc trò chuyện mới' }));
  expect(ui.chats()[0]![1]!.signal?.aborted).toBe(true);
  await act(async () => resolve(response(reply)));
  expect(screen.queryByRole('heading', { name: 'Phân tích' })).not.toBeInTheDocument();
});

it('binds customer context, renders source provenance and resets on customer change', async () => {
  const ui = await setup({
    path: `/assistant?customer_id=${customerId}`,
    respond: async () =>
      response({
        ...reply,
        sources: [
          {
            tool: 'get_customer_summary',
            source: 'application_postgresql',
            customer_id: customerId,
            records_returned: 1,
          },
        ],
      }),
  });
  send();
  await screen.findByText('Dữ liệu khách hàng');
  expect(JSON.parse(String(ui.chats()[0]![1]!.body)).customer_id).toBe(customerId);
  fireEvent.click(screen.getByText('Khách hàng khác'));
  expect(screen.queryByText('Dữ liệu khách hàng')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Tin nhắn cho trợ lý')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ ngữ cảnh khách hàng' }));
  expect(screen.getByLabelText('URL')).toHaveTextContent('');
});

it('clears conversation and URL context on logout/session change', async () => {
  const ui = await setup({ path: `/assistant?customer_id=${customerId}` });
  send();
  await screen.findByRole('heading', { name: 'Phân tích' });
  await act(async () => ui.session.logout());
  expect(screen.queryByRole('heading', { name: 'Phân tích' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Đăng nhập' })).toBeInTheDocument();
  expect(screen.getByLabelText('URL')).toHaveTextContent('');
});

it('aborts pending request when customer context changes', async () => {
  const ui = await setup({
    path: `/assistant?customer_id=${customerId}`,
    respond: () => new Promise(() => {}),
  });
  send();
  fireEvent.click(screen.getByText('Khách hàng khác'));
  expect(ui.chats()[0]![1]!.signal?.aborted).toBe(true);
  expect(screen.queryByText('Trợ lý đang đọc và tổng hợp câu trả lời…')).not.toBeInTheDocument();
});

it.each([403, 422, 429, 502, 503, 504])(
  'handles HTTP %s safely and keeps draft without auto retry',
  async (status) => {
    const ui = await setup({
      respond: async () =>
        response({ error: { code: 'TEST_ERROR', message: 'PRIVATE provider trace key' } }, status),
    });
    send('Giữ câu hỏi');
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Tin nhắn cho trợ lý')).toHaveValue('Giữ câu hỏi');
    expect(screen.queryByText(/PRIVATE/)).not.toBeInTheDocument();
    expect(ui.chats()).toHaveLength(1);
  },
);

it('handles 401 through the existing session expiration flow', async () => {
  const ui = await setup({
    respond: async () => response({ error: { code: 'UNAUTHORIZED' } }, 401),
  });
  send();
  await screen.findByRole('link', { name: 'Đăng nhập' });
  expect(ui.session.getSnapshot().status).toBe('disconnected');
});

it('handles network failure and retry manually', async () => {
  let failed = true;
  const ui = await setup({
    respond: async () => {
      if (failed) throw new Error('private URL');
      return response(reply);
    },
  });
  send('Thử lại');
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Tin nhắn cho trợ lý')).toHaveValue('Thử lại');
  failed = false;
  fireEvent.click(screen.getByRole('button', { name: 'Gửi' }));
  await screen.findByRole('heading', { name: 'Phân tích' });
  expect(ui.chats()).toHaveLength(2);
  expect(JSON.parse(String(ui.chats()[1]![1]!.body)).history).toEqual([]);
});

it('rejects oversized questions and supports Enter versus Shift+Enter', async () => {
  const ui = await setup();
  const input = screen.getByLabelText('Tin nhắn cho trợ lý');
  fireEvent.change(input, { target: { value: 'a'.repeat(4001) } });
  expect(screen.getByRole('alert')).toHaveTextContent('vượt giới hạn');
  expect(screen.getByRole('button', { name: 'Gửi' })).toBeDisabled();
  fireEvent.change(input, { target: { value: 'Câu hỏi' } });
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
  expect(ui.chats()).toHaveLength(0);
  fireEvent.keyDown(input, { key: 'Enter' });
  await screen.findByRole('heading', { name: 'Phân tích' });
  expect(ui.chats()).toHaveLength(1);
});

it('copies the actual answer', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  await setup();
  send();
  await screen.findByRole('heading', { name: 'Phân tích' });
  fireEvent.click(screen.getByRole('button', { name: 'Sao chép câu trả lời' }));
  await screen.findByText('Đã sao chép');
  expect(writeText).toHaveBeenCalledWith(reply.message);
});

it('blocks malformed customer IDs and missing capability without API calls', async () => {
  const ui = await setup({ path: '/assistant?customer_id=not-uuid' });
  expect(screen.getByText('Ngữ cảnh khách hàng chưa hợp lệ')).toBeInTheDocument();
  expect(ui.chats()).toHaveLength(0);
});
it('requires read capability even for an authenticated viewer', async () => {
  const ui = await setup({ noCapability: true });
  expect(screen.getByText('Không có quyền sử dụng trợ lý')).toBeInTheDocument();
  expect(ui.chats()).toHaveLength(0);
});

it('bounds context by codepoints, 10 turns and complete pairs', () => {
  const turns: Turn[] = Array.from({ length: 12 }, (_, i) => ({
    role: i % 2 ? 'assistant' : 'user',
    content: `${i}:` + 'x'.repeat(1950),
  }));
  const history = boundedHistory(turns, 'm'.repeat(4000));
  expect(history).toHaveLength(4);
  expect(history[0]!.content.startsWith('8:')).toBe(true);
  expect(history.reduce((sum, x) => sum + textLength(x.content), 4000)).toBeLessThanOrEqual(12000);
  expect(history.every((x, i) => x.role === (i % 2 ? 'assistant' : 'user'))).toBe(true);
  expect(
    boundedHistory(
      [
        { role: 'user', content: 'short' },
        { role: 'assistant', content: 'x'.repeat(2001) },
      ],
      'message',
    ),
  ).toEqual([]);
  expect(textLength('😀')).toBe(1);
  expect(
    boundedHistory(
      Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 ? 'assistant' : 'user',
        content: 'short',
      })),
      'hello',
    ),
  ).toHaveLength(10);
});

it('renders Markdown text, tables and code without HTML/scripts/remote resources', () => {
  const { container } = render(
    <SafeMarkdown
      text={
        '# Tiêu đề\n- mục\n1. thứ tự\n| A | B |\n| --- | --- |\n| 1 | 2 |\n```html\n<script>alert(1)</script>\n```\n<img src="https://private.invalid" onerror="alert(1)">\n[click](javascript:alert(1))'
      }
    />,
  );
  expect(screen.getByRole('heading', { name: 'Tiêu đề' })).toBeInTheDocument();
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(container.querySelector('script,img,a,iframe')).toBeNull();
  expect(container.querySelector('pre code')).toHaveTextContent('<script>alert(1)</script>');
});

it('validates provenance/model and never invents missing sources', () => {
  expect(checkedReply(reply).sources).toEqual([]);
  expect(() =>
    checkedReply(
      {
        ...reply,
        sources: [
          {
            tool: 'get_customer_summary',
            source: 'application_postgresql',
            customer_id: otherId,
            records_returned: 1,
          },
        ],
      },
      customerId,
    ),
  ).toThrow(ApiError);
  expect(() => checkedReply({ ...reply, message: '' })).toThrow(ApiError);
  expect(() =>
    checkedReply({ ...reply, history_persisted: true } as unknown as AssistantReply),
  ).toThrow(ApiError);
  expect(assistantError(new ApiError('timeout'))).toContain('quá lâu');
});

it('accepts the K10 global sources and the churn tool only in their own source kind', () => {
  const global = (tool: string, source: string) => ({
    tool,
    source,
    customer_id: null,
    records_returned: 1,
  });
  const ok = checkedReply({
    ...reply,
    sources: [
      global('get_research_results', 'research_reports'),
      global('get_churn_model_info', 'pinned_model_artifact'),
      global('get_workspace_overview', 'application_workspace_aggregate'),
    ],
  } as AssistantReply);
  expect(ok.sources).toHaveLength(3);
  const churn = {
    tool: 'get_customer_churn_risk',
    source: 'application_postgresql',
    customer_id: customerId,
    records_returned: 1,
  };
  expect(
    checkedReply({ ...reply, sources: [churn] } as AssistantReply, customerId).sources,
  ).toHaveLength(1);
  for (const bad of [
    global('get_research_results', 'application_postgresql'),
    global('get_churn_model_info', 'research_reports'),
    {
      ...global('get_workspace_overview', 'application_workspace_aggregate'),
      customer_id: customerId,
    },
    global('toString', 'research_reports'),
    churn,
  ])
    expect(() => checkedReply({ ...reply, sources: [bad] } as AssistantReply)).toThrow(ApiError);
  expect(() =>
    checkedReply({
      ...reply,
      sources: Array(9).fill(global('get_research_results', 'research_reports')),
    } as AssistantReply),
  ).toThrow(ApiError);
});

it('offers customer-specific churn suggestions inside a customer context', async () => {
  await setup({ path: `/assistant?customer_id=${customerId}` });
  expect(
    screen.getByRole('button', { name: 'Khách hàng này có nguy cơ rời bỏ không? Vì sao?' }),
  ).toBeInTheDocument();
});
