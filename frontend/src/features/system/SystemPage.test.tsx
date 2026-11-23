import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import type { components } from '../../api/generated';
import { WorkspaceContext } from '../../app/context';
import { createQueryClient } from '../../api/query';
import { WorkspaceSession } from '../auth/session';
import SystemPage from './SystemPage';

const model: components['schemas']['ModelInfo'] = {
  task: 'classification',
  model_id: 'purchase-level-xgboost',
  model_version: '1.0.0',
  is_default: true,
  serving_mode: 'legacy_default',
  available: true,
  persistence_supported: true,
  artifact_sha256: '0'.repeat(64),
  feature_count: 24,
  features: [],
  input_schema: {},
  label_namespace: 'purchase_level',
  labels: { '0': 'Low', '1': 'Medium', '2': 'High' },
  limitations: ['Synthetic contract fixture, never live customer data'],
};
const ok = (models: components['schemas']['ModelInfo'][] = []) =>
  new Response(JSON.stringify({ contract_version: '1.0.0', models }), {
    headers: { 'Content-Type': 'application/json' },
  });
async function setup(fetcher: typeof fetch) {
  const query = createQueryClient();
  const session = new WorkspaceSession('/backend', () => query.clear(), fetcher);
  await session.connect('local', '');
  render(
    <QueryClientProvider client={query}>
      <WorkspaceContext.Provider value={session}>
        <MemoryRouter>
          <SystemPage />
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
}
it('renders only returned catalog metadata, not fake customer KPIs', async () => {
  await setup(vi.fn<typeof fetch>().mockImplementation(async () => ok([model])));
  expect(await screen.findByRole('heading', { name: 'Mức mua · bản đầy đủ' })).toBeInTheDocument();
  expect(screen.getByText('1.0.0')).toBeInTheDocument();
  expect(screen.getByText('24')).toBeInTheDocument();
});
it('renders an empty catalog without falling back to a model', async () => {
  await setup(vi.fn<typeof fetch>().mockImplementation(async () => ok()));
  expect(await screen.findByText('Chưa có mô hình trong catalog')).toBeInTheDocument();
});
it('renders failed catalog request without raw server details', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(ok())
    .mockResolvedValueOnce(new Response('private error', { status: 503 }));
  await setup(fetcher);
  expect(await screen.findByRole('alert')).not.toHaveTextContent('private error');
  expect(fetcher).toHaveBeenCalledTimes(2);
});
