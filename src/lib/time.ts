const DAY = 86_400_000;

function startOfDay(value: number): number {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

const pad = (value: number) => String(value).padStart(2, '0');

/** 对话记录的分组标签：今天 / 昨天 / 3月5日 / 2025年3月5日。 */
export function dayLabel(value: number): string {
  if (!Number.isFinite(value)) return '';
  const date = new Date(value);
  const diff = Math.round((startOfDay(Date.now()) - startOfDay(value)) / DAY);
  if (diff <= 0) return '今天';
  if (diff === 1) return '昨天';
  if (date.getFullYear() === new Date().getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日`;
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function clock(value: number): string {
  if (!Number.isFinite(value)) return '';
  const date = new Date(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 列表用的相对时间。 */
export function formatRelative(value: number): string {
  if (!Number.isFinite(value)) return '';
  const diff = Date.now() - value;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  const label = dayLabel(value);
  if (label === '今天' || label === '昨天') return `${label} ${clock(value)}`;
  return label;
}

/** 完整日期，用于任务列表。 */
export function formatDate(value: number): string {
  if (!Number.isFinite(value)) return '';
  const date = new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${clock(value)}`;
}
