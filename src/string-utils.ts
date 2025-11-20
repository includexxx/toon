/**
 * String utility functions for escaping and unescaping
 */

import { BACKSLASH, DOUBLE_QUOTE, NEWLINE, CARRIAGE_RETURN, TAB } from './constants';

/**
 * Escapes special characters in a string for encoding.
 * Handles backslashes, quotes, newlines, carriage returns, and tabs.
 */
export function escapeString(value: string): string {
  return value
    .replace(/\\/g, `${BACKSLASH}${BACKSLASH}`)
    .replace(/"/g, `${BACKSLASH}${DOUBLE_QUOTE}`)
    .replace(/\n/g, `${BACKSLASH}n`)
    .replace(/\r/g, `${BACKSLASH}r`)
    .replace(/\t/g, `${BACKSLASH}t`);
}

/**
 * Unescapes a string by processing escape sequences.
 * Handles `\n`, `\t`, `\r`, `\\`, and `\"` escape sequences.
 */
export function unescapeString(value: string): string {
  let result = '';
  let i = 0;
  
  while (i < value.length) {
    if (value[i] === BACKSLASH) {
      if (i + 1 >= value.length) {
        throw new SyntaxError('Invalid escape sequence: backslash at end of string');
      }
      
      const next = value[i + 1];
      switch (next) {
        case 'n':
          result += NEWLINE;
          i += 2;
          break;
        case 't':
          result += TAB;
          i += 2;
          break;
        case 'r':
          result += CARRIAGE_RETURN;
          i += 2;
          break;
        case BACKSLASH:
          result += BACKSLASH;
          i += 2;
          break;
        case DOUBLE_QUOTE:
          result += DOUBLE_QUOTE;
          i += 2;
          break;
        default:
          throw new SyntaxError(`Invalid escape sequence: \\${next}`);
      }
      continue;
    }
    
    result += value[i];
    i++;
  }
  
  return result;
}

/**
 * Finds the index of the closing double quote in a string, accounting for escape sequences.
 */
export function findClosingQuote(content: string, start: number): number {
  let i = start + 1;
  
  while (i < content.length) {
    if (content[i] === BACKSLASH && i + 1 < content.length) {
      i += 2;
      continue;
    }
    if (content[i] === DOUBLE_QUOTE) {
      return i;
    }
    i++;
  }
  
  return -1;
}

/**
 * Finds the index of a specific character outside of quoted sections.
 */
export function findUnquotedChar(content: string, char: string, start: number = 0): number {
  let inQuotes = false;
  let i = start;
  
  while (i < content.length) {
    if (content[i] === BACKSLASH && i + 1 < content.length && inQuotes) {
      i += 2;
      continue;
    }
    if (content[i] === DOUBLE_QUOTE) {
      inQuotes = !inQuotes;
      i++;
      continue;
    }
    if (content[i] === char && !inQuotes) {
      return i;
    }
    i++;
  }
  
  return -1;
}

