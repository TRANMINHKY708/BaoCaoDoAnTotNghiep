import type { Result } from './prediction';
type Feature = { feature_name: string; feature_value: number | null; shap_value: number };
export type Explanation = {
  method: 'xgboost_native_exact_treeshap';
  explanation_scope: 'local';
  model_id: string;
  model_version: string;
  artifact_sha256: string;
  input_source: 'request_payload';
  feature_space: 'preprocessed';
  predicted_class: number;
  purchase_level: string;
  output_space: 'raw_margin';
  base_value: number;
  model_output: number;
  additivity_error: number;
  features: Feature[];
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export function readExplanation(
  value: unknown,
  prediction: Result,
  artifact?: string,
): Explanation | null {
  if (
    !object(value) ||
    value.method !== 'xgboost_native_exact_treeshap' ||
    value.explanation_scope !== 'local' ||
    value.output_space !== 'raw_margin' ||
    value.feature_space !== 'preprocessed' ||
    value.input_source !== 'request_payload' ||
    value.model_id !== prediction.model_id ||
    value.model_version !== prediction.model_version ||
    value.predicted_class !== prediction.predicted_class ||
    value.purchase_level !== prediction.purchase_level ||
    typeof value.artifact_sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.artifact_sha256) ||
    (artifact !== undefined && value.artifact_sha256 !== artifact) ||
    !finite(value.base_value) ||
    !finite(value.model_output) ||
    !finite(value.additivity_error) ||
    !Array.isArray(value.features) ||
    value.features.length === 0
  )
    return null;
  const names = new Set<string>();
  let sum = value.base_value;
  for (const f of value.features) {
    if (
      !object(f) ||
      typeof f.feature_name !== 'string' ||
      !f.feature_name ||
      names.has(f.feature_name) ||
      !finite(f.shap_value) ||
      !(f.feature_value === null || finite(f.feature_value))
    )
      return null;
    names.add(f.feature_name);
    sum += f.shap_value;
  }
  const tolerance = 1e-5 + 1e-5 * Math.abs(value.model_output);
  if (
    Math.abs(sum - value.model_output) > tolerance ||
    Math.abs(sum - value.model_output - value.additivity_error) > tolerance
  )
    return null;
  return value as unknown as Explanation;
}
