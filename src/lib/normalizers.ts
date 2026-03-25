/**
 * Shared normalization utilities for request parameters.
 * These functions handle common input normalization patterns
 * to ensure consistent behavior across the application.
 */

/**
 * Normalizes a filter value by trimming whitespace and returning
 * null/undefined for empty or blank strings.
 */
export function normalizeFilterValue(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normalizes a filter value, returning undefined for empty/blank strings.
 * Use this variant when the API expects undefined (not null) for no value.
 */
export function normalizeFilterValueOptional(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export type DiscoveryViewMode = 'latest' | 'grouped';

/**
 * Normalizes a view mode parameter.
 * Any value other than 'grouped' defaults to 'latest'.
 */
export function normalizeView(value: string | null): DiscoveryViewMode {
  return value === 'grouped' ? 'grouped' : 'latest';
}

/**
 * Normalizes a page number parameter.
 * Returns 1 for invalid, NaN, or negative values.
 */
export function normalizePage(value: string | null): number {
  if (!value) {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}
