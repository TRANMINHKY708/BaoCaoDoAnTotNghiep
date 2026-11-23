import { ApiError } from '../../api/errors';
import { isCustomerId } from '../customers/customers';

export type Turn = { role: 'user' | 'assistant'; content: string };
export type SourceKind =
  | 'application_postgresql'
  | 'cleaned_research_dataset'
  | 'research_reports'
  | 'pinned_model_artifact'
  | 'application_workspace_aggregate';
export type AssistantSource = {
  tool: string;
  source: SourceKind;
  customer_id: string | null;
  records_returned: number;
};
export type AssistantReply = {
  message: string;
  model: string;
  generated_at: string;
  sources: AssistantSource[];
  history_persisted: false;
  disclaimer: string;
};
export type AssistantRequest = { message: string; history: Turn[]; customer_id?: string };

// Additive F04.1 contract, separate from the accepted historical generated snapshot.
declare module '../../api/generated' {
  interface paths {
    '/api/v1/assistant/chat': {
      post: {
        requestBody: { content: { 'application/json': AssistantRequest } };
        responses: { 200: { content: { 'application/json': AssistantReply } } };
      };
    };
  }
}

export const textLength = (text: string) => Array.from(text).length;

/** Only complete successful user/assistant pairs; never truncate their meaning. */
export function boundedHistory(turns: Turn[], message: string): Turn[] {
  const pairs: Turn[][] = [];
  let budget = 12000 - textLength(message);
  for (let i = turns.length - 2; i >= 0 && pairs.length < 5; i -= 2) {
    const user = turns[i],
      assistant = turns[i + 1];
    if (!user || !assistant || user.role !== 'user' || assistant.role !== 'assistant') continue;
    const size = textLength(user.content) + textLength(assistant.content);
    if (textLength(user.content) > 2000 || textLength(assistant.content) > 2000) continue;
    if (size > budget) break;
    pairs.unshift([user, assistant]);
    budget -= size;
  }
  return pairs.flat().map(({ role, content }) => ({ role, content }));
}

/** Each tool has exactly one source kind; customer-scoped tools must name the selected customer. */
const toolSources: Record<string, SourceKind> = {
  get_customer_summary: 'application_postgresql',
  get_customer_analysis_history: 'application_postgresql',
  get_prediction_details: 'application_postgresql',
  get_segmentation_details: 'application_postgresql',
  get_whatif_details: 'application_postgresql',
  get_customer_churn_risk: 'application_postgresql',
  get_research_segment_profiles: 'cleaned_research_dataset',
  get_research_results: 'research_reports',
  get_churn_model_info: 'pinned_model_artifact',
  get_workspace_overview: 'application_workspace_aggregate',
};
export const MAX_SOURCES = 8;
export const sourceLabels: Record<string, string> = {
  get_customer_summary: 'Thông tin khách hàng',
  get_customer_analysis_history: 'Lịch sử phân tích',
  get_prediction_details: 'Kết quả dự đoán đã lưu',
  get_segmentation_details: 'Kết quả phân nhóm đã lưu',
  get_whatif_details: 'Kịch bản mô phỏng đã lưu',
  get_customer_churn_risk: 'Dự báo nguy cơ rời bỏ (không lưu)',
  get_research_segment_profiles: 'Hồ sơ phân khúc nghiên cứu',
  get_research_results: 'Kết quả nghiên cứu đã chốt',
  get_churn_model_info: 'Thông tin mô hình dự báo rời bỏ',
  get_workspace_overview: 'Số liệu tổng hợp của hệ thống',
};
export const sourceKindLabels: Record<SourceKind, string> = {
  application_postgresql: 'Dữ liệu khách hàng',
  cleaned_research_dataset: 'Hồ sơ phân nhóm từ dữ liệu nghiên cứu',
  research_reports: 'Báo cáo nghiên cứu của đồ án',
  pinned_model_artifact: 'Mô hình đang triển khai',
  application_workspace_aggregate: 'Số liệu tổng hợp của workspace',
};

export function checkedReply(value: AssistantReply, customerId?: string): AssistantReply {
  if (
    !value ||
    typeof value.message !== 'string' ||
    !value.message.trim() ||
    textLength(value.message) > 16000 ||
    typeof value.model !== 'string' ||
    !/^gemini-[a-zA-Z0-9.-]{1,80}$/.test(value.model) ||
    typeof value.generated_at !== 'string' ||
    !Number.isFinite(Date.parse(value.generated_at)) ||
    value.history_persisted !== false ||
    typeof value.disclaimer !== 'string' ||
    !value.disclaimer.trim() ||
    value.disclaimer.length > 2000 ||
    !Array.isArray(value.sources) ||
    value.sources.length > MAX_SOURCES
  )
    throw new ApiError('protocol');
  for (const source of value.sources) {
    if (
      !source ||
      !Object.hasOwn(toolSources, source.tool) ||
      !Number.isInteger(source.records_returned) ||
      source.records_returned < 0 ||
      toolSources[source.tool] !== source.source ||
      (source.source === 'application_postgresql' &&
        (!customerId ||
          !isCustomerId(source.customer_id ?? '') ||
          source.customer_id?.toLowerCase() !== customerId.toLowerCase())) ||
      (source.source !== 'application_postgresql' && source.customer_id !== null)
    )
      throw new ApiError('protocol');
  }
  return value;
}

export function assistantError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Chưa thể nhận câu trả lời. Vui lòng thử lại.';
  if (error.kind === 'timeout' || error.status === 504)
    return 'Trợ lý phản hồi quá lâu. Nội dung của bạn được giữ lại để thử lại.';
  if (error.kind === 'network') return 'Không thể kết nối. Hãy kiểm tra mạng và thử lại.';
  const messages: Record<number, string> = {
    401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    403: 'Bạn chưa có quyền sử dụng hoặc phiên xác nhận đã thay đổi. Hãy kiểm tra lại phiên đăng nhập.',
    422: 'Nội dung hoặc yêu cầu đọc dữ liệu chưa hợp lệ. Hãy rút gọn hoặc diễn đạt lại câu hỏi.',
    429: 'Đã đạt giới hạn yêu cầu. Vui lòng đợi một lát rồi thử lại.',
    502: 'Dịch vụ AI đang gặp lỗi kết nối hoặc chưa trả lời được. Vui lòng thử lại sau.',
    503: 'Trợ lý hiện chưa sẵn sàng. Cấu hình Gemini hoặc mô hình có thể chưa khả dụng.',
  };
  return messages[error.status] ?? 'Chưa thể đọc phản hồi an toàn từ trợ lý. Vui lòng thử lại.';
}
