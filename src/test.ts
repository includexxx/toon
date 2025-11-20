import { decode, DecodeError } from './decode';
import { encode, EncodeError } from './encode';

// Test tabular array decoding
const toon = '[2]\n  first,middle,last\n  John,,Doe\n  Jane,M,Smith';
console.log('Decoding TOON:');
console.log(toon);
console.log('\nResult:');
try {
  const result = decode(toon);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error('Error:', error);
}

// Test encoding
console.log('\n--- Encoding Test ---');
const obj = {
  users: [
    { first: 'John', middle: '', last: 'Doe' },
    { first: 'Jane', middle: 'M', last: 'Smith' }
  ]
};
const encoded = encode(obj);
console.log('Encoded TOON:');
console.log(encoded);