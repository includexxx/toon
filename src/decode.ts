/**
 * TOON deserializer - parses TOON format string to JavaScript objects
 
 */

import { DecodeOptions } from './types';
import {
  findClosingQuote,
  findUnquotedChar,
  unescapeString,
} from './string-utils';
import {
  isBooleanOrNullLiteral,
  isNumericLiteral,
} from './validation-utils';
import {
  LIST_ITEM_PREFIX,
  OPEN_BRACKET,
  CLOSE_BRACKET,
  OPEN_BRACE,
  CLOSE_BRACE,
  COLON,
  DOUBLE_QUOTE,
  BACKSLASH,
  SPACE,
  TAB,
  PIPE,
  NULL_LITERAL,
  TRUE_LITERAL,
  FALSE_LITERAL,
  DEFAULT_DELIMITER,
  DEFAULT_INDENT_SIZE,
} from './constants';

export class DeserializeError extends Error {
  constructor(message: string, public position?: number) {
    super(message);
    this.name = 'DeserializeError';
  }
}

// Legacy export for backward compatibility
export const decode = deserialize;
export const DecodeError = DeserializeError;

/**
 * Parsed line structure
 */
interface ParsedLine {
  raw: string;
  indent: number;
  content: string;
  depth: number;
  lineNumber: number;
}

interface BlankLine {
  lineNumber: number;
  indent: number;
  depth: number;
}

/**
 * Line cursor for parsing
 */
class LineCursor {
  private lines: ParsedLine[];
  private index: number = 0;
  private blankLines: BlankLine[];

  constructor(lines: ParsedLine[], blankLines: BlankLine[] = []) {
    this.lines = lines;
    this.blankLines = blankLines;
  }

  getBlankLines(): BlankLine[] {
    return this.blankLines;
  }

  peek(): ParsedLine | undefined {
    return this.lines[this.index];
  }

  next(): ParsedLine | undefined {
    return this.lines[this.index++];
  }

  current(): ParsedLine | undefined {
    return this.index > 0 ? this.lines[this.index - 1] : undefined;
  }

  advance(): void {
    this.index++;
  }

  atEnd(): boolean {
    return this.index >= this.lines.length;
  }

  get length(): number {
    return this.lines.length;
  }

  peekAtDepth(targetDepth: number): ParsedLine | undefined {
    const line = this.peek();
    if (!line || line.depth < targetDepth) return undefined;
    if (line.depth === targetDepth) return line;
    return undefined;
  }

  hasMoreAtDepth(targetDepth: number): boolean {
    return this.peekAtDepth(targetDepth) !== undefined;
  }
}

/**
 * Compute depth from indent spaces
 */
function computeDepthFromIndent(indentSpaces: number, indentSize: number): number {
  return Math.floor(indentSpaces / indentSize);
}

/**
 * Parse source into lines with depth information
 */
function toParsedLines(source: string, indentSize: number, strict: boolean): {
  lines: ParsedLine[];
  blankLines: BlankLine[];
} {
  if (!source.trim()) {
    return { lines: [], blankLines: [] };
  }

  const lines = source.split('\n');
  const parsed: ParsedLine[] = [];
  const blankLines: BlankLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNumber = i + 1;
    let indent = 0;

    while (indent < raw.length && raw[indent] === SPACE) {
      indent++;
    }

    const content = raw.slice(indent);

    if (!content.trim()) {
      const depth = computeDepthFromIndent(indent, indentSize);
      blankLines.push({ lineNumber, indent, depth });
      continue;
    }

    const depth = computeDepthFromIndent(indent, indentSize);

    if (strict) {
      let wsEnd = 0;
      while (wsEnd < raw.length && (raw[wsEnd] === SPACE || raw[wsEnd] === TAB)) {
        wsEnd++;
      }
      if (raw.slice(0, wsEnd).includes(TAB)) {
        throw new SyntaxError(`Line ${lineNumber}: Tabs are not allowed in indentation in strict mode`);
      }
      if (indent > 0 && indent % indentSize !== 0) {
        throw new SyntaxError(`Line ${lineNumber}: Indentation must be exact multiple of ${indentSize}, but found ${indent} spaces`);
      }
    }

    parsed.push({
      raw,
      indent,
      content,
      depth,
      lineNumber,
    });
  }

  return { lines: parsed, blankLines };
}

