/**
 * TOON serializer - converts JavaScript objects to TOON format
 */

import { EncodeOptions } from './types';
import { normalizeValue } from './normalize';
import {
  isJsonPrimitive,
  isJsonArray,
  isJsonObject,
  isArrayOfPrimitives,
  isArrayOfArrays,
  isArrayOfObjects,
  isValidUnquotedKey,
  isSafeUnquoted,
} from './validation-utils';
import { escapeString } from './string-utils';
import {
  NULL_LITERAL,
  COMMA,
  COLON,
  OPEN_BRACKET,
  CLOSE_BRACKET,
  OPEN_BRACE,
  CLOSE_BRACE,
  LIST_ITEM_PREFIX,
  LIST_ITEM_MARKER,
  DEFAULT_DELIMITER,
  DEFAULT_INDENT_SIZE,
} from './constants';
import { hasCircularReference } from './utils';

export class SerializeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SerializeError';
  }
}

// Legacy export for backward compatibility
export const encode = serialize;
export const EncodeError = SerializeError;

/**
 * Convert a JavaScript object to TOON format string
 */
export function serialize(obj: any, options?: EncodeOptions): string {
  if (hasCircularReference(obj)) {
    throw new SerializeError('Cannot serialize object with circular references');
  }

  const normalized = normalizeValue(obj);
  const resolvedOptions = resolveOptions(options);
  return encodeValue(normalized, resolvedOptions);
}

/**
 * Resolve encode options with defaults
 */
function resolveOptions(options?: EncodeOptions) {
  return {
    indent: DEFAULT_INDENT_SIZE,
    delimiter: options?.delimiter ?? DEFAULT_DELIMITER,
    lengthMarker: false, // Library default
  };
}

/**
 * Encode a primitive value
 */
function encodePrimitive(value: any, delimiter: string = COMMA): string {
  if (value === null) return NULL_LITERAL;
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);
  return encodeStringLiteral(value, delimiter);
}

/**
 * Encode a string literal (with or without quotes)
 */
function encodeStringLiteral(value: string, delimiter: string = COMMA): string {
  if (isSafeUnquoted(value, delimiter)) return value;
  return `"${escapeString(value)}"`;
}

/**
 * Encode a key (with or without quotes)
 */
function encodeKey(key: string): string {
  if (isValidUnquotedKey(key)) return key;
  return `"${escapeString(key)}"`;
}

/**
 * Encode and join primitives with delimiter
 */
function encodeAndJoinPrimitives(values: any[], delimiter: string = COMMA): string {
  return values.map((v) => encodePrimitive(v, delimiter)).join(delimiter);
}

/**
 * Format array header: [N] or key[N] or key[N]{fields}:
 */
function formatHeader(
  length: number,
  options: {
    key?: string;
    fields?: string[];
    delimiter?: string;
    lengthMarker?: boolean;
  }
): string {
  const { key, fields, delimiter = COMMA, lengthMarker = false } = options;
  let header = '';
  
  if (key) {
    header += encodeKey(key);
  }
  
  header += `${OPEN_BRACKET}${lengthMarker ? '#' : ''}${length}${delimiter !== DEFAULT_DELIMITER ? delimiter : ''}${CLOSE_BRACKET}`;
  
  if (fields) {
    const quotedFields = fields.map((f) => encodeKey(f));
    header += `${OPEN_BRACE}${quotedFields.join(delimiter)}${CLOSE_BRACE}`;
  }
  
  header += COLON;
  return header;
}

/**
 * Line writer for building formatted output
 */
class LineWriter {
  private lines: string[] = [];
  private indentationString: string;

  constructor(indentSize: number) {
    this.indentationString = ' '.repeat(indentSize);
  }

  push(depth: number, content: string): void {
    const indent = this.indentationString.repeat(depth);
    this.lines.push(indent + content);
  }

  pushListItem(depth: number, content: string): void {
    this.push(depth, `${LIST_ITEM_PREFIX}${content}`);
  }

  toString(): string {
    return this.lines.join('\n');
  }
}

/**
 * Main encode function
 */
function encodeValue(value: any, options: ReturnType<typeof resolveOptions>): string {
  if (isJsonPrimitive(value)) {
    return encodePrimitive(value, options.delimiter);
  }
  
  const writer = new LineWriter(options.indent);
  
  if (isJsonArray(value)) {
    encodeArray(undefined, value, writer, 0, options);
  } else if (isJsonObject(value)) {
    encodeObject(value, writer, 0, options);
  }
  
  return writer.toString();
}

