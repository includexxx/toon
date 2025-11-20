/**
 * Type definitions for TOON package
 */

export type Delimiter = ',' | '\t' | '|';

export interface EncodeOptions {
  /**
   * Delimiter to use for tabular arrays
   * @default ','
   */
  delimiter?: Delimiter;
  
  /**
   * Pretty-print with indentation
   * @default true
   */
  pretty?: boolean;
  
  /**
   * Strict mode: validate array lengths match [N] markers
   * @default false
   */
  strictArrays?: boolean;
  
  /**
   * Minimum array length to use tabular format
   * @default 2
   */
  minTabularLength?: number;
}

export interface DecodeOptions {
  /**
   * Strict mode: throw errors on syntax issues
   * @default false
   */
  strict?: boolean;
}

export interface TokenStats {
  toonTokens: number;
  jsonTokens: number;
  toonChars: number;
  jsonChars: number;
  savings: {
    tokens: number;
    tokensPercent: number;
    chars: number;
    charsPercent: number;
  };
}

export type Tokenizer = (text: string) => number;

