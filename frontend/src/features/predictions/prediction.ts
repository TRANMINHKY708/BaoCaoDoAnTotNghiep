import type { components } from '../../api/generated';
import { ApiError } from '../../api/errors';

export const VERSIONS = ['1.0.0', '2.0.0-snapshot-conservative12'] as const;
export type Version = (typeof VERSIONS)[number];
export type Model = components['schemas']['ModelInfo'];
export type Result = components['schemas']['PurchaseResponse'];
export type CustomerInput = Record<string, string | number | null>;
export type Feature = {
  name: string;
  kind: 'number' | 'string';
  nullable: boolean;
  choices?: string[];
  min?: number;
  max?: number;
  minLength?: number;
  pattern?: string;
};
export type Spec = { model: Model; features: Feature[] };
export type Issue = { field?: string; row?: number; message: string };
export class InputError extends Error {
  constructor(readonly issues: Issue[]) {
    super('Dữ liệu chưa hợp lệ; chưa gửi yêu cầu dự đoán.');
  }
}
export const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function modelSpec(model: Model): Spec {
  const schema = model.input_schema;
  if (
    model.task !== 'classification' ||
    model.model_id !== 'purchase-level-xgboost' ||
    !VERSIONS.includes(model.model_version as Version) ||
    !object(schema.properties) ||
    !Array.isArray(schema.required) ||
    schema.additionalProperties !== false ||
    model.features.length !== model.feature_count ||
    model.feature_count !== (model.model_version === VERSIONS[0] ? 24 : 12) ||
    model.features.some((name) => ['Purchase_Level', 'Total_Purchases'].includes(name)) ||
    Object.keys(schema.properties).length !== model.features.length ||
    schema.required.length !== model.features.length
  )
    throw new ApiError('protocol');
  const features = model.features.map((name): Feature => {
    const raw = (schema.properties as Record<string, unknown>)[name];
    if (!object(raw) || !(schema.required as unknown[]).includes(name))
      throw new ApiError('protocol');
    const variants = Array.isArray(raw.anyOf) ? raw.anyOf.filter(object) : [raw];
    const prop = variants.find((p) => p.type !== 'null');
    if (!prop || (prop.type !== 'number' && prop.type !== 'string')) throw new ApiError('protocol');
    return {
      name,
      kind: prop.type,
      nullable: variants.some((p) => p.type === 'null'),
      choices:
        Array.isArray(prop.enum) && prop.enum.every((v) => typeof v === 'string')
          ? (prop.enum as string[])
          : undefined,
      min: typeof prop.minimum === 'number' ? prop.minimum : undefined,
      max: typeof prop.maximum === 'number' ? prop.maximum : undefined,
      minLength: typeof prop.minLength === 'number' ? prop.minLength : undefined,
      pattern: typeof prop.pattern === 'string' ? prop.pattern : undefined,
    };
  });
  return { model, features };
}

export function validateCustomer(value: unknown, spec: Spec, row?: number): CustomerInput {
  const issues: Issue[] = [];
  if (!object(value))
    throw new InputError([
      { row, message: 'Mỗi bản ghi phải là object feature, không phải null/array.' },
    ]);
  const expected = new Set(spec.features.map((f) => f.name));
  if (Object.keys(value).some((name) => !expected.has(name)))
    issues.push({
      row,
      message: 'Có key ngoài bộ feature của model đã chọn (không tự cắt hoặc bỏ key).',
    });
  for (const f of spec.features) {
    const v = value[f.name];
    let message = '';
    if (!Object.hasOwn(value, f.name)) message = 'Thiếu key bắt buộc.';
    else if (v === null) {
      if (!f.nullable) message = 'Model này không nhận null.';
    } else if (f.kind === 'number') {
      if (typeof v !== 'number' || !Number.isFinite(v))
        message = 'Cần số hữu hạn, không nhận boolean hoặc chuỗi số JSON.';
      else if (f.min !== undefined && v < f.min) message = `Tối thiểu ${f.min}.`;
      else if (f.max !== undefined && v > f.max) message = `Tối đa ${f.max}.`;
      else if (f.name === 'Churned' && v !== 0 && v !== 1)
        message = 'Churned legacy phải là số 0 hoặc 1.';
    } else if (
      typeof v !== 'string' ||
      !v.trim() ||
      (f.minLength !== undefined && [...v].length < f.minLength)
    )
      message = 'Cần chuỗi không rỗng/khoảng trắng.';
    else if (f.choices && !f.choices.includes(v)) message = 'Giá trị ngoài danh mục cho phép.';
    if (message) issues.push({ row, field: f.name, message });
  }
  if (spec.features.every((f) => value[f.name] === null))
    issues.push({ row, message: 'Cần ít nhất một feature có quan sát; không gửi toàn null.' });
  if (issues.length) throw new InputError(issues);
  return value as CustomerInput;
}

export function formCustomer(
  draft: Record<string, string>,
  nulls: Set<string>,
  spec: Spec,
): CustomerInput {
  const value: Record<string, unknown> = {};
  for (const feature of spec.features) {
    const raw = draft[feature.name] ?? '';
    if (nulls.has(feature.name) && feature.nullable) value[feature.name] = null;
    else if (
      feature.kind === 'number' &&
      raw.trim() !== '' &&
      /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim())
    )
      value[feature.name] = Number(raw);
    else if (feature.kind === 'string' || raw !== '') value[feature.name] = raw;
  }
  return validateCustomer(value, spec);
}

