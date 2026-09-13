// LIFECYCLE_SPEC.md — effective status by replaying event receipts. Never mutates.
import type { Receipt, Finding } from './receipt.ts';

export type Status = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'SUPERSEDED' | 'DISPUTED';
const EVENT_KINDS: Record<string, Status> = { 'receipt.revoked': 'REVOKED', 'receipt.superseded': 'SUPERSEDED', 'receipt.disputed': 'DISPUTED' };

export interface LifecycleResult { status: Status; findings: Finding[]; appliedEvents: { receiptId: string; eventType: Status; reasonCode: string | null; effectiveAt: string }[]; supersededBy: string | null }

export function effectiveStatus(receipt: Receipt, events: Receipt[], atMs: number = Date.now(), subjectHash?: string): LifecycleResult {
  const findings: Finding[] = [];
  const applied: LifecycleResult['appliedEvents'] = [];
  let status: Status = 'ACTIVE';
  let supersededBy: string | null = null;
  const lc = receipt.lifecycle || {};
  if (lc.expiresAt && Date.parse(lc.expiresAt) <= atMs) status = 'EXPIRED';
  for (const ev of events) {
    const type = EVENT_KINDS[String(ev.kind)];
    if (!type) continue;
    if (!ev.subject || ev.subject.id !== receipt.receiptId) continue;
    const body = ev.body || {};
    if (subjectHash && body.subjectCanonicalBodyHash && body.subjectCanonicalBodyHash !== subjectHash) { findings.push({ code: 'LIFECYCLE.EVENT.SUBJECT_HASH_MISMATCH', detail: ev.receiptId }); continue; }
    const eff = body.effectiveAt || lc.issuedAt;
    if (Date.parse(eff) > atMs) continue;
    applied.push({ receiptId: ev.receiptId, eventType: type, reasonCode: body.reasonCode || null, effectiveAt: eff });
    if (type === 'REVOKED') status = 'REVOKED';
    else if (type === 'SUPERSEDED' && status !== 'REVOKED') { status = 'SUPERSEDED'; supersededBy = body.supersededByReceiptId || null; }
    else if (type === 'DISPUTED' && status === 'ACTIVE') status = 'DISPUTED';
  }
  return { status, findings, appliedEvents: applied, supersededBy };
}

/** Follow supersession pointers; a cycle or >32 hops is a failure. */
export function supersessionChain(startId: string, allReceipts: Receipt[], events: Receipt[]): { chain: string[]; findings: Finding[] } {
  const chain = [startId]; const findings: Finding[] = [];
  const byId = new Map(allReceipts.map((r) => [r.receiptId, r]));
  let cur = startId;
  for (let i = 0; i < 32; i++) {
    const r = byId.get(cur); if (!r) break;
    const st = effectiveStatus(r, events);
    if (st.status !== 'SUPERSEDED' || !st.supersededBy) return { chain, findings };
    if (chain.includes(st.supersededBy)) { findings.push({ code: 'LIFECYCLE.SUPERSESSION.CIRCULAR', detail: chain.concat(st.supersededBy).join(' -> ') }); return { chain, findings }; }
    chain.push(st.supersededBy); cur = st.supersededBy;
  }
  if (chain.length > 32) findings.push({ code: 'LIFECYCLE.SUPERSESSION.CIRCULAR', detail: 'chain longer than 32' });
  return { chain, findings };
}
