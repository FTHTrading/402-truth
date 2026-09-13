// Schema checks for genesis402-receipt-v1. Pure functions; no I/O.
import { canonicalize } from './canonicalize.ts';
import { hashCanonical } from './hash.ts';
import { leafHash } from './merkle.ts';

export const RECEIPT_VERSION = 'genesis402-receipt-v1';
export const ISSUE_LABELS = ['OBSERVED', 'ATTESTED', 'VERIFIED', 'CONFIRMED', 'PENDING', 'REFUSED', 'PROJECTION'] as const;
export const DERIVED_LABELS = ['ANCHORED', 'REVOKED', 'SUPERSEDED', 'EXPIRED'] as const;
export const MODES = ['LOCAL', 'DRY_RUN', 'TESTNET', 'LIVE', 'SIMULATED'] as const;
export const STATE_MACHINES: Record<string, string> = { 'x402-payment-delivery': '1.0.0', 'task-execution': '1.0.0', 'evidence-manifest': '1.0.0', 'receipt-lifecycle': '1.0.0' };
export const STANDARD_LIMITATIONS = [
  'Authorized does not mean universally right. Refused does not mean universally wrong. Each receipt reports an outcome under a declared scope, evidence state, policy version, and time.',
  'This receipt does not establish universal truth, legal compliance, ownership, or the correctness of third-party content.',
  'This receipt is valid only for the declared subject, policy, time window, and evidence set.',
  'Not a legal opinion or guarantee.'
];
export const COMPANION_RULE = STANDARD_LIMITATIONS[0];
const TOP_LEVEL = ['receiptVersion', 'receiptId', 'kind', 'mode', 'truthLabels', 'workflow', 'subject', 'claim', 'evidence', 'policy', 'decision', 'binding', 'body', 'lifecycle', 'issuer', 'integrity'];

export interface Finding { code: string; detail?: string }
export type Receipt = Record<string, any>;

