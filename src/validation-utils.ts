/**
 * Validation utility functions
 */

import { TRUE_LITERAL, FALSE_LITERAL, NULL_LITERAL, LIST_ITEM_MARKER, COMMA } from './constants';

/**
 * Checks if a token is a boolean or null literal.
 */
export function isBooleanOrNullLiteral(token: string): boolean {
  return token === TRUE_LITERAL || token === FALSE_LITERAL || token === NULL_LITERAL;
}

/**
 * Checks if a token represents a valid numeric literal.
 * Rejects numbers with leading zeros (except `"0"` itself or decimals like `"0.5"`).
 */
export function isNumericLiteral(token: string): boolean {
  if (!token) return false;
  if (token.length > 1 && token[0] === '0' && token[1] !== '.') return false;
  const num = Number(token);
  return !Number.isNaN(num) && Number.isFinite(num);
}

/**
 * Checks if a string looks like a number.
 */
export function isNumericLike(value: string): boolean {
  return /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value) || /^0\d+$/.test(value);
}

/**
 * Checks if a key can be used without quotes.
 * Valid unquoted keys must start with a letter or underscore,
 * followed by letters, digits, underscores, or dots.
 */
export function isValidUnquotedKey(key: string): boolean {
  return /^[A-Z_][\w.]*$/i.test(key);
}

/**
 * Determines if a string value can be safely encoded without quotes.
 * A string needs quoting if it:
 * - Is empty
 * - Has leading or trailing whitespace
 * - Could be confused with a literal (boolean, null, number)
 * - Contains structural characters (colons, brackets, braces)
 * - Contains quotes or backslashes (need escaping)
 * - Contains control characters (newlines, tabs, etc.)
 * - Contains the active delimiter
 * - Starts with a list marker (hyphen)
 */
export function isSafeUnquoted(value: string, delimiter: string = COMMA): boolean {
  if (!value) return false;
  if (value !== value.trim()) return false;
  if (isBooleanOrNullLiteral(value) || isNumericLike(value)) return false;
  if (value.includes(':')) return false;
  if (value.includes('"') || value.includes('\\')) return false;
  if (/[[\]{}]/.test(value)) return false;
  if (/[\n\r\t]/.test(value)) return false;
  if (value.includes(delimiter)) return false;
  if (value.startsWith(LIST_ITEM_MARKER)) return false;
  return true;
}

/**
 * Checks if a value is a JSON primitive (null, string, number, boolean).
 */
export function isJsonPrimitive(value: any): boolean {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/**
 * Checks if a value is a JSON array.
 */
export function isJsonArray(value: any): boolean {
  return Array.isArray(value);
}

/**
 * Checks if a value is a JSON object (plain object, not array).
 */
export function isJsonObject(value: any): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Checks if a value is a plain object (not a class instance, etc.).
 */
export function isPlainObject(value: any): boolean {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

/**
 * Checks if an array contains only primitives.
 */
export function isArrayOfPrimitives(value: any[]): boolean {
  return value.every((item) => isJsonPrimitive(item));
}

/**
 * Checks if an array contains only arrays.
 */
export function isArrayOfArrays(value: any[]): boolean {
  return value.every((item) => isJsonArray(item));
}

/**
 * Checks if an array contains only objects.
 */
export function isArrayOfObjects(value: any[]): boolean {
  return value.every((item) => isJsonObject(item));
}

