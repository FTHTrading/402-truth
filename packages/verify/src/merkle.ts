import { sha256 } from './hash.ts';

export interface ProofStep { hash: string; side: 'left' | 'right' }

export function leafHash(data: Buffer | string): Buffer { return sha256(Buffer.concat([Buffer.from([0]), Buffer.from(data)])); }
export function nodeHash(l: Buffer, r: Buffer): Buffer { return sha256(Buffer.concat([Buffer.from([1]), l, r])); }

export function verifyProof(leafHex: string, path: ProofStep[], rootHex: string): boolean {
  if (!Array.isArray(path)) return false;
  let h = Buffer.from(leafHex, 'hex');
  for (const step of path) {
    if (!step || typeof step.hash !== 'string' || (step.side !== 'left' && step.side !== 'right')) return false;
    const s = Buffer.from(step.hash, 'hex');
    h = step.side === 'right' ? nodeHash(h, s) : nodeHash(s, h);
  }
  return h.toString('hex') === rootHex;
}
