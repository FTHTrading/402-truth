// Top-level verification. Offline. Every check is named; the report says VALID / INVALID / SKIPPED per check.
import { schemaCheck, computeCanonicalBodyHash, computeLeafHash, COMPANION_RULE, type Receipt, type Finding } from './receipt.ts';
import { verifyEd25519, findKey, type RegistryKey } from './signature.ts';
import { verifyProof } from './merkle.ts';
import { effectiveStatus, type Status } from './lifecycle.ts';
import { hashCanonical } from './hash.ts';

export type CheckResult = 'VALID' | 'INVALID' | 'SKIPPED';
export interface VerifyOptions {
  keys?: RegistryKey[];             // trusted issuer registry (required for a VALID signature)
  segment?: { root: string; id?: string } | null;
  events?: Receipt[];               // lifecycle event receipts
  rulepack?: unknown;               // policy document; hashCanonical must equal receipt.policy.hash
  request?: unknown;                // canonical request object; hashCanonical must equal binding.requestHash
  response?: unknown;               // canonical response object; hashCanonical must equal binding.responseHash
  requireActive?: boolean;
  atMs?: number;
}
export interface Report {
  receiptId: string; version: string; kind: string; mode: string;
  checks: { schema: CheckResult; canonicalHash: CheckResult; signature: CheckResult; leafHash: CheckResult; inclusionProof: CheckResult; policyBinding: CheckResult; requestBinding: CheckResult; responseBinding: CheckResult; lifecycle: CheckResult };
  lifecycle: Status; anchor: 'UNANCHORED'; truthLabels: string[]; derivedLabels: string[]; limitationsPresent: boolean;
  findings: Finding[]; overallStatus: 'VALID_WITH_LIMITATIONS' | 'INVALID'; companionRule: string;
}

export function verifyReceipt(receipt: Receipt, opts: VerifyOptions = {}): Report {
  const findings: Finding[] = [];
  const checks: Report['checks'] = { schema: 'INVALID', canonicalHash: 'SKIPPED', signature: 'SKIPPED', leafHash: 'SKIPPED', inclusionProof: 'SKIPPED', policyBinding: 'SKIPPED', requestBinding: 'SKIPPED', responseBinding: 'SKIPPED', lifecycle: 'SKIPPED' };
  const base = (o: 'VALID_WITH_LIMITATIONS' | 'INVALID', lifecycle: Status = 'ACTIVE', derived: string[] = []): Report => ({
    receiptId: String(receipt && receipt.receiptId), version: String(receipt && receipt.receiptVersion), kind: String(receipt && receipt.kind), mode: String(receipt && receipt.mode),
    checks, lifecycle, anchor: 'UNANCHORED', truthLabels: Array.isArray(receipt && receipt.truthLabels) ? receipt.truthLabels : [], derivedLabels: derived,
    limitationsPresent: !findings.some((f) => f.code === 'SCHEMA.LIMITATIONS.MISSING') && Boolean(receipt && receipt.claim && Array.isArray(receipt.claim.limitations)),
    findings, overallStatus: o, companionRule: COMPANION_RULE
  });

  const schema = schemaCheck(receipt);
  findings.push(...schema);
  if (schema.some((f) => f.code === 'SCHEMA.VERSION.UNSUPPORTED' || (f.code === 'SCHEMA.FIELD.INVALID' && f.detail === 'receipt is not an object'))) return base('INVALID');
  checks.schema = schema.length ? 'INVALID' : 'VALID';

  const integ = receipt.integrity || {};
  const cbh = computeCanonicalBodyHash(receipt);
  if (integ.canonicalBodyHash && integ.canonicalBodyHash !== cbh) { checks.canonicalHash = 'INVALID'; findings.push({ code: 'INTEGRITY.CANONICAL_HASH.MISMATCH', detail: 'stored ' + integ.canonicalBodyHash + ' recomputed ' + cbh }); }
  else checks.canonicalHash = 'VALID';

  const keys = opts.keys || [];
  const key = findKey(keys, String(receipt.issuer && receipt.issuer.keyId));
  if (!key) { checks.signature = 'INVALID'; findings.push({ code: 'SIGNATURE.KEY.UNKNOWN', detail: String(receipt.issuer && receipt.issuer.keyId) }); }
  else if (key.validUntil && receipt.lifecycle && Date.parse(receipt.lifecycle.issuedAt) > Date.parse(key.validUntil)) { checks.signature = 'INVALID'; findings.push({ code: 'SIGNATURE.KEY.UNKNOWN', detail: 'key retired before issuance' }); }
  else if (!verifyEd25519(cbh, String(receipt.issuer.signature), key.publicKeyHex)) { checks.signature = 'INVALID'; findings.push({ code: 'SIGNATURE.INVALID' }); }
  else checks.signature = 'VALID';

  const leaf = computeLeafHash(receipt);
  if (integ.leafHash && integ.leafHash !== leaf) { checks.leafHash = 'INVALID'; findings.push({ code: 'INTEGRITY.LEAF_HASH.MISMATCH' }); }
  else checks.leafHash = 'VALID';

  const root = (opts.segment && opts.segment.root) || integ.segmentRoot || null;
  if (root && Array.isArray(integ.inclusionProof)) {
    checks.inclusionProof = verifyProof(leaf, integ.inclusionProof, root) ? 'VALID' : 'INVALID';
    if (checks.inclusionProof === 'INVALID') findings.push({ code: 'MERKLE.PROOF.INVALID', detail: 'root ' + root });
  }

  if (receipt.policy && opts.rulepack !== undefined) {
    const h = hashCanonical(opts.rulepack);
    checks.policyBinding = h === receipt.policy.hash ? 'VALID' : 'INVALID';
    if (checks.policyBinding === 'INVALID') findings.push({ code: 'POLICY.HASH.MISMATCH', detail: 'rulepack ' + h + ' receipt ' + receipt.policy.hash });
  }
  if (receipt.binding && opts.request !== undefined) {
    const h = hashCanonical(opts.request);
    checks.requestBinding = h === receipt.binding.requestHash ? 'VALID' : 'INVALID';
    if (checks.requestBinding === 'INVALID') findings.push({ code: 'BINDING.REQUEST.MISMATCH' });
  }
  if (receipt.binding && opts.response !== undefined) {
    const h = hashCanonical(opts.response);
    checks.responseBinding = h === receipt.binding.responseHash ? 'VALID' : 'INVALID';
    if (checks.responseBinding === 'INVALID') findings.push({ code: 'BINDING.RESPONSE.MISMATCH' });
  }

  const lc = effectiveStatus(receipt, opts.events || [], opts.atMs, cbh);
  findings.push(...lc.findings);
  checks.lifecycle = lc.findings.length ? 'INVALID' : 'VALID';
  const derived: string[] = [];
  if (lc.status !== 'ACTIVE') derived.push(lc.status);
  if (opts.requireActive && lc.status !== 'ACTIVE') findings.push({ code: 'STATUS.NOT_ACTIVE', detail: lc.status });

  const invalid = Object.values(checks).includes('INVALID') || findings.some((f) => f.code === 'STATUS.NOT_ACTIVE');
  return base(invalid ? 'INVALID' : 'VALID_WITH_LIMITATIONS', lc.status, derived);
}

