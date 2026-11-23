// Presentation only: preserve internal identifiers and transport data unchanged.
export function productText(text: string) {
  return text
    .replace(/\bF\d{1,2}(?:\.\d+)?\s*\/\s*F\d{1,2}(?:\.\d+)?\b/g, 'nhập dữ liệu và phân tích')
    .replace(/\bF\d{1,2}(?:\.\d+)?\b/g, '')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .trim();
}
