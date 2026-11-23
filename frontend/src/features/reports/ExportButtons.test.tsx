import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ApiClient } from '../../api/client';
import { ExportButtons } from './ExportButtons';
import { PredictionResults } from '../predictions/PredictionResults';
import { SegmentResults } from '../segmentation/SegmentResults';
import { WhatIfResults } from '../what-if/WhatIfResults';
import type { Result } from '../predictions/prediction';
import type { Segment } from '../segmentation/segmentation';
import type { Preview, Comparison } from '../what-if/whatIf';
import predictionFixture from '../../test/fixtures/t14_predictions.json';
import segmentFixture from '../../test/fixtures/t15_segmentation.json';
import whatIfFixture from '../../test/fixtures/t16_what_if.json';

const receipt = 'r'.repeat(43),
  otherReceipt = 's'.repeat(43);
let revision = 1,
  connected = true;
let client: ApiClient;
const download = vi.fn();
vi.mock('../predictions/csv', () => ({ downloadBlob: (...args: unknown[]) => download(...args) }));
vi.mock('../../app/context', () => ({
  useWorkspace: () => ({
    revision,
    user: { id: 'fixture-user' },
    session: { accountMode: true, client },
    status: connected ? 'connected' : 'disconnected',
    authState: connected ? 'authenticated' : 'anonymous',
    hasCapability: () => connected,
  }),
}));
const success = (format: 'pdf' | 'xlsx' = 'pdf') =>
  new Response(format === 'pdf' ? '%PDF-1.4 TEST-ONLY' : 'PK-TEST-ONLY', {
    headers: {
      'Content-Type':
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="MK-eAI-du-doan-20261104-120000.${format}"`,
      'X-Security-Profile': 'accounts',
    },
  });
function setup(
  respond: (init: RequestInit) => Promise<Response> = async (init) =>
    success(JSON.parse(String(init.body)).format),
) {
  revision = 1;
  connected = true;
  download.mockClear();
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

it.each(['pdf', 'xlsx'] as const)(
  'downloads %s only after click, using reference/session/CSRF',
  async (format) => {
    const fetcher = setup();
    render(<ExportButtons target={{ source: 'preview', receipt }} />);
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: format === 'pdf' ? 'Xuất PDF' : 'Xuất Excel' }),
    );
    await screen.findByText('Đã tải báo cáo.');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const init = fetcher.mock.calls[0]![1]!;
    expect(JSON.parse(String(init.body))).toEqual({
      source: 'preview',
      receipt,
      format,
      include_ai: false,
      include_research: false,
    });
    expect(init.credentials).toBe('same-origin');
    expect(new Headers(init.headers).get('X-CSRF-Token')).toBe('n'.repeat(43));
    expect(new Headers(init.headers).get('Authorization')).toBeNull();
    expect(download).toHaveBeenCalledWith(
      expect.any(Blob),
      `MK-eAI-du-doan-20261104-120000.${format}`,
    );
  },
);

it('sends opt-in flags only, never user-supplied AI text or statistics', async () => {
  const fetcher = setup();
  render(<ExportButtons target={{ source: 'preview', receipt }} research />);
  fireEvent.click(screen.getByLabelText(/Kèm nhận xét AI/));
  fireEvent.click(screen.getByLabelText(/Kèm hồ sơ phân nhóm/));
  fireEvent.click(screen.getByRole('button', { name: 'Xuất Excel' }));
  await screen.findByText('Đã tải báo cáo.');
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]!.body))).toEqual({
    source: 'preview',
    receipt,
    format: 'xlsx',
    include_ai: true,
    include_research: true,
  });
  expect(String(fetcher.mock.calls[0]![0])).toBe('/backend/api/v1/reports/export');
});

it('exports exactly one customer and bounded histories', async () => {
  const fetcher = setup();
  render(
    <ExportButtons
      target={{
        source: 'customer',
        customer_id: '11111111-1111-4111-8111-111111111111',
        limit: 20,
      }}
    />,
  );
  expect(screen.getByText(/tối đa 20 bản ghi/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Xuất PDF' }));
  await screen.findByText('Đã tải báo cáo.');
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]!.body))).toEqual({
    source: 'customer',
    customer_id: '11111111-1111-4111-8111-111111111111',
    limit: 20,
    format: 'pdf',
  });
});

it.each([403, 409, 422, 429, 503])(
  'handles HTTP %s without downloading or leaking errors',
  async (status) => {
    const fetcher = setup(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: status === 409 ? 'REPORT_AI_UNAVAILABLE' : 'REPORT_ERROR',
              message: 'PRIVATE connection credentials',
            },
          }),
          {
            status,
            headers: { 'Content-Type': 'application/json', 'X-Security-Profile': 'accounts' },
          },
        ),
    );
    render(<ExportButtons target={{ source: 'preview', receipt }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Xuất PDF' }));
    await screen.findByRole('alert');
    expect(screen.queryByText(/PRIVATE/)).not.toBeInTheDocument();
    expect(download).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Xuất PDF' })).toBeEnabled();
  },
);

it('does not download a late response after changing context or session', async () => {
  let resolve!: (value: Response) => void;
  const fetcher = setup(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const ui = render(<ExportButtons target={{ source: 'preview', receipt }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Xuất PDF' }));
  expect(screen.getByRole('button', { name: 'Xuất Excel' })).toBeDisabled();
  ui.rerender(<ExportButtons target={{ source: 'preview', receipt: otherReceipt }} />);
  expect(fetcher.mock.calls[0]![1]!.signal?.aborted).toBe(true);
  await act(async () => resolve(success()));
  expect(download).not.toHaveBeenCalled();
  connected = false;
  ui.rerender(<ExportButtons target={{ source: 'preview', receipt: otherReceipt }} />);
  expect(screen.queryByRole('button', { name: 'Xuất PDF' })).not.toBeInTheDocument();
});

it('rejects an unsafe download filename', async () => {
  const fetcher = setup(
    async () =>
      new Response('%PDF-data', {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="../../secret.pdf"',
          'X-Security-Profile': 'accounts',
        },
      }),
  );
  render(<ExportButtons target={{ source: 'preview', receipt }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Xuất PDF' }));
  await screen.findByRole('alert');
  expect(download).not.toHaveBeenCalled();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('shows a safe network error without downloading or retrying automatically', async () => {
  const fetcher = setup(async () => {
    throw new Error('private server endpoint');
  });
  render(<ExportButtons target={{ source: 'preview', receipt }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Xuất PDF' }));
  await screen.findByRole('alert');
  expect(screen.queryByText(/private server/)).not.toBeInTheDocument();
  expect(download).not.toHaveBeenCalled();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('uses the existing unauthorized flow on HTTP 401', async () => {
  setup(
    async () =>
      new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'X-Security-Profile': 'accounts' },
      }),
  );
  await expect(
    client.requestReport({ source: 'preview', receipt, format: 'pdf' }),
  ).rejects.toMatchObject({ status: 401 });
  expect(connected).toBe(false);
  expect(download).not.toHaveBeenCalled();
});

it('without a verified result does not expose export or produce fake files', () => {
  const fetcher = setup();
  render(<ExportButtons />);
  expect(screen.queryByRole('button', { name: 'Xuất PDF' })).not.toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
});

it.each(['prediction', 'segmentation', 'what_if'] as const)(
  'adds export actions to %s without changing existing output or auto-downloading',
  async (kind) => {
    const fetcher = setup();
    render(
      <MemoryRouter>
        {kind === 'prediction' ? (
          <PredictionResults
            output={{
              results: [predictionFixture.rows[0]!.result as Result],
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
    expect(screen.getByRole('button', { name: 'AI nhận xét' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xuất PDF' }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
  },
);

it('exports the churn watchlist by risk levels only; the server recomputes the list', async () => {
  const fetcher = setup(
    async () =>
      new Response('PK-TEST-ONLY', {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition':
            'attachment; filename="MK-eAI-khach-hang-can-giu-chan-20261116-090000.xlsx"',
          'X-Security-Profile': 'accounts',
        },
      }),
  );
  render(<ExportButtons target={{ source: 'churn_watchlist', risk_levels: ['high', 'medium'] }} />);
  expect(screen.getByText(/Máy chủ tính lại danh sách/)).toBeInTheDocument();
  expect(screen.queryByText('Tùy chọn báo cáo')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Xuất Excel' }));
  await screen.findByText('Đã tải báo cáo.');
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]!.body))).toEqual({
    source: 'churn_watchlist',
    risk_levels: ['high', 'medium'],
    format: 'xlsx',
  });
  expect(String(fetcher.mock.calls[0]![0])).toBe('/backend/api/v1/reports/export');
  expect(download.mock.calls[0]![1]).toBe('MK-eAI-khach-hang-can-giu-chan-20261116-090000.xlsx');
});
