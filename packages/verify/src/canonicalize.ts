// CANONICALIZATION_SPEC.md — sorted keys, no whitespace, undefined dropped, bigint as decimal string.
export function canonicalize(v: unknown): string {
  if (v === null || typeof v === 'number' || typeof v === 'boolean') return JSON.stringify(v);
  if (typeof v === 'bigint') return JSON.stringify(v.toString());
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map((x) => (x === undefined ? 'null' : canonicalize(x))).join(',') + ']';
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(o[k])).join(',') + '}';
  }
  throw new TypeError('cannot canonicalize ' + typeof v);
}
