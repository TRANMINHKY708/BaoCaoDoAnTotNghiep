import type { Model } from '../predictions/prediction';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import fixture from '../../test/fixtures/t15_segmentation.json';
import { createQueryClient } from '../../api/query';
import { WorkspaceContext } from '../../app/context';
import { WorkspaceSession } from '../auth/session';
import { segmentSpec } from './segmentation';
import { ResearchProfiles, ProfileView } from './ResearchProfiles';
import { verifyProfiles, type Profiles } from './profiles';
const spec = segmentSpec(fixture.catalog.models.find((m) => m.model_version === '1.0.0')! as Model);
function data(): Profiles {
  const stat = (mean: number | null, n: number) =>
    Object.fromEntries(spec.features.map((f) => [f.name, { mean, observed_count: n }]));
  return {
    source: 'cleaned_research_dataset',
    source_name: 'research-only.csv',
    model_id: spec.model.model_id,
    model_version: spec.model.model_version,
    artifact_sha256: spec.model.artifact_sha256,
    dataset_sha256: 'a'.repeat(64),
    computed_at: '2026-11-04T00:00:00Z',
    total_records: 5,
    records_used: 5,
    actual_cluster_count: 3,
    configured_cluster_count: 3,
    status: 'sufficient_for_descriptive_statistics',
    minimum_observed_per_mean: 2,
    count_unit: 'research_records_not_unique_application_customers',
    statistics_space: 'original_units_validity_cleaned_before_imputation_clipping_scaling',
    feature_names: spec.features.map((f) => f.name),
    overall: stat(4, 5),
    disclaimer: 'Nghiên cứu mô tả; không chứng minh nhân quả.',
    clusters: [
      {
        cluster_id: 0,
        record_count: 2,
        share_percent: 40,
        status: 'sufficient_for_descriptive_statistics',
        features: stat(2, 2),
        notable_features: [
          {
            feature: spec.features[0]!.name,
            cluster_mean: 2,
            overall_mean: 4,
            difference: -2,
            standardized_difference: -1,
          },
        ],
      },
      {
        cluster_id: 1,
        record_count: 2,
        share_percent: 40,
        status: 'sufficient_for_descriptive_statistics',
        features: stat(6, 2),
        notable_features: [],
      },
      {
        cluster_id: 2,
        record_count: 1,
        share_percent: 20,
        status: 'insufficient_data',
        features: stat(null, 1),
        notable_features: [],
      },
    ],
  };
}
it('validates source, model, totals and refuses mixed or malformed data', () => {
  expect(verifyProfiles(data(), spec).total_records).toBe(5);
  for (const d of [
    { ...data(), source: 'postgresql' },
    { ...data(), records_used: 99 },
    { ...data(), model_version: 'wrong' },
    { ...data(), total_records: 10 },
    { ...data(), actual_cluster_count: 2 },
  ])
    expect(() => verifyProfiles(d, spec)).toThrow();
});
it('renders real response counts/source/original means and neutral cluster comparison', () => {
  render(<ProfileView data={data()} />);
  expect(screen.getByText('5 bản ghi', { selector: 'strong' })).toBeInTheDocument();
  expect(screen.getByText(/research-only.csv/)).toHaveTextContent('1.0.0');
  expect(screen.getByRole('region', { name: 'Bảng so sánh trung bình các cụm' })).toHaveTextContent(
    'n=5',
  );
  expect(screen.getByText(/trước tiền xử lý/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('So sánh đặc trưng nổi bật của cụm'), {
    target: { value: '2' },
  });
  expect(screen.getByText(/Không đủ quan sát hoặc không có chênh lệch/)).toBeInTheDocument();
});
it('renders insufficient data rather than a one-record population profile', () => {
  render(
    <ProfileView
      data={{ ...data(), status: 'insufficient_data', total_records: 1, records_used: 1 }}
    />,
  );
  expect(screen.getByText('Không đủ dữ liệu để tạo hồ sơ')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
async function setup(fail = false) {
  const query = createQueryClient();
  let resolve: ((r: Response) => void) | undefined;
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
    if (String(input).includes('research_profiles=true'))
      return new Promise<Response>((r) => {
        resolve = r;
      });
    return new Response(JSON.stringify(fixture.catalog), {
      headers: { 'Content-Type': 'application/json' },
    });
  });
  const session = new WorkspaceSession('/backend', () => query.clear(), fetcher);
  await session.connect('local', '');
  const wrapper = (selected = spec) => (
    <QueryClientProvider client={query}>
      <WorkspaceContext.Provider value={session}>
        <ResearchProfiles key={selected.model.model_version} spec={selected} />
      </WorkspaceContext.Provider>
    </QueryClientProvider>
  );
  const view = render(wrapper());
  fireEvent.click(screen.getByRole('button', { name: 'Phân tích dataset nghiên cứu' }));
  await waitFor(() => expect(resolve).toBeDefined());
  return {
    view,
    wrapper,
    complete: () =>
      resolve!(
        new Response(JSON.stringify(fail ? {} : data()), {
          status: fail ? 503 : 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
  };
}
it('loads explicitly, shows loading, and clears old scope on model change', async () => {
  const h = await setup();
  expect(screen.getByText('Đang phân nhóm dataset và tính hồ sơ…')).toBeInTheDocument();
  h.complete();
  await screen.findByText(/research-only.csv/);
  const next = segmentSpec(
    fixture.catalog.models.find((m) => m.model_version === '2.0.0-snapshot-k3')! as Model,
  );
  h.view.rerender(h.wrapper(next));
  expect(screen.queryByText(/research-only.csv/)).not.toBeInTheDocument();
  expect(screen.getByText('Chưa phân tích dữ liệu nghiên cứu')).toBeInTheDocument();
});
it('shows API errors as errors rather than zeros or empty population', async () => {
  const h = await setup(true);
  h.complete();
  await screen.findByText('Chưa thể hoàn thành yêu cầu');
  expect(screen.queryByText('Không đủ dữ liệu để tạo hồ sơ')).not.toBeInTheDocument();
});
