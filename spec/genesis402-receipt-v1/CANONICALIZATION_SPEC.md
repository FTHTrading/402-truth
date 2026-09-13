# Canonicalization

Deterministic serialization so that the same envelope always hashes to the same bytes.

## Rules

1. Objects: keys sorted by UTF-16 code unit order (JavaScript default sort); no whitespace.
2. Keys whose value is `undefined` are omitted. `null` is kept.
3. Arrays: element order preserved; `undefined` elements become `null`.
4. Strings: JSON string encoding (RFC 8259) as produced by `JSON.stringify`.
5. Numbers: `JSON.stringify` of the number. Money must never be a number; it is a decimal string of atomic units.
6. BigInt: serialized as its decimal string in quotes.
7. Booleans and null: literal.
8. No trailing newline. UTF-8 bytes.

This is intentionally a subset of RFC 8785 (JCS) that avoids number formatting edge cases by forbidding
non-integer numbers in receipts.

## Hash

`sha256:<64 lowercase hex>` over the UTF-8 bytes of the canonical string.

## Reference (control/canonical.js and packages/g402-verify/src/canonicalize.ts)

```js
function canonicalize(v) {
  if (v === null || typeof v === 'number' || typeof v === 'boolean') return JSON.stringify(v);
  if (typeof v === 'bigint') return JSON.stringify(v.toString());
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map((x) => (x === undefined ? 'null' : canonicalize(x))).join(',') + ']';
  const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(v[k])).join(',') + '}';
}
```

## Test vector

Input `{ "b": "1", "a": [1, { "z": "x", "y": null }] }` and `{ "a": [1, { "y": null, "z": "x" }], "b": "1" }`
both canonicalize to `{"a":[1,{"y":null,"z":"x"}],"b":"1"}`.
