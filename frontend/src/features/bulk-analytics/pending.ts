import type { AnalysisJob } from '../bulk/analysisTypes';
import type { ImportJob } from '../bulk/importTypes';

/** A lot counts on this page only once a completed, saved analysis with the default model exists. */
export const analyzed = (jobs: AnalysisJob[]) =>
  jobs.some((j) => j.status === 'completed' && j.persist_results && j.model_version === '1.0.0');

export async function pendingLots(
  imports: ImportJob[],
  analyses: (id: string) => Promise<AnalysisJob[]>,
): Promise<ImportJob[]> {
  const done = imports.filter((job) => job.status === 'completed');
  const pending: ImportJob[] = [];
  for (const job of done) if (!analyzed(await analyses(job.job_id))) pending.push(job);
  return pending;
}
