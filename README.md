# TOON Package

**Token-Oriented Object Notation** - A compact, human-readable encoding of the JSON data model for LLM prompts with **30-60% token savings**.

TOON is a lossless serialization format designed to reduce token usage when sending data to Large Language Models, while maintaining readability and preserving all data integrity.

## Features

- ✅ **Lossless encoding**: Perfect round-trip conversion (`deserialize(serialize(obj)) === obj`)
- ✅ **30-60% token savings** compared to JSON for LLM prompts
- ✅ **Tabular arrays**: Efficient representation for uniform arrays of objects
- ✅ **Indentation-based**: Human-readable format similar to YAML
- ✅ **TypeScript support**: Full type definitions included
- ✅ **Token counting**: Built-in utilities to measure token savings
- ✅ **Zero dependencies**: Lightweight and fast
- ✅ **Browser & Node.js**: Works in both environments

## Installation

```bash
npm install @mhriyad/toon-package
yarn add @mhriyad/toon-package
pnpm add @mhriyad/toon-package
```

## Quick Start

### Programmatic Usage

```typescript
import { serialize, deserialize, countTokens } from '@mhriyad/toon-package';

// Serialize JSON to TOON
const json = {
  users: [
    { name: "Alice", age: 30, city: "New York" },
    { name: "Bob", age: 25, city: "San Francisco" },
    { name: "Charlie", age: 35, city: "Seattle" }
  ]
};

const toon = serialize(json);
console.log(toon);
// Output:
// [3]
//   name
//     Alice
//       Bob
//         Charlie
//   age
//     30
//       25
//         35
//   city
//     New York
//       San Francisco
//         Seattle

// Or tabular format (default for uniform arrays):
// [3]
//   name,age,city
//   Alice,30,New York
//   Bob,25,San Francisco
//   Charlie,35,Seattle

// Deserialize TOON back to JSON
const decoded = deserialize(toon);
console.log(JSON.stringify(decoded, null, 2));

// Calculate token savings
const jsonStr = JSON.stringify(json);
const stats = countTokens(toon, jsonStr);
console.log(`Saved ${stats.savings.tokensPercent.toFixed(1)}% tokens!`);
```

## API Reference

### `serialize(obj: any, options?: EncodeOptions): string`

Converts a JavaScript object to TOON format.

**Options:**
- `delimiter?: ',' | '\t' | '|'` - Delimiter for tabular arrays (default: `','`)
- `pretty?: boolean` - Pretty-print with indentation (default: `true`)
- `strictArrays?: boolean` - Validate array lengths match `[N]` markers (default: `false`)
- `minTabularLength?: number` - Minimum array length to use tabular format (default: `2`)

**Example:**
```typescript
import { serialize } from '@mhriyad/toon-package';

const obj = { name: "John", age: 30 };
const toon = serialize(obj, { pretty: true });
```

### `deserialize(toonStr: string, options?: DecodeOptions): any`

Parses a TOON format string into a JavaScript object.

**Options:**
- `strict?: boolean` - Strict mode: throw errors on syntax issues (default: `false`)

**Example:**
```typescript
import { deserialize } from '@mhriyad/toon-package';

const toon = '[2]\n  name,age\n  Alice,30\n  Bob,25';
const obj = deserialize(toon);
```

### `countTokens(toonStr: string, jsonStr: string, tokenizer?: Tokenizer): TokenStats`

Calculates token and character savings between TOON and JSON representations.

**Returns:**
```typescript
interface TokenStats {
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
```

**Example:**
```typescript
import { countTokens } from '@mhriyad/toon-package';

const stats = countTokens(toonStr, jsonStr);
console.log(`Token savings: ${stats.savings.tokensPercent.toFixed(1)}%`);
```

## TOON Format Examples

### Simple Objects

```json
{
  "name": "John",
  "age": 30,
  "active": true
}
```

**TOON:**
```
name: John
age: 30
active: true
```

### Nested Objects

```json
{
  "user": {
    "name": "Alice",
    "settings": {
      "theme": "dark",
      "lang": "en"
    }
  }
}
```

**TOON:**
```
user:
  name: Alice
  settings:
    theme: dark
    lang: en
```

### Arrays of Primitives

```json
{
  "tags": ["javascript", "typescript", "node"]
}
```

**TOON:**
```
tags:
  [3]
    javascript
      typescript
        node
```

### Tabular Arrays (Uniform Objects)

```json
{
  "users": [
    { "name": "Alice", "age": 30, "city": "NYC" },
    { "name": "Bob", "age": 25, "city": "SF" },
    { "name": "Charlie", "age": 35, "city": "LA" }
  ]
}
```

**TOON (tabulated):**
```
users:
  [3]
    name,age,city
    Alice,30,NYC
    Bob,25,SF
    Charlie,35,LA
```

### Mixed Types

```json
{
  "id": 123,
  "name": "Test",
  "tags": ["a", "b"],
  "metadata": {
    "created": "2024-01-01",
    "active": true
  }
}
```

**TOON:**
```
id: 123
name: Test
tags:
  [2]
    a
      b
metadata:
  created: "2024-01-01"
  active: true
```

## When to Use TOON

### ✅ Best For:
- **LLM prompts**: Reduce token costs by 30-60%
- **Uniform data structures**: Arrays of objects with same keys
- **API responses**: Large datasets sent to AI models
- **Configuration files**: Human-readable structured data

### ⚠️ Limitations:
- **Deeply nested data**: Less efficient for very deep hierarchies
- **Non-uniform arrays**: Tabular format only works for uniform object arrays
- **Special characters**: Some edge cases with strings containing delimiters

## Token Savings Examples

### Example 1: User List

**JSON (127 chars, ~32 tokens):**
```json
{"users":[{"name":"Alice","age":30},{"name":"Bob","age":25}]}
```

**TOON (58 chars, ~15 tokens):**
```
users:
  [2]
    name,age
    Alice,30
    Bob,25
```

**Savings: ~53% tokens, ~54% chars**

### Example 2: Complex Nested Structure

For structures with many repeated keys, TOON's tabular format provides significant savings, especially with longer arrays.

## Error Handling

```typescript
import { serialize, deserialize, SerializeError, DeserializeError } from '@mhriyad/toon-package';

try {
  const obj = { circular: {} };
  obj.circular = obj; // Circular reference
  serialize(obj); // Throws SerializeError
} catch (error) {
  if (error instanceof SerializeError) {
    console.error('Serialization error:', error.message);
  }
}

try {
  deserialize('invalid toon'); // Throws DeserializeError
} catch (error) {
  if (error instanceof DeserializeError) {
    console.error('Deserialization error:', error.message);
  }
}
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  EncodeOptions,
  DecodeOptions,
  TokenStats,
  Delimiter,
  Tokenizer
} from '@mhriyad/toon-package';
```

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run watch
```

### Clean

```bash
npm run clean
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Related

- [TOON Format Specification](https://github.com/toon-format/toon)
- [JSON to TOON Converter](https://jsontotoon.com/)

## Why TOON?

When working with LLMs, every token counts. TOON provides:

1. **Lower costs**: 30-60% reduction in token usage means lower API costs
2. **Faster responses**: Fewer tokens to process means faster LLM responses
3. **Better context**: More room in context window for actual prompts
4. **Lossless**: No data loss when converting between JSON and TOON
5. **Readable**: Still human-readable for debugging and inspection

Perfect for applications that frequently send structured data to LLMs!