/**
 * Encode an object
 */
function encodeObject(value: Record<string, any>, writer: LineWriter, depth: number, options: ReturnType<typeof resolveOptions>): void {
  const keys = Object.keys(value); // Preserves insertion order
  for (const key of keys) {
    encodeKeyValuePair(key, value[key], writer, depth, options);
  }
}

/**
 * Encode a key-value pair
 */
function encodeKeyValuePair(
  key: string,
  value: any,
  writer: LineWriter,
  depth: number,
  options: ReturnType<typeof resolveOptions>
): void {
  const encodedKey = encodeKey(key);
  
  if (isJsonPrimitive(value)) {
    writer.push(depth, `${encodedKey}: ${encodePrimitive(value, options.delimiter)}`);
  } else if (isJsonArray(value)) {
    encodeArray(key, value, writer, depth, options);
  } else if (isJsonObject(value)) {
    if (Object.keys(value).length === 0) {
      writer.push(depth, `${encodedKey}:`);
    } else {
      writer.push(depth, `${encodedKey}:`);
      encodeObject(value, writer, depth + 1, options);
    }
  }
}

/**
 * Encode an array
 */
function encodeArray(
  key: string | undefined,
  value: any[],
  writer: LineWriter,
  depth: number,
  options: ReturnType<typeof resolveOptions>
): void {
  if (value.length === 0) {
    const header = formatHeader(0, {
      key,
      delimiter: options.delimiter,
      lengthMarker: options.lengthMarker,
    });
    writer.push(depth, header);
    return;
  }
  
  if (isArrayOfPrimitives(value)) {
    const formatted = encodeInlineArrayLine(value, options.delimiter, key, options.lengthMarker);
    writer.push(depth, formatted);
    return;
  }
  
  if (isArrayOfArrays(value)) {
    if (value.every((arr) => isArrayOfPrimitives(arr))) {
      encodeArrayOfArraysAsListItems(key, value, writer, depth, options);
      return;
    }
  }
  
  if (isArrayOfObjects(value)) {
    const header = extractTabularHeader(value);
    if (header) {
      encodeArrayOfObjectsAsTabular(key, value, header, writer, depth, options);
    } else {
      encodeMixedArrayAsListItems(key, value, writer, depth, options);
    }
    return;
  }
  
  encodeMixedArrayAsListItems(key, value, writer, depth, options);
}

/**
 * Encode inline array line: [N]: item1,item2,item3
 */
function encodeInlineArrayLine(
  values: any[],
  delimiter: string,
  prefix: string | undefined,
  lengthMarker: boolean
): string {
  const header = formatHeader(values.length, {
    key: prefix,
    delimiter,
    lengthMarker,
  });
  const joinedValue = encodeAndJoinPrimitives(values, delimiter);
  if (values.length === 0) return header;
  return `${header} ${joinedValue}`;
}

/**
 * Encode array of arrays as list items
 */
function encodeArrayOfArraysAsListItems(
  prefix: string | undefined,
  values: any[],
  writer: LineWriter,
  depth: number,
  options: ReturnType<typeof resolveOptions>
): void {
  const header = formatHeader(values.length, {
    key: prefix,
    delimiter: options.delimiter,
    lengthMarker: options.lengthMarker,
  });
  writer.push(depth, header);
  
  for (const arr of values) {
    if (isArrayOfPrimitives(arr)) {
      const inline = encodeInlineArrayLine(arr, options.delimiter, undefined, options.lengthMarker);
      writer.pushListItem(depth + 1, inline);
    }
  }
}

/**
 * Extract tabular header from array of objects
 * Returns the keys from the first object if all objects have the same keys
 */
function extractTabularHeader(rows: Record<string, any>[]): string[] | undefined {
  if (rows.length === 0) return undefined;
  
  const firstRow = rows[0];
  const firstKeys = Object.keys(firstRow); // Preserves insertion order
  
  if (firstKeys.length === 0) return undefined;
  
  if (isTabularArray(rows, firstKeys)) {
    return firstKeys;
  }
  
  return undefined;
}

/**
 * Check if array of objects is suitable for tabular format
 */
function isTabularArray(rows: Record<string, any>[], header: string[]): boolean {
  for (const row of rows) {
    const rowKeys = Object.keys(row);
    if (rowKeys.length !== header.length) return false;
    
    for (const key of header) {
      if (!(key in row)) return false;
      if (!isJsonPrimitive(row[key])) return false;
    }
  }
  
  return true;
}