/** Ledger continuity: sequence increments by one and previousReceiptHash chains. */
export function verifyChain(ledger: Receipt[]): { ok: boolean; count: number; findings: Finding[]; head: string | null } {
  const findings: Finding[] = [];
  let prev = 'sha256:' + '0'.repeat(64); let expectSeq = 1; let head: string | null = null;
  const nonces = new Map<string, string>();
  for (const r of ledger) {
    const w = r.workflow || {};
    const n = r.binding && r.binding.nonce ? String(r.binding.nonce).toLowerCase() : null;
    if (n && String(r.kind).startsWith('payment.') && r.kind !== 'payment.refused') {
      if (nonces.has(n)) findings.push({ code: 'CHAIN.NONCE.REUSED', detail: n + ' in ' + nonces.get(n) + ' and ' + r.receiptId });
      else nonces.set(n, r.receiptId);
    }
    if (w.sequence !== expectSeq) findings.push({ code: 'CHAIN.SEQUENCE.GAP', detail: 'expected ' + expectSeq + ' got ' + w.sequence + ' at ' + r.receiptId });
    if (w.previousReceiptHash !== prev) findings.push({ code: 'CHAIN.PREV_HASH.MISMATCH', detail: r.receiptId });
    const cbh = computeCanonicalBodyHash(r);
    if (r.integrity && r.integrity.canonicalBodyHash && r.integrity.canonicalBodyHash !== cbh) findings.push({ code: 'INTEGRITY.CANONICAL_HASH.MISMATCH', detail: r.receiptId });
    prev = cbh; head = cbh; expectSeq = (w.sequence || expectSeq) + 1;
    if (findings.length > 50) break;
  }
  return { ok: findings.length === 0, count: ledger.length, findings, head };
}

export interface Bundle { bundleVersion: string; receipt: Receipt; segment?: { root: string; id?: string } | null; lifecycleEvents?: Receipt[]; keys?: RegistryKey[]; rulepack?: unknown; request?: unknown; response?: unknown }

export function verifyBundle(b: Bundle, opts: { keys?: RegistryKey[]; trustBundleKeys?: boolean; requireActive?: boolean; atMs?: number } = {}): Report {
  const keys = [...(opts.keys || []), ...(opts.trustBundleKeys ? (b.keys || []) : [])];
  return verifyReceipt(b.receipt, { keys, segment: b.segment || null, events: b.lifecycleEvents || [], rulepack: b.rulepack, request: b.request, response: b.response, requireActive: opts.requireActive, atMs: opts.atMs });
}
