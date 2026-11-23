import type { components } from '../../api/generated';
import { ApiError } from '../../api/errors';
import { InputError } from '../predictions/prediction';
import { isCustomerId } from '../customers/customers';

type S = components['schemas'];
export type Schema = S['WhatIfSchemaResponse'];
export type Model = S['WhatIfModelDescriptor'];
export type Models = S['WhatIfModelSelection'];
export type Preview = S['WhatIfPreviewResponse'];
export type Comparison = S['WhatIfComparisonResponse'];
export type Saved = S['WhatIfSavedScenarioDetail'];
export type History = S['WhatIfHistoryPage'];
export type Request = S['WhatIfPreviewRequest'];
export type SaveBody = S['WhatIfSaveRequest'];
export const CONTRACT = 'what-if-snapshot-v1' as const;
export const CLASSES = ['Low', 'Medium', 'High'] as const;
export const MUTABLE = [
  'Login_Frequency',
  'Session_Duration_Avg',
  'Pages_Per_Session',
  'Wishlist_Items',
  'Email_Open_Rate',
  'Mobile_App_Usage',
] as const;
export const DISCLAIMER =
  'Đây là mô phỏng phản ứng của mô hình AI khi thay đổi dữ liệu đầu vào. Kết quả không chứng minh quan hệ nhân quả và không phải dự báo chắc chắn hành vi mua hàng trong tương lai.';
export type Mutable = (typeof MUTABLE)[number];
export type Changes = Partial<Record<Mutable, number>>;
const HASH = /^[a-f0-9]{64}$/;
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
const same = (a: unknown, b: unknown) => equal(canonical(a), canonical(b));
const check = (ok: unknown) => {
  if (!ok) throw new ApiError('protocol');
};
const keysEqual = (a: object, b: object) => equal(Object.keys(a).sort(), Object.keys(b).sort());
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const utc = (v: string) =>
  typeof v === 'string' && /(?:Z|\+00:00)$/.test(v) && Number.isFinite(Date.parse(v));
function guard<T>(work: () => T): T {
  try {
    return work();
  } catch {
    throw new ApiError('protocol');
  }
}
export const selected = (schema: Schema, models: Models) => [
  schema.models.find(
    (m) => m.task === 'classification' && m.model_version === models.classification,
  )!,
  ...(models.segmentation
    ? [
        schema.models.find(
          (m) => m.task === 'segmentation' && m.model_version === models.segmentation,
        )!,
      ]
    : []),
];
export function checkedSchema(value: unknown): Schema {
  return guard(() => {
    const s = value as Schema;
    check(
      s.contract_version === CONTRACT &&
        s.scope === 'snapshot_input_sensitivity_not_causal_or_future',
    );
    check(
      equal([...s.mutable_features].sort(), [...MUTABLE].sort()) &&
        s.limits.body_bytes === 65536 &&
        s.limits.changes === 6,
    );
    check(s.models.length === 4);
    for (const [task, version, count] of [
      ['classification', '1.0.0', 24],
      ['classification', '2.0.0-snapshot-conservative12', 12],
      ['segmentation', '1.0.0', 10],
      ['segmentation', '2.0.0-snapshot-k3', 10],
    ] as const) {
      const models = s.models.filter((m) => m.task === task && m.model_version === version);
      check(models.length === 1);
      const m = models[0]!;
      check(
        m.model_id ===
          (task === 'classification' ? 'purchase-level-xgboost' : 'customer-segmentation-kmeans'),
      );
      check(
        HASH.test(m.artifact_sha256) &&
          HASH.test(m.metadata_sha256) &&
          m.feature_count === count &&
          m.features.length === count,
      );
      check(new Set(m.features.map((f) => f.name)).size === count);
      check(m.features.every((f) => f.mutable === MUTABLE.includes(f.name as Mutable)));
      if (task === 'classification') {
        check(
          MUTABLE.every((name) =>
            m.features.some(
              (f) =>
                f.name === name &&
                f.type === 'number' &&
                f.minimum === 0 &&
                (name !== 'Email_Open_Rate' || f.maximum === 100),
            ),
          ),
        );
      }
      check(m.persistence_supported === (version === '1.0.0'));
    }
    return s;
  });
}
type Identity = S['WhatIfModelIdentity'];
function identity(pin: Identity, task: string, model?: Model) {
  check(
    pin.validation_policy === CONTRACT &&
      HASH.test(pin.artifact_sha256) &&
      HASH.test(pin.metadata_sha256),
  );
  check(
    pin.model_id ===
      (task === 'classification' ? 'purchase-level-xgboost' : 'customer-segmentation-kmeans'),
  );
  check(
    [
      '1.0.0',
      task === 'classification' ? '2.0.0-snapshot-conservative12' : '2.0.0-snapshot-k3',
    ].includes(pin.model_version),
  );
  if (model)
    check(
      pin.model_id === model.model_id &&
        pin.model_version === model.model_version &&
        pin.artifact_sha256 === model.artifact_sha256 &&
        pin.metadata_sha256 === model.metadata_sha256,
    );
}
const samePin = (a: Identity, b: Identity) =>
  ['model_id', 'model_version', 'artifact_sha256', 'metadata_sha256', 'validation_policy'].every(
    (k) => a[k as keyof Identity] === b[k as keyof Identity],
  );
