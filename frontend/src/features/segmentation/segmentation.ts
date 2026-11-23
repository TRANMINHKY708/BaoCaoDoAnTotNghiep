import type { components } from '../../api/generated';
import { ApiError } from '../../api/errors';
import { object, type Spec, type Model } from '../predictions/prediction';
import { parseCsv } from '../predictions/csv';

export const VERSIONS = ['1.0.0', '2.0.0-snapshot-k3'] as const;
export type Version = (typeof VERSIONS)[number];
export type Segment = components['schemas']['SegmentResponse'];
export type Distribution = components['schemas']['SegmentsResponse'];
export const FEATURES = [
  'Login_Frequency',
  'Session_Duration_Avg',
  'Pages_Per_Session',
  'Cart_Abandonment_Rate',
  'Wishlist_Items',
  'Total_Purchases',
  'Average_Order_Value',
  'Days_Since_Last_Purchase',
  'Discount_Usage_Rate',
  'Mobile_App_Usage',
];
const IDS = ['engagement_low', 'engagement_medium', 'engagement_high'];
export function segmentId(version: string, cluster: number) {
  return version === '1.0.0' ? `legacy:1.0.0:cluster:${cluster}` : IDS[cluster]!;
}
export function segmentSpec(model: Model): Spec {
  const schema = model.input_schema;
  if (
    model.task !== 'segmentation' ||
    model.model_id !== 'customer-segmentation-kmeans' ||
    !VERSIONS.includes(model.model_version as Version) ||
    model.feature_count !== 10 ||
    model.features.length !== 10 ||
    new Set(model.features).size !== 10 ||
    model.features.some((f) => !FEATURES.includes(f)) ||
    !object(schema.properties) ||
    Object.keys(schema.properties).length !== 10 ||
    !Array.isArray(schema.required) ||
    schema.required.length !== 10 ||
    schema.additionalProperties !== false ||
    model.label_namespace !==
      (model.model_version === '1.0.0' ? 'legacy_clusters_v1' : 'engagement_snapshot_v2')
  )
    throw new ApiError('protocol');
  return {
    model,
    features: model.features.map((name) => {
      const raw = (schema.properties as Record<string, unknown>)[name];
      if (!object(raw) || !(schema.required as unknown[]).includes(name))
        throw new ApiError('protocol');
      const variants = Array.isArray(raw.anyOf) ? raw.anyOf.filter(object) : [raw],
        prop = variants.find((p) => p.type === 'number');
      if (!prop) throw new ApiError('protocol');
      const rate = ['Cart_Abandonment_Rate', 'Discount_Usage_Rate'].includes(name);
      return {
        name,
        kind: 'number',
        nullable: variants.some((p) => p.type === 'null'),
        min: typeof prop.minimum === 'number' ? prop.minimum : !rate ? 0 : undefined,
        max: typeof prop.maximum === 'number' ? prop.maximum : undefined,
      };
    }),
  };
}
export function verifySegment(value: unknown, spec: Spec): Segment {
  if (
    !object(value) ||
    value.task !== 'segmentation' ||
    value.model_id !== 'customer-segmentation-kmeans' ||
    value.model_version !== spec.model.model_version ||
    typeof value.cluster !== 'number' ||
    !Number.isInteger(value.cluster) ||
    value.cluster < 0 ||
    value.cluster > 2 ||
    value.segment_id !== segmentId(value.model_version as string, value.cluster) ||
    typeof value.segment_name !== 'string' ||
    value.segment_name !== spec.model.labels[String(value.cluster)] ||
    typeof value.generated_at !== 'string' ||
    Number.isNaN(Date.parse(value.generated_at)) ||
    typeof value.distance_to_centroid !== 'number' ||
    !Number.isFinite(value.distance_to_centroid) ||
    value.distance_to_centroid < 0 ||
    value.distance_kind !== 'standardized_euclidean_not_probability' ||
    value.scope !== 'descriptive_snapshot_not_causal_or_future' ||
    'probabilities' in value ||
    'confidence' in value
  )
    throw new ApiError('protocol');
  return value as Segment;
}
export function verifyDistribution(value: unknown, spec: Spec): Distribution {
  if (
    !object(value) ||
    value.model_version !== spec.model.model_version ||
    value.count_unit !== 'stored_segmentation_results_not_unique_customers' ||
    value.scope !== 'descriptive_snapshot' ||
    !object(value.definitions) ||
    !object(value.stored_result_counts) ||
    Object.keys(value.definitions).length !== 3 ||
    Object.keys(value.stored_result_counts).length !== 3
  )
    throw new ApiError('protocol');
  for (let c = 0; c < 3; c++) {
    const id = segmentId(spec.model.model_version, c),
      def = value.definitions[id],
      count = value.stored_result_counts[id];
    if (
      !object(def) ||
      def.cluster !== String(c) ||
      def.display_label !== spec.model.labels[String(c)] ||
      typeof count !== 'number' ||
      !Number.isSafeInteger(count) ||
      count < 0
    )
      throw new ApiError('protocol');
  }
  return value as Distribution;
}
export function segmentCsv(text: string, spec: Spec, total: number): Segment[] {
  let rows: string[][];
  try {
    rows = parseCsv(text);
  } catch {
    throw new ApiError('protocol');
  }
  const headers = rows.shift() ?? [],
    required = [
      'Model_ID',
      'Model_Version',
      'Generated_At',
      'Prediction_Task',
      'Cluster',
      'Segment_ID',
      'Segment_Name',
      'Distance_To_Centroid',
      'Distance_Kind',
    ];
  if (
    new Set(headers).size !== headers.length ||
    required.some((h) => !headers.includes(h)) ||
    rows.length !== total
  )
    throw new ApiError('protocol');
  return rows.map((cells) => {
    if (cells.length !== headers.length) throw new ApiError('protocol');
    const row = Object.fromEntries(headers.map((h, i) => [h, cells[i]]));
    if (
      required.some((h) => !row[h]?.trim()) ||
      !/^[0-2]$/.test(row.Cluster!) ||
      !/^[+]?\d+(?:\.\d*)?(?:e[+-]?\d+)?$/i.test(row.Distance_To_Centroid!)
    )
      throw new ApiError('protocol');
    return verifySegment(
      {
        task: row.Prediction_Task,
        model_id: row.Model_ID,
        model_version: row.Model_Version,
        generated_at: row.Generated_At,
        cluster: Number(row.Cluster),
        segment_id: row.Segment_ID,
        segment_name: row.Segment_Name,
        distance_to_centroid: Number(row.Distance_To_Centroid),
        distance_kind: row.Distance_Kind,
        scope: 'descriptive_snapshot_not_causal_or_future',
        input_quality: null,
      },
      spec,
    );
  });
}