/**
 * Parse array header line: [N] or key[N] or key[N]{fields}:
 */
interface ArrayHeader {
  key?: string;
  length: number;
  delimiter: string;
  fields?: string[];
  hasLengthMarker: boolean;
}

function parseArrayHeaderLine(content: string, defaultDelimiter: string): {
  header: ArrayHeader;
  inlineValues?: string;
} | undefined {
  // Skip if starts with quote (not an array header)
  if (content.trimStart().startsWith(DOUBLE_QUOTE)) return undefined;

  const bracketStart = content.indexOf(OPEN_BRACKET);
  if (bracketStart === -1) return undefined;

  const bracketEnd = content.indexOf(CLOSE_BRACKET, bracketStart);
  if (bracketEnd === -1) return undefined;

  let colonIndex = bracketEnd + 1;
  let braceEnd = colonIndex;

  const braceStart = content.indexOf(OPEN_BRACE, bracketEnd);
  if (braceStart !== -1 && braceStart < content.indexOf(COLON, bracketEnd)) {
    const foundBraceEnd = content.indexOf(CLOSE_BRACE, braceStart);
    if (foundBraceEnd !== -1) {
      braceEnd = foundBraceEnd + 1;
    }
  }

  colonIndex = content.indexOf(COLON, Math.max(bracketEnd, braceEnd));
  if (colonIndex === -1) return undefined;

  const key = bracketStart > 0 ? content.slice(0, bracketStart).trim() : undefined;
  const afterColon = content.slice(colonIndex + 1).trim();
  const bracketContent = content.slice(bracketStart + 1, braceEnd);

  let parsedBracket;
  try {
    parsedBracket = parseBracketSegment(bracketContent, defaultDelimiter);
  } catch {
    return undefined;
  }

  const { length, delimiter, hasLengthMarker } = parsedBracket;
  let fields: string[] | undefined;

  if (braceStart !== -1 && braceStart < colonIndex) {
    const foundBraceEnd = content.indexOf(CLOSE_BRACE, braceStart);
    if (foundBraceEnd !== -1 && foundBraceEnd < colonIndex) {
      const fieldsStr = content.slice(braceStart + 1, foundBraceEnd);
      fields = parseDelimitedValues(fieldsStr, delimiter).map((field) =>
        parseStringLiteral(field.trim())
      );
    }
  }

  return {
    header: {
      key,
      length,
      delimiter,
      fields,
      hasLengthMarker,
    },
    inlineValues: afterColon || undefined,
  };
}

/**
 * Parse bracket segment: N or #N or N\t or N|
 */
function parseBracketSegment(seg: string, defaultDelimiter: string): {
  length: number;
  delimiter: string;
  hasLengthMarker: boolean;
} {
  let hasLengthMarker = false;
  let content = seg;

  if (content.startsWith('#')) {
    hasLengthMarker = true;
    content = content.slice(1);
  }

  let delimiter = defaultDelimiter;
  if (content.endsWith(TAB)) {
    delimiter = TAB;
    content = content.slice(0, -1);
  } else if (content.endsWith(PIPE)) {
    delimiter = PIPE;
    content = content.slice(0, -1);
  }

  const length = Number.parseInt(content, 10);
  if (Number.isNaN(length)) {
    throw new TypeError(`Invalid array length: ${seg}`);
  }

  return { length, delimiter, hasLengthMarker };
}

/**
 * Parse delimited values (handling quotes)
 */