function outcome(value: Preview['classification'], model?: Model) {
  identity(value.model, 'classification', model);
  check(
    value.task === 'classification' &&
      Number.isInteger(value.predicted_class) &&
      value.purchase_level === CLASSES[value.predicted_class],
  );
  check(
    value.decision_rule === 'argmax_probability' &&
      value.target_thresholds.low_inclusive === 10 &&
      value.target_thresholds.medium_inclusive === 15,
  );
  check(keysEqual(value.probabilities, { Low: 0, Medium: 0, High: 0 }));
  check(
    CLASSES.every(
      (c) =>
        finite(value.probabilities[c]) &&
        value.probabilities[c] >= 0 &&
        value.probabilities[c] <= 1,
    ),
  );
  check(Math.abs(CLASSES.reduce((sum, c) => sum + value.probabilities[c], 0) - 1) <= 1e-6);
  check(
    CLASSES.reduce((a, b) => (value.probabilities[b] > value.probabilities[a] ? b : a)) ===
      value.purchase_level,
  );
}
function segment(value: NonNullable<Preview['segmentation']>, model?: Model) {
  identity(value.model, 'segmentation', model);
  check(
    value.task === 'segmentation' &&
      Number.isInteger(value.cluster) &&
      value.cluster >= 0 &&
      value.cluster <= 2,
  );
  check(
    value.segment_id ===
      (value.model.model_version === '1.0.0'
        ? `legacy:1.0.0:cluster:${value.cluster}`
        : ['engagement_low', 'engagement_medium', 'engagement_high'][value.cluster]),
  );
  check(
    typeof value.segment_name === 'string' &&
      value.segment_name.length > 0 &&
      value.segment_name.length < 201,
  );
  if (model) check(value.segment_name === model.labels[String(value.cluster)]);
  check(
    finite(value.distance_to_centroid) &&
      value.distance_to_centroid >= 0 &&
      value.distance_kind === 'standardized_euclidean_not_probability',
  );
}
export function checkedPreview(value: unknown, schema?: Schema, request?: Request): Preview {
  return guard(() => {
    const p = value as Preview;
    check(
      p.contract_version === CONTRACT &&
        p.persisted === false &&
        HASH.test(p.baseline_fingerprint) &&
        utc(p.generated_at),
    );
    check(p.scope === 'snapshot_input_sensitivity_not_causal_or_future');
    const models = request && schema ? selected(schema, request.models) : undefined;
    outcome(p.classification, models?.[0]);
    if (p.segmentation) segment(p.segmentation, models?.[1]);
    if (request) check(!!p.segmentation === !!request.models.segmentation);
    if (request?.baseline.kind === 'customer')
      check(
        p.resolved_customer_id === request.baseline.customer_id &&
          p.resolved_snapshot_id === request.baseline.snapshot_id,
      );
    if (p.resolved_customer_id !== null)
      check(isCustomerId(p.resolved_customer_id) && isCustomerId(p.resolved_snapshot_id!));
    else check(p.resolved_snapshot_id === null);
    check(
      Object.values(p.baseline_input).every(
        (v) => v === null || typeof v === 'string' || finite(v),
      ),
    );
    if (models) {
      const names = new Set(models.flatMap((m) => m.features.map((f) => f.name)));
      check(
        Object.keys(p.baseline_input).length === names.size &&
          Object.keys(p.baseline_input).every((n) => names.has(n)),
      );
    }
    check(Array.isArray(p.warnings));
    return p;
  });
}
export function checkedComparison(
  value: unknown,
  schema?: Schema,
  request?: Request,
  preview?: Preview,
  changes?: Changes,
): Comparison {
  return guard(() => {
    const c = value as Comparison,
      b = checkedPreview(c.baseline, schema, request);
    check(
      c.contract_version === CONTRACT &&
        c.persisted === false &&
        HASH.test(c.comparison_fingerprint),
    );
    if (preview)
      check(
        b.baseline_fingerprint === preview.baseline_fingerprint &&
          keysEqual(b.baseline_input, preview.baseline_input) &&
          Object.keys(b.baseline_input).every(
            (n) => b.baseline_input[n] === preview.baseline_input[n],
          ),
      );
    outcome(c.scenario_classification);
    check(
      samePin(b.classification.model, c.scenario_classification.model) &&
        c.classification_label_changed ===
          (b.classification.purchase_level !== c.scenario_classification.purchase_level),
    );
    check(!!b.segmentation === !!c.scenario_segmentation);
    if (b.segmentation && c.scenario_segmentation) {
      segment(c.scenario_segmentation);
      check(samePin(b.segmentation.model, c.scenario_segmentation.model));
    }
    check(keysEqual(b.baseline_input, c.scenario_input));
    const different = Object.keys(c.scenario_input).filter(
      (n) => c.scenario_input[n] !== b.baseline_input[n],
    );
    check(
      Array.isArray(c.changed_fields) &&
        c.changed_fields.length === different.length &&
        new Set(c.changed_fields.map((f) => f.feature)).size === different.length,
    );
    check(
      c.changed_fields.every(
        (f) =>
          MUTABLE.includes(f.feature) &&
          different.includes(f.feature) &&
          f.before === b.baseline_input[f.feature] &&
          f.after === c.scenario_input[f.feature] &&
          finite(f.after) &&
          f.after >= 0 &&
          (f.feature !== 'Email_Open_Rate' || f.after <= 100),
      ),
    );
    if (changes)
      check(
        Object.keys(c.scenario_input).every(
          (n) =>
            c.scenario_input[n] === (n in changes ? changes[n as Mutable] : b.baseline_input[n]),
        ),
      );
    for (const cls of CLASSES) {
      const delta =
        c.scenario_classification.probabilities[cls] - b.classification.probabilities[cls];
      check(
        finite(c.probability_deltas.absolute[cls]) &&
          Math.abs(c.probability_deltas.absolute[cls]! - delta) < 1e-9,
      );
      check(
        finite(c.probability_deltas.percentage_points[cls]) &&
          Math.abs(c.probability_deltas.percentage_points[cls]! - delta * 100) < 1e-7,
      );
    }
    return c;
  });
}
export function checkedSaved(value: unknown, expected?: Comparison): Saved {
  return guard(() => {
    const d = value as Saved;
    check(
      d.contract_version === CONTRACT &&
        d.persisted === true &&
        d.integrity_status === 'verified' &&
        isCustomerId(d.scenario_id) &&
        utc(d.created_at),
    );
    const c = checkedComparison(d.comparison);
    check(
      c.baseline.classification.model.model_version === '1.0.0' &&
        (!c.baseline.segmentation || c.baseline.segmentation.model.model_version === '1.0.0'),
    );
    if (expected) {
      check(
        c.comparison_fingerprint === expected.comparison_fingerprint &&
          c.baseline.baseline_fingerprint === expected.baseline.baseline_fingerprint,
      );
      for (const key of [
        'scenario_input',
        'scenario_classification',
        'scenario_segmentation',
        'changed_fields',
        'probability_deltas',
      ] as const)
        check(same(c[key], expected[key]));
      for (const key of [
        'baseline_input',
        'classification',
        'segmentation',
        'resolved_customer_id',
        'resolved_snapshot_id',
      ] as const)
        check(same(c.baseline[key], expected.baseline[key]));
    }
    check(
      typeof d.name === 'string' &&
        Array.isArray(d.results) &&
        d.results.length === (c.baseline.segmentation ? 2 : 1),
    );
    check(new Set(d.results.map((r) => r.task)).size === d.results.length);
    check(
      d.results.every(
        (r) =>
          isCustomerId(r.scenario_result_id) &&
          isCustomerId(r.model_registry_id) &&
          samePin(
            r.model_identity,
            r.task === 'classification'
              ? c.baseline.classification.model
              : c.baseline.segmentation!.model,
          ),
      ),
    );
    check(
      d.original_customer_id === c.baseline.resolved_customer_id &&
        d.original_snapshot_id === c.baseline.resolved_snapshot_id,
    );
    check(
      (d.current_customer_id === null || d.current_customer_id === d.original_customer_id) &&
        (d.current_snapshot_id === null || d.current_snapshot_id === d.original_snapshot_id),
    );
    check(
      d.source_link_status ===
        (d.original_customer_id === null
          ? 'features_only'
          : d.current_customer_id === d.original_customer_id &&
              d.current_snapshot_id === d.original_snapshot_id
            ? 'attached'
            : 'detached'),
    );
    return d;
  });
}
export function checkedHistory(value: unknown): History {
  return guard(() => {
    const p = value as History;
    check(
      Number.isSafeInteger(p.total) &&
        p.total >= 0 &&
        Number.isSafeInteger(p.offset) &&
        p.offset >= 0 &&
        p.limit >= 1 &&
        p.limit <= 100 &&
        Array.isArray(p.items) &&
        p.items.length <= p.limit &&
        p.items.length <= p.total,
    );
    check(
      p.items.every(
        (r) =>
          isCustomerId(r.scenario_id) &&
          utc(r.created_at) &&
          typeof r.name === 'string' &&
          r.scope === 'snapshot_input_sensitivity_not_causal_or_future' &&
          (r.baseline_label === null || CLASSES.includes(r.baseline_label)) &&
          (r.scenario_label === null || CLASSES.includes(r.scenario_label)) &&
          (r.integrity_status === 'verified' ||
            (r.integrity_status === 'unverified' &&
              r.models === null &&
              r.baseline_label === null &&
              r.scenario_label === null &&
              r.classification_label_changed === null)),
      ),
    );
    return p;
  });
}
export function parseChanges(
  draft: Partial<Record<Mutable, string>>,
  enabled: ReadonlySet<Mutable>,
  model: Model,
): Changes {
  const result: Changes = {};
  for (const name of enabled) {
    const descriptor = model.features.find((f) => f.name === name),
      raw = draft[name]?.trim() ?? '';
    if (
      !MUTABLE.includes(name) ||
      !descriptor?.mutable ||
      !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)
    )
      throw new InputError([
        { field: name, message: 'Nhập số hữu hạn đúng định dạng cho biến được phép.' },
      ]);
    const number = Number(raw);
    if (
      !Number.isFinite(number) ||
      number < Math.max(0, descriptor.minimum ?? 0) ||
      (descriptor.maximum !== null && number > descriptor.maximum) ||
      (name === 'Email_Open_Rate' && number > 100)
    )
      throw new InputError([
        {
          field: name,
          message: 'Giá trị ngoài giới hạn cho phép; Email_Open_Rate phải từ 0 đến 100.',
        },
      ]);
    result[name] = number;
  }
  return result;
}
export function bodyLimit<T>(body: T): T {
  if (new TextEncoder().encode(JSON.stringify(body)).byteLength > 65536)
    throw new InputError([{ message: 'What-if chỉ nhận tối đa 64 KiB JSON.' }]);
  return body;
}
export const canPersist = (schema: Schema, models: Models) =>
  selected(schema, models).every((m) => m.persistence_supported && m.model_version === '1.0.0');
