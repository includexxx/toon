/**
 * Value normalization utilities
 */

import { isPlainObject } from './validation-utils';

/**
 * Normalizes a value to a JSON-compatible format.
 */
export function normalizeValue(value: any): any {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  
  if (typeof value === 'number') {
    if (Object.is(value, -0)) return 0;
    if (!Number.isFinite(value)) return null;
    return value;
  }
  
  if (typeof value === 'bigint') {
    if (value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER) {
      return Number(value);
    }
    return value.toString();
  }
  
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value instanceof Set) return Array.from(value).map(normalizeValue);
  if (value instanceof Map) {
    return Object.fromEntries(
      Array.from(value, ([k, v]) => [String(k), normalizeValue(v)])
    );
  }
  
  if (isPlainObject(value)) {
    const result: Record<string, any> = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        result[key] = normalizeValue(value[key]);
      }
    }
    return result;
  }
  
  return null;
}