// Native parse establishes syntax. Token scan additionally rejects duplicates/deep nesting
// before stringify can silently erase duplicate keys. No eval or external parser.
export function strictJson(text: string): unknown {
  if (new TextEncoder().encode(text).byteLength > 1024 * 1024)
    throw new InputError([{ message: 'JSON tối đa 1 MiB; không tăng giới hạn backend.' }]);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text, (_key, value: unknown) => {
      if (typeof value === 'number' && !Number.isFinite(value)) throw new Error();
      return value;
    });
  } catch {
    throw new InputError([{ message: 'JSON sai cú pháp hoặc chứa số không hữu hạn.' }]);
  }
  const tokens =
    text.match(
      /"(?:\\[\s\S]|[^"\\])*"|[{}[\]:,]|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?|true|false|null/gi,
    ) ?? [];
  const stack: Array<{ keys: Set<string>; object: boolean; key: boolean }> = [];
  for (const token of tokens) {
    if (token === '{' || token === '[') {
      stack.push({ keys: new Set(), object: token === '{', key: token === '{' });
      if (stack.length > 32) throw new InputError([{ message: 'JSON vượt độ sâu 32.' }]);
    } else if (token === '}' || token === ']') stack.pop();
    else if (token === ',' && stack.at(-1)?.object) stack.at(-1)!.key = true;
    else if (token.startsWith('"') && stack.at(-1)?.object && stack.at(-1)!.key) {
      const key = JSON.parse(token) as string,
        frame = stack.at(-1)!;
      if (frame.keys.has(key))
        throw new InputError([{ message: 'JSON có key trùng lặp, chưa gửi yêu cầu.' }]);
      frame.keys.add(key);
      frame.key = false;
    }
  }
  return parsed;
}

export function batchCustomers(text: string, spec: Spec): CustomerInput[] {
  const parsed = strictJson(text);
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 100)
    throw new InputError([
      { message: 'Nhập array từ 1 đến 100 object feature (không nhập request envelope).' },
    ]);
  const issues: Issue[] = [];
  const rows = parsed.map((value, index) => {
    try {
      return validateCustomer(value, spec, index + 1);
    } catch (error) {
      if (error instanceof InputError) issues.push(...error.issues);
      else throw error;
      return {};
    }
  });
  if (issues.length) throw new InputError(issues);
  return rows;
}

export function adaptSnapshot(
  snapshot: components['schemas']['BehaviorSnapshotRead'],
  spec: Spec,
): CustomerInput {
  const row: Record<string, unknown> = snapshot;
  const picked = Object.fromEntries(
    spec.features
      .filter((f) => Object.hasOwn(row, f.name))
      .map((f) => [
        f.name,
        f.name === 'Churned' && typeof row[f.name] === 'boolean'
          ? Number(row[f.name])
          : row[f.name],
      ]),
  );
  return validateCustomer(picked, spec);
}

export function verifyResult(value: unknown, version: string): Result {
  if (
    !object(value) ||
    value.task !== 'classification' ||
    value.model_id !== 'purchase-level-xgboost' ||
    value.model_version !== version ||
    !['Low', 'Medium', 'High'].includes(String(value.purchase_level)) ||
    value.predicted_class !== ['Low', 'Medium', 'High'].indexOf(String(value.purchase_level)) ||
    typeof value.generated_at !== 'string' ||
    Number.isNaN(Date.parse(value.generated_at)) ||
    !object(value.probabilities) ||
    value.scope !== 'snapshot_classification_not_future_forecast' ||
    value.decision_rule !== 'argmax_probability' ||
    !object(value.target_thresholds) ||
    value.target_thresholds.low_inclusive !== 10 ||
    value.target_thresholds.medium_inclusive !== 15
  )
    throw new ApiError('protocol');
  const probs = ['Low', 'Medium', 'High'].map(
    (name) => (value.probabilities as Record<string, unknown>)[name],
  );
  if (
    probs.some((p) => typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) ||
    Math.abs((probs as number[]).reduce((a, b) => a + b, 0) - 1) > 1e-5 ||
    value.predicted_class !== (probs as number[]).indexOf(Math.max(...(probs as number[])))
  )
    throw new ApiError('protocol');
  return value as Result;
}

export const labels: Record<string, string> = {
  Total_Purchases: 'Tổng lượt mua tại snapshot',
  Age: 'Tuổi',
  Gender: 'Giới tính',
  Country: 'Quốc gia',
  City: 'Thành phố',
  Membership_Years: 'Số năm thành viên',
  Login_Frequency: 'Tần suất đăng nhập',
  Session_Duration_Avg: 'Thời lượng phiên TB',
  Pages_Per_Session: 'Số trang / phiên',
  Wishlist_Items: 'Sản phẩm yêu thích',
  Email_Open_Rate: 'Tỷ lệ mở email',
  Mobile_App_Usage: 'Sử dụng ứng dụng',
  Signup_Quarter: 'Quý đăng ký',
  Cart_Abandonment_Rate: 'Tỷ lệ bỏ giỏ',
  Average_Order_Value: 'Giá trị đơn TB',
  Days_Since_Last_Purchase: 'Ngày từ lần mua gần nhất',
  Discount_Usage_Rate: 'Tỷ lệ sử dụng giảm giá',
  Returns_Rate: 'Tỷ lệ hoàn trả',
  Customer_Service_Calls: 'Cuộc gọi hỗ trợ',
  Product_Reviews_Written: 'Đánh giá đã viết',
  Social_Media_Engagement_Score: 'Điểm tương tác mạng xã hội',
  Payment_Method_Diversity: 'Đa dạng thanh toán',
  Lifetime_Value: 'Lifetime_Value · lịch sử',
  Credit_Balance: 'Số dư tín dụng',
  Churned: 'Churned · trạng thái lịch sử',
};
