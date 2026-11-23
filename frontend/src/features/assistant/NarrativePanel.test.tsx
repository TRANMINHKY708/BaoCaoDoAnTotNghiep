import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ApiClient } from '../../api/client';
import { NarrativePanel } from './NarrativePanel';
import { PredictionResults } from '../predictions/PredictionResults';
import { SegmentResults } from '../segmentation/SegmentResults';
import { WhatIfResults } from '../what-if/WhatIfResults';
import purchaseFixture from '../../test/fixtures/t14_predictions.json';
import segmentFixture from '../../test/fixtures/t15_segmentation.json';
import whatIfFixture from '../../test/fixtures/t16_what_if.json';
import type { Result } from '../predictions/prediction';
import type { Segment } from '../segmentation/segmentation';
import type { Preview, Comparison } from '../what-if/whatIf';

const receipt = 'r'.repeat(43),
  otherReceipt = 's'.repeat(43);
let revision = 1,
  connected = true;
let client: ApiClient;
vi.mock('../../app/context', () => ({
  useWorkspace: () => ({
    revision,
    user: { id: 'test-user' },
    status: connected ? 'connected' : 'disconnected',
    authState: connected ? 'authenticated' : 'anonymous',
    session: { accountMode: true, client },
    hasCapability: () => connected,
  }),
}));
const result = (kind = 'prediction') => ({
  narrative: {
    overview: 'Kết quả được mô hình phân loại từ snapshot.',
    notable_factors: ['SHAP có dấu trong raw margin.'],
    interpretation: 'Chỉ đọc các kết quả đang hiển thị.',
    limitations: ['Không suy ra nhân quả.'],
    reference_suggestions: ['Đối chiếu dữ liệu đầu vào.'],
  },
  analysis_kind: kind,
  source: 'verified_live_backend_result',
  result_fingerprint: 'a'.repeat(64),
  model_versions: ['1.0.0'],
  research_profile_used: false,
  generated_at: '2026-11-04T00:00:00Z',
  history_persisted: false,
});
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Security-Profile': 'accounts' },
  });
function setup(respond: (init: RequestInit) => Promise<Response> = async () => response(result())) {
  revision = 1;
  connected = true;
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => respond(init!));
  client = new ApiClient(
    '/backend',
    () => null,
    () => {
      connected = false;
    },
    fetcher,
    { credentials: 'same-origin', getNonce: () => 'n'.repeat(43), getRevision: () => revision },
  );
  return fetcher;
}
afterEach(() => client?.cancelAll());

it('waits for a click, sends only the trusted reference with CSRF, and renders structured commentary', async () => {
  const fetcher = setup();
  render(<NarrativePanel receipt={receipt} kind="prediction" />);
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'AI nhận xét' }));
  await screen.findByRole('heading', { name: 'Tổng quan' });
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]!.body))).toEqual({ receipt });
  expect(new Headers(fetcher.mock.calls[0]![1]!.headers).get('X-CSRF-Token')).toBe('n'.repeat(43));
  expect(fetcher.mock.calls[0]![1]!.credentials).toBe('same-origin');
  for (const name of ['Điểm đáng chú ý', 'Diễn giải', 'Giới hạn', 'Gợi ý tham khảo'])
    expect(screen.getByRole('heading', { name })).toBeInTheDocument();
  expect(
    screen.getByText(/không chứng minh nhân quả hoặc bảo đảm kết quả tương lai/),
  ).toBeInTheDocument();
});

it('clears old commentary when result, model or context produces a new reference', async () => {
  setup();
  const ui = render(<NarrativePanel receipt={receipt} kind="prediction" />);
  fireEvent.click(screen.getByRole('button', { name: 'AI nhận xét' }));
  await screen.findByRole('heading', { name: 'Tổng quan' });
  ui.rerender(<NarrativePanel receipt={otherReceipt} kind="prediction" />);
  expect(screen.queryByRole('heading', { name: 'Tổng quan' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'AI nhận xét' })).toBeInTheDocument();
});

