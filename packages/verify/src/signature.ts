import { createPublicKey, verify as cryptoVerify, createHash } from 'node:crypto';
import { stripPrefix } from './hash.ts';

export interface RegistryKey { keyId: string; alg: string; publicKeyHex: string; issuer?: string; status?: string; validUntil?: string | null }

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export function keyIdFromHex(publicKeyHex: string): string {
  const der = Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyHex, 'hex')]);
  return 'g402-key-' + createHash('sha256').update(der).digest('hex').slice(0, 16);
}

/** Ed25519 over the 32 raw bytes of canonicalBodyHash. */
export function verifyEd25519(hashHex: string, signatureHex: string, publicKeyHex: string): boolean {
  try {
    const der = Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyHex, 'hex')]);
    const pub = createPublicKey({ key: der, format: 'der', type: 'spki' });
    return cryptoVerify(null, Buffer.from(stripPrefix(hashHex), 'hex'), pub, Buffer.from(signatureHex, 'hex'));
  } catch { return false; }
}

export function findKey(keys: RegistryKey[], keyId: string): RegistryKey | null {
  for (const k of keys) {
    if (k.keyId !== keyId) continue;
    if (k.alg !== 'ed25519') continue;
    if (keyIdFromHex(k.publicKeyHex) !== keyId) continue; // registry entry must be self-consistent
    return k;
  }
  return null;
}
