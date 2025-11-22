/**
 * Test script for CommonJS (require)
 * Run with: node test-local.cjs
 */

const { serialize, deserialize, countTokens } = require('./dist/index.js');

console.log('🧪 Testing @mhriyad/toon-package package (CommonJS)\n');

// Test 1: Basic serialization
console.log('Test 1: Basic serialization');
const obj1 = { name: "John", age: 30, active: true };
const toon1 = serialize(obj1);
console.log('Input:', obj1);
console.log('TOON:', toon1);
const decoded1 = deserialize(toon1);
console.log('Decoded:', decoded1);
console.log('✅ Match:', JSON.stringify(obj1) === JSON.stringify(decoded1));
console.log();

// Test 2: Nested objects
console.log('Test 2: Nested objects');
const obj2 = {
  user: {
    name: "Alice",
    settings: {
      theme: "dark",
      lang: "en"
    }
  }
};
const toon2 = serialize(obj2);
console.log('TOON:', toon2);
const decoded2 = deserialize(toon2);
console.log('✅ Match:', JSON.stringify(obj2) === JSON.stringify(decoded2));
console.log();

// Test 3: Arrays
console.log('Test 3: Arrays');
const obj3 = {
  users: [
    { name: "Alice", age: 30, city: "NYC" },
    { name: "Bob", age: 25, city: "SF" },
    { name: "Charlie", age: 35, city: "LA" }
  ]
};
const toon3 = serialize(obj3);
console.log('TOON:', toon3);
const decoded3 = deserialize(toon3);
console.log('✅ Match:', JSON.stringify(obj3) === JSON.stringify(decoded3));
console.log();

// Test 4: Token counting
console.log('Test 4: Token counting');
const jsonStr = JSON.stringify(obj3);
const stats = countTokens(toon3, jsonStr);
console.log(`TOON tokens: ${stats.toonTokens}`);
console.log(`JSON tokens: ${stats.jsonTokens}`);
console.log(`Savings: ${stats.savings.tokensPercent.toFixed(1)}%`);
console.log('✅ Token counting works');
console.log();

console.log('🎉 All tests passed!');