export const warnings: Record<string, string> = {
  SNAPSHOT_ONLY: 'Chỉ mô tả dữ liệu hiện có.',
  NON_CAUSAL: 'Không chứng minh quan hệ nhân quả.',
  AVAILABILITY_UNKNOWN: 'Chưa xác minh đầy đủ thời điểm dữ liệu có sẵn.',
  PLAUSIBILITY_NOT_VERIFIED: 'Tính khả thi nghiệp vụ của thay đổi chưa được xác minh.',
  LEGACY_PROXY_FEATURES_UNVERIFIED:
    'Phiên bản đầy đủ có một số chỉ số tổng hợp chưa được xác minh thời điểm ghi nhận.',
  BASELINE_IMPUTED: 'Dữ liệu ban đầu có giá trị thiếu đã được mô hình xử lý.',
  SUPPORT_RANGE_UNKNOWN: 'Chưa xác minh đầy đủ khoảng giá trị tham chiếu của mọi chỉ số.',
  UNKNOWN_CATEGORY: 'Có giá trị phân loại chưa xuất hiện trong dữ liệu huấn luyện.',
  OUTSIDE_TRAINING_SUPPORT: 'Có chỉ số nằm ngoài khoảng tham chiếu đã được cung cấp.',
  RELATIVE_DELTA_UNDEFINED: 'Không tính được một số chênh lệch tương đối vì giá trị ban đầu gần 0.',
  NO_INPUT_CHANGE: 'Không có thay đổi đầu vào thực sự.',
};