it('aborts stale requests and does not render a late reply after session/context changes', async () => {
  let resolve!: (response: Response) => void;
  const fetcher = setup(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const ui = render(<NarrativePanel receipt={receipt} kind="prediction" />);
  fireEvent.click(screen.getByRole('button', { name: 'AI nhận xét' }));
  expect(screen.getByRole('button', { name: 'AI đang nhận xét…' })).toBeDisabled();
  revision++;
  ui.rerender(<NarrativePanel receipt={receipt} kind="prediction" />);
  expect(fetcher.mock.calls[0]![1]!.signal?.aborted).toBe(true);
  await act(async () => resolve(response(result())));
  expect(screen.queryByRole('heading', { name: 'Tổng quan' })).not.toBeInTheDocument();
  connected = false;
  ui.rerender(<NarrativePanel receipt={receipt} kind="prediction" />);
  expect(screen.queryByRole('button', { name: 'AI nhận xét' })).not.toBeInTheDocument();
});

it.each([403, 409, 422, 429, 502, 503, 504])(
  'shows safe HTTP %s error and retries only when clicked',
  async (status) => {
    const fetcher = setup(async () =>
      response({ error: { code: 'TEST_ERROR', message: 'private trace' } }, status),
    );
    render(<NarrativePanel receipt={receipt} kind="prediction" />);
    fireEvent.click(screen.getByRole('button', { name: 'AI nhận xét' }));
    await screen.findByRole('alert');
    expect(screen.queryByText(/private trace/)).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại AI nhận xét' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  },
);

it('does not invent commentary without a receipt and rejects another analysis kind', async () => {
  const fetcher = setup(async () => response(result('segmentation')));
  const ui = render(<NarrativePanel kind="prediction" />);
  expect(screen.queryByRole('button', { name: 'AI nhận xét' })).not.toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
  ui.rerender(<NarrativePanel receipt={receipt} kind="prediction" />);
  fireEvent.click(screen.getByRole('button', { name: 'AI nhận xét' }));
  await screen.findByRole('alert');
  expect(screen.queryByRole('heading', { name: 'Tổng quan' })).not.toBeInTheDocument();
});

it('copies actual structured commentary', async () => {
  setup();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<NarrativePanel receipt={receipt} kind="prediction" />);
  fireEvent.click(screen.getByRole('button', { name: 'AI nhận xét' }));
  await screen.findByRole('heading', { name: 'Tổng quan' });
  fireEvent.click(screen.getByRole('button', { name: 'Sao chép nhận xét' }));
  await screen.findByText('Đã sao chép nhận xét');
  expect(writeText).toHaveBeenCalledWith(
    expect.stringContaining('Tổng quan\nKết quả được mô hình'),
  );
});

it.each(['prediction', 'segmentation', 'what_if'] as const)(
  'integrates the button in %s without calling Gemini on load',
  async (kind) => {
    const fetcher = setup(async () => response(result(kind)));
    render(
      <MemoryRouter>
        {kind === 'prediction' ? (
          <PredictionResults
            output={{
              results: [purchaseFixture.rows[0]!.result as Result],
              saved: false,
              narrativeReceipt: receipt,
            }}
          />
        ) : kind === 'segmentation' ? (
          <SegmentResults
            output={{
              results: [segmentFixture.rows[0]!.result as Segment],
              saved: false,
              narrativeReceipt: receipt,
            }}
          />
        ) : (
          <WhatIfResults
            preview={whatIfFixture.rows[0]!.preview as Preview}
            comparison={whatIfFixture.rows[0]!.comparison as Comparison}
            narrativeReceipt={receipt}
          />
        )}
      </MemoryRouter>,
    );
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'AI nhận xét' }));
    await screen.findByRole('heading', { name: 'Tổng quan' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);

it('retains a valid response header in the existing API client metadata', async () => {
  setup();
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(result()), {
      headers: {
        'Content-Type': 'application/json',
        'X-Security-Profile': 'accounts',
        'X-Analysis-Receipt': receipt,
      },
    }),
  );
  const c = new ApiClient(
    '/backend',
    () => null,
    () => {},
    fetcher,
    { credentials: 'same-origin', getNonce: () => 'n'.repeat(43), getRevision: () => 1 },
  );
  const returned = await c.request('post', '/api/v1/assistant/narrative', { body: { receipt } });
  expect(returned.meta.analysisReceipt).toBe(receipt);
});
