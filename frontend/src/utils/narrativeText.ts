// Human-readable presentation only. Do not rewrite stored records or API payloads.
export function narrativeText(text: string) {
  return text
    .replace(/\s*\(\s*F\d{1,2}(?:\.\d+)?(?:\s*\/\s*F\d{1,2}(?:\.\d+)?)*\s*\)/g, '')
    .replace(/\bPostgreSQL\b/g, 'hệ thống')
    .replace(/\s+do\s+`?trend_available`?\s+(?:là|=)\s*`?false`?/gi, '')
    .replace(/`?trend_available`?\s*(?:là|=|:)\s*`?false`?/gi, 'chưa đủ dữ liệu theo thời gian')
    .replace(/`?trend_available`?\s*(?:là|=|:)\s*`?true`?/gi, 'đã có dữ liệu theo thời gian')
    .replace(/\bAverage_Order_Value\b/g, 'giá trị đơn hàng trung bình');
}