/**
 * Encode array of objects as tabular format
 */
function encodeArrayOfObjectsAsTabular(
  prefix: string | undefined,
  rows: Record<string, any>[],
  header: string[],
  writer: LineWriter,
  depth: number,
  options: ReturnType<typeof resolveOptions>
): void {
  const formattedHeader = formatHeader(rows.length, {
    key: prefix,
    fields: header,
    delimiter: options.delimiter,
    lengthMarker: options.lengthMarker,
  });
  writer.push(depth, formattedHeader);
  writeTabularRows(rows, header, writer, depth + 1, options);
}

/**
 * Write tabular rows
 */
function writeTabularRows(
  rows: Record<string, any>[],
  header: string[],
  writer: LineWriter,
  depth: number,
  options: ReturnType<typeof resolveOptions>
): void {
  for (const row of rows) {
    const values = header.map((key) => row[key]);
    const joinedValue = encodeAndJoinPrimitives(values, options.delimiter);
    writer.push(depth, joinedValue);
  }
}

/**
 * Encode mixed array as list items (with - prefix)
 */
function encodeMixedArrayAsListItems(
  prefix: string | undefined,
  items: any[],
  writer: LineWriter,
  depth: number,
  options: ReturnType<typeof resolveOptions>
): void {
  const header = formatHeader(items.length, {
    key: prefix,
    delimiter: options.delimiter,
    lengthMarker: options.lengthMarker,
  });
  writer.push(depth, header);
  
  for (const item of items) {
    encodeListItemValue(item, writer, depth + 1, options);
  }
}

/**
 * Encode object as list item
 */
function encodeObjectAsListItem(
  obj: Record<string, any>,
  writer: LineWriter,
  depth: number,
  options: ReturnType<typeof resolveOptions>
): void {
  const keys = Object.keys(obj);
  
  if (keys.length === 0) {
    writer.push(depth, LIST_ITEM_MARKER);
    return;
  }
  
  const firstKey = keys[0];
  const encodedKey = encodeKey(firstKey);
  const firstValue = obj[firstKey];
  
  if (isJsonPrimitive(firstValue)) {
    writer.pushListItem(depth, `${encodedKey}: ${encodePrimitive(firstValue, options.delimiter)}`);
  } else if (isJsonArray(firstValue)) {
    if (isArrayOfPrimitives(firstValue)) {
      const formatted = encodeInlineArrayLine(firstValue, options.delimiter, firstKey, options.lengthMarker);
      writer.pushListItem(depth, formatted);
    } else if (isArrayOfObjects(firstValue)) {
      const header = extractTabularHeader(firstValue);
      if (header) {
        const formattedHeader = formatHeader(firstValue.length, {
          key: firstKey,
          fields: header,
          delimiter: options.delimiter,
          lengthMarker: options.lengthMarker,
        });
        writer.pushListItem(depth, formattedHeader);
        writeTabularRows(firstValue, header, writer, depth + 1, options);
      } else {
        writer.pushListItem(depth, `${encodedKey}[${firstValue.length}]:`);
        for (const item of firstValue) {
          encodeObjectAsListItem(item, writer, depth + 1, options);
        }
      }
    } else {
      writer.pushListItem(depth, `${encodedKey}[${firstValue.length}]:`);
      for (const item of firstValue) {
        encodeListItemValue(item, writer, depth + 1, options);
      }
    }
  } else if (isJsonObject(firstValue)) {
    if (Object.keys(firstValue).length === 0) {
      writer.pushListItem(depth, `${encodedKey}:`);
    } else {
      writer.pushListItem(depth, `${encodedKey}:`);
      encodeObject(firstValue, writer, depth + 2, options);
    }
  }
  
  // Encode remaining keys
  for (let i = 1; i < keys.length; i++) {
    const key = keys[i];
    encodeKeyValuePair(key, obj[key], writer, depth + 1, options);
  }
}

/**
 * Encode list item value
 */
function encodeListItemValue(
  value: any,
  writer: LineWriter,
  depth: number,
  options: ReturnType<typeof resolveOptions>
): void {
  if (isJsonPrimitive(value)) {
    writer.pushListItem(depth, encodePrimitive(value, options.delimiter));
  } else if (isJsonArray(value) && isArrayOfPrimitives(value)) {
    const inline = encodeInlineArrayLine(value, options.delimiter, undefined, options.lengthMarker);
    writer.pushListItem(depth, inline);
  } else if (isJsonObject(value)) {
    encodeObjectAsListItem(value, writer, depth, options);
  }
}
