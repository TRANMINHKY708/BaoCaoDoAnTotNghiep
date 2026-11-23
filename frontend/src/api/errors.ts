export type ApiErrorKind =
  'http' | 'network' | 'timeout' | 'cancelled' | 'protocol' | 'configuration';
export type SafeIssue = { row?: number; field?: string; source: 'csv' | 'json' };
const messages: Record<number, string> = {
  401: 'Thông tin kết nối không hợp lệ hoặc đã bị thu hồi. Vui lòng kết nối lại.',
  403: 'Vai trò hiện tại không được phép thực hiện thao tác này.',
  404: 'Không tìm thấy tài nguyên được yêu cầu.',
  409: 'Dữ liệu hoặc phiên bản mô hình có xung đột. Hãy kiểm tra trước khi thử lại.',
  412: 'Dữ liệu đã thay đổi. Hãy tải lại trước khi cập nhật.',
  413: 'Dữ liệu gửi lên vượt quá giới hạn cho phép.',
  422: 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra các trường nhập.',
  428: 'Cần tải lại thông tin tài khoản trước khi xác nhận thao tác.',
  429: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng đợi trước khi thử lại.',
  503: 'Dịch vụ tạm thời chưa sẵn sàng. Vui lòng thử lại sau.',
};

const authMessages: Record<string, string> = {
  BATCH_ANALYTICS_CHANGED:
    'Dữ liệu đã thay đổi từ lần xem trước. Hãy tải lại dashboard rồi xuất hoặc yêu cầu AI nhận xét.',
  BATCH_MODEL_IDENTITY_AMBIGUOUS:
    'Cùng phiên bản có nhiều danh tính mô hình. Chọn một mô hình cụ thể hoặc một tác vụ để không trộn số liệu.',
  BATCH_DATA_INTEGRITY:
    'Phát hiện liên kết dữ liệu hoặc kết quả lịch sử không hợp lệ. Chưa thể tổng hợp; cần kiểm tra nguồn.',
  BATCH_NO_SAVED_RESULTS: 'Chưa có kết quả ML đã lưu phù hợp để AI nhận xét.',
  BATCH_REPORT_TOO_LARGE: 'Báo cáo vượt 5.000 dòng. Hãy thu hẹp bộ lọc rồi xuất lại.',
  BULK_MIGRATION_REQUIRED:
    'Chức năng nhập dữ liệu chưa được thiết lập đầy đủ. Vui lòng liên hệ người quản trị.',
  BULK_ORDERS_PREVIEW_ONLY: 'Dữ liệu đơn hàng hiện chỉ được xem trước, chưa hỗ trợ nhập hồ sơ.',
  BULK_IDEMPOTENCY_CONFLICT:
    'Mã yêu cầu đã gắn với nội dung hoặc phiên khác. Không gửi lại với dữ liệu mới.',
  BULK_SNAPSHOT_CONFLICT:
    'Đã có snapshot cùng khách hàng và thời điểm nhưng nội dung khác. Toàn bộ tập ghi của lần thử được rollback.',
  BULK_CUSTOMER_INACTIVE:
    'Có khách hàng đã ngưng hoạt động. Hệ thống không tự kích hoạt lại; hãy kiểm tra hồ sơ.',
  BULK_DATABASE_ERROR:
    'Chưa xác nhận được kết quả ghi. Hãy kiểm tra kết quả đã gửi, không tự tạo mã yêu cầu mới.',
  BULK_REFERENCE_EXPIRED: 'Lô tạm đã hết hạn hoặc không thuộc phiên hiện tại. Hãy đọc lại tệp CSV.',
  BULK_PREVIEW_CHANGED: 'Lô hoặc ánh xạ đã thay đổi. Hãy kiểm tra dữ liệu lại.',
  BULK_INVALID_CSV: 'CSV phải dùng UTF-8, dấu phẩy và header không trùng hoặc rỗng.',
  BULK_ROW_LIMIT: 'CSV cần từ 1 đến 1.000 dòng dữ liệu. Hệ thống không tự cắt bớt dòng.',
  BULK_MEMORY_BUSY: 'Bộ nhớ lô tạm đã đầy. Chờ tối đa 10 phút rồi thử lại.',
  CSRF_FAILED: 'Phiên xác nhận đã thay đổi. Hãy kiểm tra lại phiên trước khi tiếp tục.',
  ORIGIN_NOT_ALLOWED: 'Địa chỉ kết nối chưa được cho phép. Liên hệ người quản trị.',
  REAUTH_FAILED: 'Mật khẩu xác nhận chưa đúng hoặc xác minh đang tạm khóa.',
  PASSWORD_UNCHANGED: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
  PASSWORD_CHANGE_REQUIRED: 'Bạn cần đổi mật khẩu lần đầu để tiếp tục.',
  STALE_USER_VERSION: 'Tài khoản đã thay đổi từ nơi khác. Hãy tải lại trước khi cập nhật.',
  PRECONDITION_REQUIRED: 'Cần tải lại thông tin tài khoản trước khi xác nhận.',
  LAST_ADMIN_PROTECTED: 'Không thể làm mất tài khoản quản trị đang hoạt động cuối cùng.',
  SELF_OPERATION_NOT_ALLOWED: 'Bạn không thể tự khóa hoặc hạ quyền tài khoản của mình.',
  USERNAME_UNAVAILABLE: 'Tên đăng nhập này đã được sử dụng.',
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;
  readonly fields: string[];
  readonly issues: SafeIssue[];
  constructor(
    kind: ApiErrorKind,
    status = 0,
    options: {
      code?: string;
      requestId?: string;
      retryAfterSeconds?: number;
      fields?: string[];
      issues?: SafeIssue[];
    } = {},
  ) {
    super(
      kind === 'http'
        ? authMessages[options.code || ''] ||
            messages[status] ||
            'Yêu cầu không thành công. Vui lòng thử lại.'
        : {
            network: 'Không thể kết nối tới API. Kiểm tra dịch vụ và cấu hình kết nối.',
            timeout: 'Yêu cầu mất quá nhiều thời gian.',
            cancelled: 'Yêu cầu đã được hủy.',
            protocol: 'Phản hồi API không đúng hợp đồng kết nối.',
            configuration: 'Chưa cấu hình địa chỉ API hợp lệ.',
          }[kind],
    );
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.code = options.code || kind.toUpperCase();
    this.requestId = options.requestId;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.fields = options.fields || [];
    this.issues = options.issues || [];
  }
}

