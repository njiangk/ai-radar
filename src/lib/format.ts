export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }
  if (value >= 1000) {
    return `$${Math.round(value).toLocaleString()}`;
  }
  if (value >= 100) {
    return `$${value.toFixed(2)}`;
  }
  if (value >= 1) {
    return `$${value.toFixed(2)}`;
  }
  if (value > 0) {
    return `$${value.toFixed(4)}`;
  }
  return `$${value}`;
}

export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }
  return value.toFixed(2);
}

export function formatContext(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }
  if (value >= 1_000_000) {
    return `${Math.round(value / 10_000) / 100}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  return String(value);
}

export function formatTokens(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return String(value);
}

export function formatHotness(
  usageTokens: number | null | undefined,
  maxUsage: number | null | undefined,
): string {
  if (!usageTokens || !maxUsage || maxUsage <= 0) {
    return '-';
  }
  return `${Math.round((usageTokens / maxUsage) * 1000) / 10}%`;
}

export function formatDay(iso: string | null): string {
  if (!iso) {
    return '日期未知';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '日期未知';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}

export function formatTime(iso: string | null): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatUpdated(iso: string | null): string {
  if (!iso) {
    return '-';
  }
  const date = new Date(iso);
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