function parseDelimitedValues(input: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (char === BACKSLASH && i + 1 < input.length && inQuotes) {
      current += char + input[i + 1];
      i += 2;
      continue;
    }

    if (char === DOUBLE_QUOTE) {
      inQuotes = !inQuotes;
      current += char;
      i++;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  if (current || values.length > 0) {
    values.push(current.trim());
  }

  return values;
}

/**
 * Map row values to primitives
 */
function mapRowValuesToPrimitives(values: string[]): any[] {
  return values.map((v) => parsePrimitiveToken(v));
}

/**
 * Parse primitive token
 */
function parsePrimitiveToken(token: string): any {
  const trimmed = token.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith(DOUBLE_QUOTE)) {
    return parseStringLiteral(trimmed);
  }

  if (isBooleanOrNullLiteral(trimmed)) {
    if (trimmed === TRUE_LITERAL) return true;
    if (trimmed === FALSE_LITERAL) return false;
    if (trimmed === NULL_LITERAL) return null;
  }

  if (isNumericLiteral(trimmed)) {
    return Number.parseFloat(trimmed);
  }

  return trimmed;
}

/**
 * Parse string literal
 */
function parseStringLiteral(token: string): string {
  const trimmed = token.trim();
  if (trimmed.startsWith(DOUBLE_QUOTE)) {
    const closingQuoteIndex = findClosingQuote(trimmed, 0);
    if (closingQuoteIndex === -1) {
      throw new SyntaxError('Unterminated string: missing closing quote');
    }
    if (closingQuoteIndex !== trimmed.length - 1) {
      throw new SyntaxError('Unexpected characters after closing quote');
    }
    return unescapeString(trimmed.slice(1, closingQuoteIndex));
  }
  return trimmed;
}

/**
 * Parse unquoted key
 */
function parseUnquotedKey(content: string, start: number): { key: string; end: number } {
  let end = start;
  while (end < content.length && content[end] !== COLON) {
    end++;
  }
  if (end >= content.length || content[end] !== COLON) {
    throw new SyntaxError('Missing colon after key');
  }
  const key = content.slice(start, end).trim();
  end++;
  return { key, end };
}

/**
 * Parse quoted key
 */
function parseQuotedKey(content: string, start: number): { key: string; end: number } {
  const closingQuoteIndex = findClosingQuote(content, start);
  if (closingQuoteIndex === -1) {
    throw new SyntaxError('Unterminated quoted key');
  }
  const key = unescapeString(content.slice(start + 1, closingQuoteIndex));
  let end = closingQuoteIndex + 1;
  if (end >= content.length || content[end] !== COLON) {
    throw new SyntaxError('Missing colon after key');
  }
  end++;
  return { key, end };
}

/**
 * Parse key token
 */
function parseKeyToken(content: string, start: number): { key: string; end: number } {
  if (content[start] === DOUBLE_QUOTE) {
    return parseQuotedKey(content, start);
  } else {
    return parseUnquotedKey(content, start);
  }
}

/**
 * Check if array header appears after hyphen
 */
function isArrayHeaderAfterHyphen(content: string): boolean {
  return content.trim().startsWith(OPEN_BRACKET) && findUnquotedChar(content, COLON) !== -1;
}

/**
 * Check if object first field appears after hyphen
 */
function isObjectFirstFieldAfterHyphen(content: string): boolean {
  return findUnquotedChar(content, COLON) !== -1;
}

/**
 * Assert expected count in strict mode
 */
function assertExpectedCount(
  actual: number,
  expected: number,
  itemType: string,
  options: { strict?: boolean }
): void {
  if (options.strict && actual !== expected) {
    throw new RangeError(`Expected ${expected} ${itemType}, but got ${actual}`);
  }
}

/**
 * Check if line is a data row (not a key-value pair)
 */
function isDataRow(content: string, delimiter: string): boolean {
  const colonPos = content.indexOf(COLON);
  const delimiterPos = content.indexOf(delimiter);
  if (colonPos === -1) return true;
  if (delimiterPos !== -1 && delimiterPos < colonPos) return true;
  return false;
}

/**
 * Main decode function
 */
export function deserialize(toonStr: string, options?: DecodeOptions): any {
  const resolvedOptions = {
    indent: DEFAULT_INDENT_SIZE,
    strict: options?.strict ?? false,
  };

  const scanResult = toParsedLines(toonStr, resolvedOptions.indent, resolvedOptions.strict);
  if (scanResult.lines.length === 0) {
    throw new TypeError('Cannot decode empty input: input must be a non-empty string');
  }

  const cursor = new LineCursor(scanResult.lines, scanResult.blankLines);
  return decodeValueFromLines(cursor, resolvedOptions);
}

