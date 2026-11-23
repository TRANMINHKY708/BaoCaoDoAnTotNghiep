const vietnamTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function vietnamDateTime(value: string | null | undefined, empty = 'Chưa có'): string {
  if (!value) return empty;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Thời gian không hợp lệ'
    : `${vietnamTime.format(date)} (UTC+7)`;
}
