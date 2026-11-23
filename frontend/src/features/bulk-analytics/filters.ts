import type { BatchFilters } from './types';
import { isCustomerId } from '../customers/customers';

export const initialDraft = {
  import_job_id: '',
  analysis_job_id: '',
  classification_model: '1.0.0||',
  segmentation_model: '1.0.0||',
  date_from: '',
  date_to: '',
  purchase_level: '',
  cluster: '',
  customer_query: '',
};
export type Draft = typeof initialDraft;
export function filterRequest(draft: Draft): BatchFilters {
  for (const key of ['import_job_id', 'analysis_job_id'] as const)
    if (draft[key] && !isCustomerId(draft[key])) throw new Error('Mã lô hoặc tác vụ không hợp lệ.');
  if (
    !['', 'Low', 'Medium', 'High'].includes(draft.purchase_level) ||
    !['', '0', '1', '2'].includes(draft.cluster)
  )
    throw new Error('Mức mua hoặc cluster không hợp lệ.');
  if (
    draft.customer_query.length > 100 ||
    [...draft.customer_query].some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    throw new Error('Mã tìm kiếm tối đa 100 ký tự, không chứa ký tự điều khiển.');
  if (!!draft.date_from !== !!draft.date_to)
    throw new Error('Cần chọn cả ngày bắt đầu và kết thúc.');
  const out: BatchFilters = {
    import_job_id: draft.import_job_id.toLowerCase() || null,
    analysis_job_id: draft.analysis_job_id.toLowerCase() || null,
    customer_query: draft.customer_query.trim() || null,
    purchase_level: draft.purchase_level || null,
    cluster: draft.cluster === '' ? null : Number(draft.cluster),
  };
  for (const task of ['classification', 'segmentation'] as const) {
    const [version, artifact, metadata] = draft[`${task}_model`].split('|');
    const versions =
      task === 'classification'
        ? ['1.0.0', '2.0.0-snapshot-conservative12']
        : ['1.0.0', '2.0.0-snapshot-k3'];
    if (
      draft[`${task}_model`].split('|').length !== 3 ||
      !versions.includes(version!) ||
      !!artifact !== !!metadata ||
      (artifact && (!/^[a-f0-9]{64}$/.test(artifact) || !/^[a-f0-9]{64}$/.test(metadata!)))
    )
      throw new Error('Danh tính mô hình không hợp lệ; cần đúng phiên bản và cặp checksum.');
    out[`${task}_version`] = version;
    out[`${task}_artifact`] = artifact || null;
    out[`${task}_metadata`] = metadata || null;
  }
  if (draft.date_from && draft.date_to) {
    for (const day of [draft.date_from, draft.date_to]) {
      const time = Date.parse(`${day}T00:00:00Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
        !Number.isFinite(time) ||
        new Date(time).toISOString().slice(0, 10) !== day
      )
        throw new Error('Ngày không hợp lệ.');
    }
    const from = new Date(`${draft.date_from}T00:00:00+07:00`);
    const to = new Date(new Date(`${draft.date_to}T00:00:00+07:00`).getTime() + 86400000);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to)
      throw new Error('Khoảng ngày không hợp lệ.');
    out.date_from = from.toISOString();
    out.date_to = to.toISOString();
  }
  return out;
}
