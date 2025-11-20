/**
 * Constants used throughout the TOON implementation
 */

export const LIST_ITEM_MARKER = '-';
export const LIST_ITEM_PREFIX = '- ';
export const COMMA = ',';
export const COLON = ':';
export const SPACE = ' ';
export const PIPE = '|';
export const HASH = '#';
export const OPEN_BRACKET = '[';
export const CLOSE_BRACKET = ']';
export const OPEN_BRACE = '{';
export const CLOSE_BRACE = '}';
export const NULL_LITERAL = 'null';
export const TRUE_LITERAL = 'true';
export const FALSE_LITERAL = 'false';
export const BACKSLASH = '\\';
export const DOUBLE_QUOTE = '"';
export const NEWLINE = '\n';
export const CARRIAGE_RETURN = '\r';
export const TAB = '\t';

export const DELIMITERS = {
  comma: COMMA,
  tab: TAB,
  pipe: PIPE,
} as const;

export const DEFAULT_DELIMITER = DELIMITERS.comma;
export const DEFAULT_INDENT_SIZE = 2;

