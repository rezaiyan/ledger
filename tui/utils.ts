/**
 * Shared TUI formatting utilities.
 */

/**
 * Format a dollar cost as "$X.XX".
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

/**
 * Format a duration in minutes as "47min", "1h 23m", etc.
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}min`;
  }
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Format token counts as "284k", "1.2M", etc.
 */
export function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${Math.round(count / 1_000)}k`;
  }
  return String(count);
}

/**
 * Truncate a string to maxLen characters, adding "…" if truncated.
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/**
 * Format a cache hit rate (0–1) as a percentage string: "67%".
 */
export function formatCacheHit(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/**
 * Shorten a model name for compact display.
 * e.g. "claude-sonnet-4-6-20251031" → "sonnet"
 */
export function shortModel(model: string): string {
  if (model.includes('opus')) return 'opus';
  if (model.includes('sonnet')) return 'sonnet';
  if (model.includes('haiku')) return 'haiku';
  return model;
}
