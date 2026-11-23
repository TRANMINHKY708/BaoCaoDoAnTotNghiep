import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { WorkspaceContext } from '../../app/context';
import { createQueryClient } from '../../api/query';
import ConnectPage from './ConnectPage';
import { WorkspaceSession } from './session';

function setup(fetcher: typeof fetch) {
  const query = createQueryClient();
  const session = new WorkspaceSession('/backend', () => query.clear(), fetcher);
  render(
    <QueryClientProvider client={query}>
      <WorkspaceContext.Provider value={session}>
        <MemoryRouter>
          <ConnectPage />
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
  return session;
}

it('submits a temporary token, clears the input and displays verified role', async () => {
  const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify({ contract_version: '1.0.0', models: [] }), {
      headers: {
        'Content-Type': 'application/json',
        'X-Security-Profile': 'secured',
        'X-Workspace-Role': 'viewer',
      },
    }),
  );
  setup(fetcher);
  const user = userEvent.setup();
  const input = screen.getByLabelText('Mã kết nối');
  expect(input).toHaveAttribute('type', 'password');
  await user.type(input, token);
  await user.click(screen.getByRole('button', { name: 'Kết nối không gian làm việc' }));
  expect(await screen.findByText('Quyền xem')).toBeInTheDocument();
  expect(screen.queryByDisplayValue(token)).not.toBeInTheDocument();
  expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe(
    'Bearer ' + token,
  );
  await user.click(screen.getByRole('button', { name: 'Ngắt kết nối' }));
  expect(screen.getByLabelText('Mã kết nối')).toHaveValue('');
});

it('requires explicit local mode and never grants a verified role for local', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify({ contract_version: '1.0.0', models: [] }), {
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  const session = setup(fetcher);
  const user = userEvent.setup();
  await user.click(screen.getByRole('radio', { name: /Trên máy này/ }));
  await user.click(screen.getByRole('button', { name: 'Kết nối không gian làm việc' }));
  expect(await screen.findByText('Kết nối trên máy · không xác thực')).toBeInTheDocument();
  expect(session.getSnapshot().role).toBeNull();
  expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).has('Authorization')).toBe(false);
});

it('does not display server input on failed connection', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'private-do-not-render' } }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  setup(fetcher);
  const user = userEvent.setup();
  const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
  await user.type(screen.getByLabelText('Mã kết nối'), token);
  await user.click(screen.getByRole('button', { name: 'Kết nối không gian làm việc' }));
  expect(await screen.findByRole('alert')).not.toHaveTextContent('private-do-not-render');
  expect(screen.getByLabelText('Mã kết nối')).toHaveValue('');
});
