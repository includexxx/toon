/**
 * TOON - Token-Oriented Object Notation
 * A compact, human-readable encoding of the JSON data model for LLM prompts
 */

export { serialize, SerializeError, encode, EncodeError } from './encode.js';
export { deserialize, DeserializeError, decode, DecodeError } from './decode.js';
export { countTokens, simpleTokenizer, charBasedTokenizer } from './tokenizer.js';
export type {
  EncodeOptions,
  DecodeOptions,
  Delimiter,
  TokenStats,
  Tokenizer,
} from './types.js';

// Re-export for convenience
export * from './types.js';
