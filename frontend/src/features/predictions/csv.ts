import { ApiError } from '../../api/errors';
import {
  InputError,
  validateCustomer,
  verifyResult,
  type CustomerInput,
  type Issue,
  type Result,
  type Spec,
} from './prediction';

export const CSV_LIMIT = 10 * 1024 * 1024;
// Bounded RFC4180-style reader: no formula execution, HTML, eval or delimiter guessing.
export function parseCsv(text: string, maxRows = 1001): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false,
    closed = false,
    started = false;
  const pushRow = () => {
    if (started || row.length || cell.trim()) {
      row.push(cell);
      rows.push(row);
    }
    row = [];
    cell = '';
    closed = false;
    started = false;
    if (rows.length > maxRows) throw new InputError([{ message: 'CSV vượt số dòng cho phép.' }]);
  };
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += char;
      continue;
    }
    if (char === ',') {
      row.push(cell);
      if (row.length > 64) throw new InputError([{ message: 'CSV có quá nhiều cột.' }]);
      cell = '';
      closed = false;
      started = true;
    } else if (char === '\n' || char === '\r') {
      pushRow();
      if (char === '\r' && source[i + 1] === '\n') i++;
    } else if (char === '"') {
      if (cell || closed) throw new InputError([{ message: 'Dấu nháy CSV không hợp lệ.' }]);
      quoted = true;
      started = true;
    } else {
      if (closed) throw new InputError([{ message: 'Có ký tự sau trường CSV đã đóng dấu nháy.' }]);
      cell += char;
      if (char.trim()) started = true;
    }
  }
  if (quoted) throw new InputError([{ message: 'CSV có trường chưa đóng dấu nháy.' }]);
  pushRow();
  return rows;
}

export type CsvInput = { file: File; total: number; headers: string[] };
export async function inspectCsv(file: File, spec: Spec): Promise<CsvInput> {
  if (!file.name.toLowerCase().endsWith('.csv'))
    throw new InputError([{ message: 'Chọn file .csv UTF-8, không nhận archive hoặc Excel.' }]);
  if (file.size > CSV_LIMIT) throw new InputError([{ message: 'File CSV tối đa 10 MiB.' }]);
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    throw new InputError([{ message: 'CSV không phải UTF-8 hợp lệ.' }]);
  }
  const rows = parseCsv(text),
    headers = rows.shift() ?? [];
  if (!headers.length || headers.some((h) => !h.trim()) || new Set(headers).size !== headers.length)
    throw new InputError([{ message: 'Header CSV phải không rỗng và không trùng.' }]);
  const names = spec.features.map((f) => f.name);
  if (
    names.some((n) => !headers.includes(n)) ||
    headers.some((n) => !names.includes(n) && !['customer_id', 'external_id'].includes(n))
  )
    throw new InputError([
      {
        message:
          spec.model.task === 'segmentation'
            ? 'CSV chỉ nhận đúng 10 feature của model và customer_id/external_id passthrough; không chứa target hoặc cột kết quả.'
            : 'CSV chỉ nhận đúng feature của model và tùy chọn customer_id/external_id passthrough; không chứa target, Total_Purchases hoặc cột kết quả.',
      },
    ]);
  if (!rows.length || rows.length > 1000)
    throw new InputError([{ message: 'CSV cần từ 1 đến 1000 dòng dữ liệu.' }]);
  const issues: Issue[] = [];
  rows.forEach((values, index) => {
    if (values.length !== headers.length) {
      issues.push({ row: index + 2, message: 'Số cột của dòng không khớp header.' });
      return;
    }
    const raw = Object.fromEntries(headers.map((name, i) => [name, values[i]!]));
    const input: Record<string, unknown> = {};
    spec.features.forEach((f) => {
      const value = raw[f.name]!;
      input[f.name] =
        value === ''
          ? null
          : f.kind === 'number' &&
              /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())
            ? Number(value)
            : value;
    });
    try {
      validateCustomer(input, spec, index + 2);
    } catch (error) {
      if (error instanceof InputError) issues.push(...error.issues);
      else throw error;
    }
  });
  if (issues.length) throw new InputError(issues);
  return { file, total: rows.length, headers };
}

export function csvPredictions(text: string, spec: Spec, expectedRows: number): Result[] {
  let data: string[][];
  try {
    data = parseCsv(text);
  } catch {
    throw new ApiError('protocol');
  }
  const headers = data.shift() ?? [];
  const required = [
    'Model_ID',
    'Model_Version',
    'Generated_At',
    'Prediction_Task',
    'Predicted_Class',
    'Purchase_Level_Predicted',
    'Probability_Low',
    'Probability_Medium',
    'Probability_High',
  ];
  if (
    new Set(headers).size !== headers.length ||
    required.some((h) => !headers.includes(h)) ||
    data.length !== expectedRows
  )
    throw new ApiError('protocol');
  return data.map((values) => {
    if (values.length !== headers.length) throw new ApiError('protocol');
    const row = Object.fromEntries(headers.map((name, i) => [name, values[i]!]));
    if (
      required.some((key) => !row[key]?.trim()) ||
      ['Predicted_Class', 'Probability_Low', 'Probability_Medium', 'Probability_High'].some(
        (key) => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(row[key]!.trim()),
      )
    )
      throw new ApiError('protocol');
    // These immutable semantics come from the approved CSV/classification contract;
    // original server bytes are retained for download, not regenerated from this preview.
    return verifyResult(
      {
        task: row.Prediction_Task,
        model_id: row.Model_ID,
        model_version: row.Model_Version,
        generated_at: row.Generated_At,
        predicted_class: Number(row.Predicted_Class),
        purchase_level: row.Purchase_Level_Predicted,
        probabilities: {
          Low: Number(row.Probability_Low),
          Medium: Number(row.Probability_Medium),
          High: Number(row.Probability_High),
        },
        target_thresholds: { low_inclusive: 10, medium_inclusive: 15 },
        decision_rule: 'argmax_probability',
        scope: 'snapshot_classification_not_future_forecast',
      },
      spec.model.model_version,
    );
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function emptyTemplate(spec: Spec): Blob {
  return new Blob(['\uFEFF' + spec.features.map((f) => f.name).join(',') + '\r\n'], {
    type: 'text/csv;charset=utf-8',
  });
}

// Exported only for typed UI adapters/tests; CSV preflight never mutates or rewrites file.
export type { CustomerInput };