/**
 * Decode value from lines
 */
function decodeValueFromLines(cursor: LineCursor, options: { indent: number; strict: boolean }): any {
  const first = cursor.peek();
  if (!first) {
    throw new ReferenceError('No content to decode');
  }

  if (isArrayHeaderAfterHyphen(first.content)) {
    const headerInfo = parseArrayHeaderLine(first.content, DEFAULT_DELIMITER);
    if (headerInfo) {
      cursor.advance();
      return decodeArrayFromHeader(headerInfo.header, headerInfo.inlineValues, cursor, 0, options);
    }
  }

  if (cursor.length === 1 && !isKeyValueLine(first)) {
    return parsePrimitiveToken(first.content.trim());
  }

  return decodeObject(cursor, 0, options);
}

/**
 * Check if line is a key-value line
 */
function isKeyValueLine(line: ParsedLine): boolean {
  const content = line.content;
  if (content.startsWith('"')) {
    const closingQuoteIndex = findClosingQuote(content, 0);
    if (closingQuoteIndex === -1) return false;
    return closingQuoteIndex + 1 < content.length && content[closingQuoteIndex + 1] === COLON;
  } else {
    return content.includes(COLON);
  }
}

/**
 * Decode object
 */
function decodeObject(cursor: LineCursor, baseDepth: number, options: { indent: number; strict: boolean }): Record<string, any> {
  const obj: Record<string, any> = {};

  while (!cursor.atEnd()) {
    const line = cursor.peek();
    if (!line || line.depth < baseDepth) break;
    if (line.depth === baseDepth) {
      const [key, value] = decodeKeyValuePair(line, cursor, baseDepth, options);
      obj[key] = value;
    } else {
      break;
    }
  }

  return obj;
}

/**
 * Decode key-value pair
 */
function decodeKeyValuePair(
  line: ParsedLine,
  cursor: LineCursor,
  baseDepth: number,
  options: { indent: number; strict: boolean }
): [string, any] {
  cursor.advance();
  const { key, value } = decodeKeyValue(line.content, cursor, baseDepth, options);
  return [key, value];
}

/**
 * Decode key-value
 */
function decodeKeyValue(
  content: string,
  cursor: LineCursor,
  baseDepth: number,
  options: { indent: number; strict: boolean }
): { key: string; value: any; followDepth: number } {
  const arrayHeader = parseArrayHeaderLine(content, DEFAULT_DELIMITER);
  if (arrayHeader && arrayHeader.header.key) {
    const value = decodeArrayFromHeader(
      arrayHeader.header,
      arrayHeader.inlineValues,
      cursor,
      baseDepth,
      options
    );
    return {
      key: arrayHeader.header.key,
      value,
      followDepth: baseDepth + 1,
    };
  }

  const { key, end } = parseKeyToken(content, 0);
  const rest = content.slice(end).trim();

  if (!rest) {
    const nextLine = cursor.peek();
    if (nextLine && nextLine.depth > baseDepth) {
      return {
        key,
        value: decodeObject(cursor, baseDepth + 1, options),
        followDepth: baseDepth + 1,
      };
    }
    return {
      key,
      value: {},
      followDepth: baseDepth + 1,
    };
  }

  return {
    key,
    value: parsePrimitiveToken(rest),
    followDepth: baseDepth + 1,
  };
}

/**
 * Decode array from header
 */
function decodeArrayFromHeader(
  header: ArrayHeader,
  inlineValues: string | undefined,
  cursor: LineCursor,
  baseDepth: number,
  options: { indent: number; strict: boolean }
): any[] {
  if (inlineValues) {
    return decodeInlinePrimitiveArray(header, inlineValues, options);
  }
  if (header.fields && header.fields.length > 0) {
    return decodeTabularArray(header, cursor, baseDepth, options);
  }
  return decodeListArray(header, cursor, baseDepth, options);
}

/**
 * Decode inline primitive array
 */
