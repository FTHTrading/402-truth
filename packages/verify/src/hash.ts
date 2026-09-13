import { createHash } from 'node:crypto';
import { canonicalize } from './canonicalize.ts';

export function sha256(data: Buffer | string): Buffer { return createHash('sha256').update(data).digest(); }
export function sha256hex(data: Buffer | string): string { return sha256(data).toString('hex'); }
export function hashCanonical(obj: unknown): string { return 'sha256:' + sha256hex(canonicalize(obj)); }
export function stripPrefix(h: string): string { return h.replace(/^sha256:/, ''); }