export function httpError(response: Response, body: unknown): ApiError {
  const error = body && typeof body === 'object' && 'error' in body ? body.error : undefined;
  const safe = error && typeof error === 'object' ? error : {};
  const id = response.headers.get('X-Request-ID');
  const rawRetry = response.headers.get('Retry-After');
  const retry =
    rawRetry && /^\d+$/.test(rawRetry)
      ? Number(rawRetry)
      : rawRetry
        ? Math.max(0, Math.ceil((Date.parse(rawRetry) - Date.now()) / 1000))
        : undefined;
  // Only known model feature names and bounded row positions; never unknown key
  // names, raw messages, URLs, values, arbitrary Pydantic locations or input data.
  const featureNames = new Set([
    'Age',
    'Gender',
    'Country',
    'City',
    'Membership_Years',
    'Login_Frequency',
    'Session_Duration_Avg',
    'Pages_Per_Session',
    'Cart_Abandonment_Rate',
    'Wishlist_Items',
    'Average_Order_Value',
    'Days_Since_Last_Purchase',
    'Discount_Usage_Rate',
    'Returns_Rate',
    'Email_Open_Rate',
    'Customer_Service_Calls',
    'Product_Reviews_Written',
    'Social_Media_Engagement_Score',
    'Mobile_App_Usage',
    'Payment_Method_Diversity',
    'Lifetime_Value',
    'Credit_Balance',
    'Churned',
    'Signup_Quarter',
    'Total_Purchases',
  ]);
  const issues: SafeIssue[] = [];
  if ('details' in safe && Array.isArray(safe.details)) {
    for (const detail of safe.details.slice(0, 100)) {
      if (
        !detail ||
        typeof detail !== 'object' ||
        !('location' in detail) ||
        !Array.isArray(detail.location)
      )
        continue;
      const loc = detail.location as unknown[];
      const source = loc[0] === 'csv' ? 'csv' : 'json';
      const position =
        source === 'csv'
          ? loc[1]
          : loc.includes('customers')
            ? loc[loc.indexOf('customers') + 1]
            : undefined;
      const row =
        typeof position === 'number' &&
        Number.isInteger(position) &&
        position >= 0 &&
        position <= 1001
          ? position + (source === 'json' ? 1 : 0)
          : undefined;
      const field = loc.find((v): v is string => typeof v === 'string' && featureNames.has(v));
      if (row !== undefined || field) issues.push({ source, row, field });
    }
  }
  return new ApiError('http', response.status, {
    code:
      'code' in safe && typeof safe.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(safe.code)
        ? safe.code
        : `HTTP_${response.status}`,
    requestId: id && /^[0-9a-f-]{36}$/i.test(id) ? id : undefined,
    retryAfterSeconds: retry !== undefined && Number.isFinite(retry) ? retry : undefined,
    issues,
    // Raw server messages/details may contain legacy inputs: never render or log them.
  });
}