export function schemaCheck(r: Receipt): Finding[] {
  const f: Finding[] = [];
  const miss = (p: string) => f.push({ code: 'SCHEMA.FIELD.MISSING', detail: p });
  const bad = (p: string, why?: string) => f.push({ code: 'SCHEMA.FIELD.INVALID', detail: p + (why ? ': ' + why : '') });
  if (!r || typeof r !== 'object') return [{ code: 'SCHEMA.FIELD.INVALID', detail: 'receipt is not an object' }];
  if (r.receiptVersion !== RECEIPT_VERSION) return [{ code: 'SCHEMA.VERSION.UNSUPPORTED', detail: String(r.receiptVersion) }];
  for (const k of Object.keys(r)) if (!TOP_LEVEL.includes(k)) bad(k, 'unknown top-level field');
  if (!/^g402_rcpt_[0-9a-f]{12}$/.test(String(r.receiptId))) bad('receiptId');
  if (!/^[a-z0-9_]+(\.[a-z0-9_]+)+$/.test(String(r.kind))) bad('kind');
  if (!MODES.includes(r.mode)) bad('mode', String(r.mode));
  if (!Array.isArray(r.truthLabels) || !r.truthLabels.length) miss('truthLabels');
  else for (const l of r.truthLabels) {
    if ((DERIVED_LABELS as readonly string[]).includes(l)) f.push({ code: 'SCHEMA.LABEL.ILLEGAL', detail: l + ' is derived, cannot be asserted at issuance' });
    else if (!(ISSUE_LABELS as readonly string[]).includes(l)) f.push({ code: 'SCHEMA.LABEL.ILLEGAL', detail: l });
  }
  if (Array.isArray(r.truthLabels)) {
    if ((r.mode === 'LOCAL' || r.mode === 'DRY_RUN') && r.truthLabels.includes('CONFIRMED')) f.push({ code: 'SCHEMA.LABEL.ILLEGAL', detail: 'CONFIRMED not allowed in mode ' + r.mode });
    if (r.mode === 'SIMULATED' && (r.truthLabels.includes('VERIFIED') || r.truthLabels.includes('CONFIRMED'))) f.push({ code: 'SCHEMA.LABEL.ILLEGAL', detail: 'VERIFIED/CONFIRMED not allowed in SIMULATED' });
    if (r.mode === 'LIVE' && r.truthLabels.includes('PROJECTION')) f.push({ code: 'SCHEMA.LABEL.ILLEGAL', detail: 'PROJECTION not allowed in LIVE' });
  }
  const w = r.workflow || {};
  if (!w.id) miss('workflow.id');
  if (!STATE_MACHINES[w.stateMachineId]) bad('workflow.stateMachineId', String(w.stateMachineId));
  else if (w.stateMachineVersion !== STATE_MACHINES[w.stateMachineId]) bad('workflow.stateMachineVersion');
  if (!Number.isInteger(w.sequence) || w.sequence < 1) bad('workflow.sequence');
  if (!/^sha256:[0-9a-f]{64}$/.test(String(w.previousReceiptHash))) bad('workflow.previousReceiptHash');
  if (!r.subject || !r.subject.type || !r.subject.id) miss('subject');
  const c = r.claim || {};
  if (!c.scope) miss('claim.scope');
  if (!c.statement) miss('claim.statement');
  if (!Array.isArray(c.limitations)) miss('claim.limitations');
  else for (const s of STANDARD_LIMITATIONS) if (!c.limitations.includes(s)) f.push({ code: 'SCHEMA.LIMITATIONS.MISSING', detail: s.slice(0, 40) + '…' });
  const e = r.evidence || {};
  if (!['METADATA_ONLY', 'HASH_ONLY', 'ENCRYPTED_REF'].includes(e.classification)) bad('evidence.classification');
  if (e.root !== null && !/^sha256:[0-9a-f]{64}$/.test(String(e.root))) bad('evidence.root');
  if (r.policy !== null && (!r.policy || !r.policy.id || !r.policy.version || !/^sha256:[0-9a-f]{64}$/.test(String(r.policy.hash)))) bad('policy');
  if (r.decision !== null && (!r.decision || !r.decision.outcome || !Array.isArray(r.decision.reasonCodes))) bad('decision');
  if (String(r.kind).startsWith('payment.')) {
    if (!r.binding || !r.binding.requestHash) f.push({ code: 'BINDING.MISSING', detail: 'payment receipts require binding.requestHash' });
    if (r.mode === 'LIVE' && (!r.binding || !r.binding.responseHash)) f.push({ code: 'MODE.LIVE.UNSUPPORTED_CLAIM', detail: 'LIVE payment without binding.responseHash' });
    if (r.mode === 'LIVE' && Array.isArray(r.truthLabels) && r.truthLabels.includes('CONFIRMED') && !(r.body && r.body.txHash)) f.push({ code: 'MODE.LIVE.UNSUPPORTED_CLAIM', detail: 'CONFIRMED without body.txHash' });
  }
  if (!r.body || typeof r.body !== 'object') miss('body');
  const lc = r.lifecycle || {};
  if (lc.statusAtIssuance !== 'ACTIVE') bad('lifecycle.statusAtIssuance');
  if (lc.revocationStatusAtIssuance !== 'NOT_REVOKED') bad('lifecycle.revocationStatusAtIssuance');
  if (!lc.issuedAt || isNaN(Date.parse(lc.issuedAt))) bad('lifecycle.issuedAt');
  if (lc.expiresAt !== null && (lc.expiresAt === undefined || isNaN(Date.parse(lc.expiresAt)))) bad('lifecycle.expiresAt');
  const is = r.issuer || {};
  if (!is.id) miss('issuer.id');
  if (!/^g402-key-[0-9a-f]{16}$/.test(String(is.keyId))) bad('issuer.keyId');
  if (is.alg !== 'ed25519') bad('issuer.alg');
  if (!/^[0-9a-f]{128}$/.test(String(is.signature))) bad('issuer.signature');
  return f;
}

export function signableEnvelope(r: Receipt): Receipt {
  const { integrity, ...rest } = r;
  const issuer = { ...(rest.issuer || {}) }; delete issuer.signature;
  return { ...rest, issuer };
}
export function leafBytes(r: Receipt): string { const { integrity, ...rest } = r; return canonicalize(rest); }
export function computeCanonicalBodyHash(r: Receipt): string { return hashCanonical(signableEnvelope(r)); }
export function computeLeafHash(r: Receipt): string { return leafHash(leafBytes(r)).toString('hex'); }
