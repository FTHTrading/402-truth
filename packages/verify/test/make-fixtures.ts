// Generates the public test vectors from a throwaway Control API instance with a throwaway issuer key.
// Every positive fixture is a receipt the reference issuer actually produced; every negative fixture
// is a documented mutation of one. Output: test/fixtures/*.json and spec/.../examples/*.json.
//   node test/make-fixtures.ts
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createApp } = require('../../../CONTROL_API_NOT_IN_THIS_REPO/server.js');
const { privateKeyToAccount, generatePrivateKey } = require('viem/accounts');
const { canonicalize } = require('../../../CONTROL_API_NOT_IN_THIS_REPO/canonical.js');
const x402 = require('../../../CONTROL_API_NOT_IN_THIS_REPO/x402.js');

const FIX = resolve(import.meta.dirname, 'fixtures');
const EX = resolve(import.meta.dirname, '../../../spec/genesis402-receipt-v1/examples');
mkdirSync(FIX, { recursive: true }); mkdirSync(EX, { recursive: true });
const TREASURY = '0x7d9a65d06dcc435a52d5880c6310bd6e96c156db';
const CHALLENGE = { x402Version: 2, error: 'Payment required', accepts: [{ scheme: 'exact', network: 'eip155:8453', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', maxAmountRequired: '250000', payTo: TREASURY, resource: 'https://twin.unykorn.org/genesis-sim' }] };
const tmp = mkdtempSync(join(tmpdir(), 'g402-fix-'));
const app = createApp({ dbFile: join(tmp, 'c.sqlite'), keyDir: join(tmp, 'keys'), offline: true });
const a = await app.listen(0); const B = 'http://127.0.0.1:' + a.port;
const j = async (p: string, b?: unknown) => { const r = await fetch(B + p, { method: b ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return r.json(); };
const write = (dir: string, name: string, obj: unknown) => writeFileSync(join(dir, name), JSON.stringify(obj, null, 2) + '\n');
const clone = (o: unknown) => JSON.parse(JSON.stringify(o));

// --- positive path -------------------------------------------------------------------------
const deal = await j('/deals', { name: 'FIXTURE-001 — Construction Draw', assetType: 'construction_draw', by: 'fixtures' });
const ev1 = await j('/deals/' + deal.id + '/evidence', { name: 'Draw request.txt', kind: 'draw request', text: 'draw request fixture', by: 'fixtures' });
await j('/deals/' + deal.id + '/evidence', { name: 'Lien waiver.txt', kind: 'lien waiver', text: 'lien waiver fixture', by: 'fixtures' });
const man = await j('/deals/' + deal.id + '/manifest', { by: 'fixtures' });                    // seals segment 1

const acct = privateKeyToAccount(generatePrivateKey());
const ts = new Date().toISOString();
const regMsg = canonicalize({ purpose: 'unykorn-control.twin.register', id: 'fixture-settle', address: acct.address, ts });
await j('/twins/register', { id: 'fixture-settle', role: 'settlement', address: acct.address, ts, signature: await acct.signMessage({ message: regMsg }) });
const refusedQuote = await j('/payments/quote', { twinId: 'fixture-settle', url: 'https://twin.unykorn.org/genesis-sim', challenge: CHALLENGE });   // RECIPIENT_UNKNOWN -> payment.refused
await j('/recipients', { address: TREASURY, label: 'Genesis402 treasury', by: 'fixtures' });
await j('/recipients/' + TREASURY + '/approve', { by: 'fixtures', acceptUnchecked: true });
const tw = (await j('/twins')).find((t: any) => t.id === 'fixture-settle');
const rulepack = tw.policy; rulepack.destinationRules.allowedRecipients = [TREASURY]; rulepack.approval.requireOperatorAlways = false; rulepack.approval.requireOperatorAboveAtomic = '1000000';
await j('/twins/fixture-settle/policy', { policy: rulepack, by: 'fixtures' });
const q = await j('/payments/quote', { twinId: 'fixture-settle', url: 'https://twin.unykorn.org/genesis-sim', challenge: CHALLENGE });
const auth = x402.buildAuthorization({ from: acct.address, to: TREASURY, valueAtomic: '250000', nonce: q.nonce });
const authorized = await j('/payments/' + q.paymentId + '/authorize', { twinId: 'fixture-settle', authorization: auth, signature: await x402.signAuthorization(acct, auth) });

// expired: a dry-run whose validBefore is already past, issued directly by the issuer
const expired = app.receipts.issue('payment.dry_run', 'pay_fixture_expired', { paymentId: 'pay_fixture_expired', note: 'fixture' },
  { mode: 'DRY_RUN', truthLabels: ['VERIFIED', 'PROJECTION'], subjectType: 'payment', stateMachineId: 'x402-payment-delivery', scope: 'fixture', statement: 'expired fixture',
    binding: { requestHash: 'sha256:' + 'a'.repeat(64), responseHash: null, nonce: '0x' + 'b'.repeat(64) }, decision: { outcome: 'AUTHORIZED_NOT_SUBMITTED', reasonCodes: ['POLICY.OK'] }, expiresAt: '2026-01-01T00:00:00.000Z' });

// revoked: evidence receipt revoked by the operator
const revEvent = await j('/receipts/' + ev1.receiptId + '/revoke', { reasonCode: 'SUBJECT.EVIDENCE.WITHDRAWN', by: 'fixtures', note: 'fixture revocation' });
// superseded: the manifest is superseded by a second manifest
const man2 = await j('/deals/' + deal.id + '/manifest', { by: 'fixtures' });                   // seals segment 2 (includes revocation event + refusal + dry-run + expired)
const supEvent = await j('/receipts/' + man.receiptId + '/supersede', { reasonCode: 'ISSUER.ERROR.CORRECTED', supersededByReceiptId: man2.receiptId, by: 'fixtures' });
await j('/receipts/seal', { by: 'fixtures' });                                                  // seals segment 3 (supersession event)

const keys = await j('/keys');
const ledger = await j('/ledger');
const events = await j('/receipts/events');
const eventReceipts = ledger.filter((r: any) => String(r.kind).startsWith('receipt.'));
const bundleOf = async (id: string) => j('/receipts/' + id + '/bundle');
const pick = (id: string) => ledger.find((r: any) => r.receiptId === id);

const authorizedR = pick(authorized.receiptId), refusedR = pick(refusedQuote.refusalReceiptId), expiredR = pick(expired.id), revokedR = pick(ev1.receiptId), supersededR = pick(man.receiptId);
write(EX, 'receipt-authorized.json', authorizedR); write(EX, 'receipt-refused.json', refusedR); write(EX, 'receipt-expired.json', expiredR);
write(EX, 'receipt-revoked.json', revokedR); write(EX, 'receipt-superseded.json', supersededR); write(EX, 'keys.json', keys); write(EX, 'lifecycle-events.json', eventReceipts);
write(EX, 'bundle-authorized.json', await bundleOf(authorized.receiptId));

const segOf = (r: any) => ({ id: r.integrity.segmentId, root: r.integrity.segmentRoot });
const F = FIX;
write(F, 'keys.json', keys); write(F, 'events.json', eventReceipts); write(F, 'ledger.json', ledger); write(F, 'rulepack.json', rulepack);
write(F, 'request-authorized.json', { url: 'https://twin.unykorn.org/genesis-sim', method: 'GET', amountAtomic: '250000', payTo: TREASURY });
write(F, 'valid-authorized-receipt.json', authorizedR); write(F, 'valid-refusal-receipt.json', refusedR);
write(F, 'valid-revocation-chain.json', { receipt: revokedR, events: eventReceipts });
write(F, 'valid-supersession-chain.json', { receipt: supersededR, events: eventReceipts, ledger });
write(F, 'valid-bundle.json', await bundleOf(authorized.receiptId));
write(F, 'segment-authorized.json', segOf(authorizedR));
write(F, 'expired-receipt.json', expiredR);

// --- negative mutations ----------------------------------------------------------------------
const t1 = clone(authorizedR); t1.body.amountAtomic = '250001'; write(F, 'tampered-payload.json', t1);
const t2 = clone(authorizedR); t2.issuer.signature = t2.issuer.signature.replace(/^(.)/, (c: string) => (c === 'a' ? 'b' : 'a')); write(F, 'wrong-signature.json', t2);
const t3 = clone(authorizedR); t3.issuer.keyId = 'g402-key-0000000000000000'; write(F, 'unknown-key.json', t3);
const t4 = clone(authorizedR); t4.receiptVersion = 'genesis402-receipt-v0'; write(F, 'unsupported-version.json', t4);
const t5 = clone(authorizedR); t5.claim.limitations = ['custom only']; write(F, 'missing-limitations.json', t5);
const t6 = clone(authorizedR); t6.truthLabels = ['VERIFIED', 'ANCHORED']; write(F, 'illegal-truth-label.json', t6);
const t7 = clone(authorizedR); t7.integrity.inclusionProof = t7.integrity.inclusionProof.map((s: any) => ({ ...s, side: s.side === 'left' ? 'right' : 'left' })); write(F, 'broken-merkle-proof.json', t7);
write(F, 'wrong-request-binding.json', { url: 'https://twin.unykorn.org/genesis-sim', method: 'POST', amountAtomic: '250000', payTo: TREASURY });
const t8 = clone(authorizedR); t8.mode = 'LIVE'; t8.truthLabels = ['VERIFIED', 'CONFIRMED']; write(F, 'live-without-txhash.json', t8);
const reused = clone(ledger); const dup = clone(authorizedR); dup.receiptId = 'g402_rcpt_ffffffffffff'; dup.workflow.sequence = ledger.length + 1; dup.workflow.previousReceiptHash = ledger[ledger.length - 1].integrity.canonicalBodyHash; reused.push(dup); write(F, 'reused-nonce-ledger.json', reused);
const gap = clone(ledger); gap.splice(2, 1); write(F, 'broken-chain-ledger.json', gap);
const circA = clone(supersededR); const circEv = clone(eventReceipts);
const supEv = circEv.find((e: any) => e.kind === 'receipt.superseded'); const circBack = clone(supEv); circBack.receiptId = 'g402_rcpt_eeeeeeeeeeee'; circBack.subject.id = man2.receiptId; circBack.body.subjectReceiptId = man2.receiptId; circBack.body.supersededByReceiptId = man.receiptId; delete circBack.body.subjectCanonicalBodyHash; circEv.push(circBack);
write(F, 'circular-supersession.json', { receipt: circA, events: circEv, ledger: clone(ledger) });

app.server.close(); app.db.close(); rmSync(tmp, { recursive: true, force: true });
console.log('fixtures written:', F, 'and', EX, '| ledger', ledger.length, 'receipts | events', events.length);
