import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifyReceipt, verifyChain, verifyBundle } from '../src/verify.ts';
import { supersessionChain } from '../src/lifecycle.ts';
import { canonicalize } from '../src/canonicalize.ts';
import { COMPANION_RULE } from '../src/receipt.ts';

const F = resolve(import.meta.dirname, 'fixtures');
const rd = (n: string) => JSON.parse(readFileSync(resolve(F, n), 'utf8'));
const keys = rd('keys.json'); const events = rd('events.json'); const ledger = rd('ledger.json');
const codes = (r: { findings: { code: string }[] }) => r.findings.map((f) => f.code);

test('canonicalization test vector from CANONICALIZATION_SPEC.md', () => {
  assert.equal(canonicalize({ b: '1', a: [1, { z: 'x', y: null }] }), '{"a":[1,{"y":null,"z":"x"}],"b":"1"}');
});

test('valid authorized receipt: every check VALID, status ACTIVE, companion rule present', () => {
  const r = verifyReceipt(rd('valid-authorized-receipt.json'), { keys, events, rulepack: rd('rulepack.json'), request: rd('request-authorized.json') });
  assert.equal(r.overallStatus, 'VALID_WITH_LIMITATIONS', JSON.stringify(r.findings));
  for (const k of ['schema', 'canonicalHash', 'signature', 'leafHash', 'inclusionProof', 'policyBinding', 'requestBinding', 'lifecycle'] as const) assert.equal(r.checks[k], 'VALID', k);
  assert.equal(r.checks.responseBinding, 'SKIPPED');
  assert.equal(r.lifecycle, 'ACTIVE'); assert.equal(r.anchor, 'UNANCHORED'); assert.equal(r.limitationsPresent, true);
  assert.deepEqual(r.truthLabels, ['VERIFIED', 'PROJECTION']); assert.equal(r.mode, 'DRY_RUN');
  assert.equal(r.companionRule, COMPANION_RULE);
});

test('valid refusal receipt verifies and carries the policy reason code', () => {
  const rc = rd('valid-refusal-receipt.json');
  const r = verifyReceipt(rc, { keys, events });
  assert.equal(r.overallStatus, 'VALID_WITH_LIMITATIONS', JSON.stringify(r.findings));
  assert.deepEqual(rc.decision.reasonCodes, ['POLICY.RECIPIENT_UNKNOWN']);
  assert.ok(rc.truthLabels.includes('REFUSED'));
});

test('bundle verifies offline with --trust-bundle-keys, and is rejected without any key', () => {
  const b = rd('valid-bundle.json');
  assert.equal(verifyBundle(b, { trustBundleKeys: true }).overallStatus, 'VALID_WITH_LIMITATIONS');
  const r = verifyBundle(b, {});
  assert.equal(r.overallStatus, 'INVALID'); assert.ok(codes(r).includes('SIGNATURE.KEY.UNKNOWN'));
});

test('lifecycle: revoked receipt reports REVOKED with the event applied; requireActive fails it', () => {
  const { receipt } = rd('valid-revocation-chain.json');
  const r = verifyReceipt(receipt, { keys, events });
  assert.equal(r.lifecycle, 'REVOKED'); assert.deepEqual(r.derivedLabels, ['REVOKED']); assert.equal(r.overallStatus, 'VALID_WITH_LIMITATIONS');
  const strict = verifyReceipt(receipt, { keys, events, requireActive: true });
  assert.equal(strict.overallStatus, 'INVALID'); assert.ok(codes(strict).includes('STATUS.NOT_ACTIVE'));
});

test('lifecycle: superseded receipt resolves its chain to the successor', () => {
  const { receipt, ledger: l } = rd('valid-supersession-chain.json');
  const r = verifyReceipt(receipt, { keys, events });
  assert.equal(r.lifecycle, 'SUPERSEDED');
  const chain = supersessionChain(receipt.receiptId, l, events);
  assert.equal(chain.chain.length, 2); assert.equal(chain.findings.length, 0);
});