function decodeInlinePrimitiveArray(
  header: ArrayHeader,
  inlineValues: string,
  options: { indent: number; strict: boolean }
): any[] {
  if (!inlineValues.trim()) {
    assertExpectedCount(0, header.length, 'inline array items', options);
    return [];
  }
  const primitives = mapRowValuesToPrimitives(parseDelimitedValues(inlineValues, header.delimiter));
  assertExpectedCount(primitives.length, header.length, 'inline array items', options);
  return primitives;
}

/**
 * Decode list array (with - prefix items)
 */
function decodeListArray(
  header: ArrayHeader,
  cursor: LineCursor,
  baseDepth: number,
  options: { indent: number; strict: boolean }
): any[] {
  const items: any[] = [];
  const itemDepth = baseDepth + 1;

  while (!cursor.atEnd() && items.length < header.length) {
    const line = cursor.peek();
    if (!line || line.depth < itemDepth) break;
    if (line.depth === itemDepth && line.content.startsWith(LIST_ITEM_PREFIX)) {
      const item = decodeListItem(cursor, itemDepth, header.delimiter, options);
      items.push(item);
    } else {
      break;
    }
  }

  assertExpectedCount(items.length, header.length, 'list array items', options);
  return items;
}

/**
 * Decode list item
 */
function decodeListItem(
  cursor: LineCursor,
  baseDepth: number,
  activeDelimiter: string,
  options: { indent: number; strict: boolean }
): any {
  const line = cursor.next();
  if (!line) {
    throw new ReferenceError('Expected list item');
  }

  const afterHyphen = line.content.slice(LIST_ITEM_PREFIX.length);

  if (isArrayHeaderAfterHyphen(afterHyphen)) {
    const arrayHeader = parseArrayHeaderLine(afterHyphen, DEFAULT_DELIMITER);
    if (arrayHeader) {
      return decodeArrayFromHeader(arrayHeader.header, arrayHeader.inlineValues, cursor, baseDepth, options);
    }
  }

  if (isObjectFirstFieldAfterHyphen(afterHyphen)) {
    return decodeObjectFromListItem(line, cursor, baseDepth, options);
  }

  return parsePrimitiveToken(afterHyphen);
}

/**
 * Decode object from list item
 */
function decodeObjectFromListItem(
  firstLine: ParsedLine,
  cursor: LineCursor,
  baseDepth: number,
  options: { indent: number; strict: boolean }
): Record<string, any> {
  const { key, value, followDepth } = decodeKeyValue(
    firstLine.content.slice(LIST_ITEM_PREFIX.length),
    cursor,
    baseDepth,
    options
  );
  const obj: Record<string, any> = { [key]: value };

  while (!cursor.atEnd()) {
    const line = cursor.peek();
    if (!line || line.depth < followDepth) break;
    if (line.depth === followDepth && !line.content.startsWith(LIST_ITEM_PREFIX)) {
      const [k, v] = decodeKeyValuePair(line, cursor, followDepth, options);
      obj[k] = v;
    } else {
      break;
    }
  }

  return obj;
}

/**
 * Decode tabular array
 */
function decodeTabularArray(
  header: ArrayHeader,
  cursor: LineCursor,
  baseDepth: number,
  options: { indent: number; strict: boolean }
): any[] {
  const objects: any[] = [];
  const rowDepth = baseDepth + 1;

  while (!cursor.atEnd() && objects.length < header.length) {
    const line = cursor.peek();
    if (!line || line.depth < rowDepth) break;
    if (line.depth === rowDepth) {
      if (!line.content.startsWith(LIST_ITEM_PREFIX) && isDataRow(line.content, header.delimiter)) {
        cursor.advance();
        const values = parseDelimitedValues(line.content, header.delimiter);
        assertExpectedCount(values.length, header.fields!.length, 'tabular row values', options);
        const primitives = mapRowValuesToPrimitives(values);
        const obj: Record<string, any> = {};
        for (let i = 0; i < header.fields!.length; i++) {
          obj[header.fields![i]] = primitives[i];
        }
        objects.push(obj);
      } else {
        break;
      }
    } else {
      break;
    }
  }

  assertExpectedCount(objects.length, header.length, 'tabular rows', options);
  return objects;
}
