/**
 * Token counting utilities for TOON package
 */

import { TokenStats, Tokenizer } from './types';

/**
 * Simple token estimator based on word/character count
 * This is a basic approximation - real tokenizers vary by model
 */
export function simpleTokenizer(text: string): number {
  // Rough approximation: ~4 characters per token
  // More accurate for English text
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const chars = text.length;
  
  // Estimate: words contribute ~0.75 tokens each, non-word chars ~0.25 tokens per char
  const wordTokens = words.length * 0.75;
  const charTokens = chars * 0.25;
  
  return Math.ceil(wordTokens + charTokens);
}

/**
 * Character-based token estimator (divide by 4)
 */
export function charBasedTokenizer(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Count tokens and calculate savings between JSON and TOON
 */
export function countTokens(
  toonStr: string,
  jsonStr: string,
  tokenizer?: Tokenizer
): TokenStats {
  const tokenize = tokenizer || simpleTokenizer;
  
  const toonTokens = tokenize(toonStr);
  const jsonTokens = tokenize(jsonStr);
  const toonChars = toonStr.length;
  const jsonChars = jsonStr.length;
  
  const tokenSavings = jsonTokens - toonTokens;
  const charSavings = jsonChars - toonChars;
  
  const tokenPercent = jsonTokens > 0 
    ? ((tokenSavings / jsonTokens) * 100) 
    : 0;
  
  const charPercent = jsonChars > 0 
    ? ((charSavings / jsonChars) * 100) 
    : 0;
  
  return {
    toonTokens,
    jsonTokens,
    toonChars,
    jsonChars,
    savings: {
      tokens: tokenSavings,
      tokensPercent: tokenPercent,
      chars: charSavings,
      charsPercent: charPercent,
    },
  };
}