test('expired receipt reports EXPIRED', () => {
  const r = verifyReceipt(rd('expired-receipt.json'), { keys, events });
  assert.equal(r.lifecycle, 'EXPIRED'); assert.equal(r.overallStatus, 'VALID_WITH_LIMITATIONS');
});

test('chain: ledger continuity VALID; a removed receipt breaks it', () => {
  const ok = verifyChain(ledger); assert.equal(ok.ok, true, JSON.stringify(ok.findings)); assert.ok(ok.count >= 8);
  const bad = verifyChain(rd('broken-chain-ledger.json'));
  assert.equal(bad.ok, false); assert.ok(bad.findings.some((f) => f.code === 'CHAIN.SEQUENCE.GAP' || f.code === 'CHAIN.PREV_HASH.MISMATCH'));
});

const NEG: [string, string, string][] = [
  ['tampered-payload.json', 'INTEGRITY.CANONICAL_HASH.MISMATCH', 'one byte of body changed'],
  ['wrong-signature.json', 'SIGNATURE.INVALID', 'signature altered'],
  ['unknown-key.json', 'SIGNATURE.KEY.UNKNOWN', 'keyId not in registry'],
  ['unsupported-version.json', 'SCHEMA.VERSION.UNSUPPORTED', 'v0'],
  ['missing-limitations.json', 'SCHEMA.LIMITATIONS.MISSING', 'standard limitations stripped'],
  ['illegal-truth-label.json', 'SCHEMA.LABEL.ILLEGAL', 'ANCHORED asserted at issuance'],
  ['broken-merkle-proof.json', 'MERKLE.PROOF.INVALID', 'proof sides flipped'],
  ['live-without-txhash.json', 'MODE.LIVE.UNSUPPORTED_CLAIM', 'LIVE+CONFIRMED without txHash']
];
for (const [file, code, why] of NEG) {
  test('rejects ' + file + ' (' + why + ') with ' + code, () => {
    const r = verifyReceipt(rd(file), { keys, events });
    assert.equal(r.overallStatus, 'INVALID');
    assert.ok(codes(r).includes(code), 'expected ' + code + ' in ' + JSON.stringify(codes(r)));
  });
}

test('rejects wrong request binding', () => {
  const r = verifyReceipt(rd('valid-authorized-receipt.json'), { keys, events, request: rd('wrong-request-binding.json') });
  assert.equal(r.checks.requestBinding, 'INVALID'); assert.ok(codes(r).includes('BINDING.REQUEST.MISMATCH'));
});

test('rejects wrong policy binding', () => {
  const rp = rd('rulepack.json'); rp.spend.perTransactionMaxAtomic = '999';
  const r = verifyReceipt(rd('valid-authorized-receipt.json'), { keys, events, rulepack: rp });
  assert.ok(codes(r).includes('POLICY.HASH.MISMATCH'));
});

test('rejects a reused nonce in a ledger', () => {
  const r = verifyChain(rd('reused-nonce-ledger.json'));
  assert.ok(r.findings.some((f) => f.code === 'CHAIN.NONCE.REUSED'));
});

test('rejects a circular supersession chain', () => {
  const { receipt, events: ev, ledger: l } = rd('circular-supersession.json');
  const chain = supersessionChain(receipt.receiptId, l, ev);
  assert.ok(chain.findings.some((f) => f.code === 'LIFECYCLE.SUPERSESSION.CIRCULAR'));
});

test('a revocation event whose subject hash does not match the receipt is flagged, not applied', () => {
  const { receipt } = rd('valid-revocation-chain.json');
  const forged = JSON.parse(JSON.stringify(events)).map((e: any) => { if (e.kind === 'receipt.revoked') e.body.subjectCanonicalBodyHash = 'sha256:' + 'c'.repeat(64); return e; });
  const r = verifyReceipt(receipt, { keys, events: forged });
  assert.ok(codes(r).includes('LIFECYCLE.EVENT.SUBJECT_HASH_MISMATCH'));
  assert.equal(r.lifecycle, 'ACTIVE');
});
