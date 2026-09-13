# Test vectors

Produced by `node packages/g402-verify/test/make-fixtures.ts`, which starts a throwaway Control API with a
throwaway issuer key, runs one deal through evidence → manifest → twin registration → refused quote →
approved quote → DRY_RUN authorization → revocation → supersession, and writes what the issuer emitted.
Regenerating produces new keys and ids; the *shape* and the *failure codes* are what is frozen.

## Positive (must verify)

| File | What it is | Expected |
|---|---|---|
| `valid-authorized-receipt.json` | `payment.dry_run`, mode DRY_RUN, labels VERIFIED+PROJECTION, sealed | VALID_WITH_LIMITATIONS, ACTIVE |
| `valid-refusal-receipt.json` | `payment.refused`, POLICY.RECIPIENT_UNKNOWN | VALID_WITH_LIMITATIONS |
| `valid-revocation-chain.json` | `evidence.hashed` + `receipt.revoked` event | lifecycle REVOKED |
| `valid-supersession-chain.json` | manifest superseded by a second manifest | lifecycle SUPERSEDED, chain length 2 |
| `expired-receipt.json` | dry-run with `expiresAt` in the past | lifecycle EXPIRED |
| `valid-bundle.json` | `GET /receipts/{id}/bundle` output | VALID with `--trust-bundle-keys` or `--keys` |
| `ledger.json` | `GET /ledger` (all v1 receipts, ordered) | chain VALID |
| `keys.json`, `events.json`, `rulepack.json`, `request-authorized.json`, `segment-authorized.json` | inputs | — |

## Negative (must fail with the named code)

| File | Mutation | Code |
|---|---|---|
| `tampered-payload.json` | `body.amountAtomic` changed | INTEGRITY.CANONICAL_HASH.MISMATCH |
| `wrong-signature.json` | first hex char of signature flipped | SIGNATURE.INVALID |
| `unknown-key.json` | `issuer.keyId` not in registry | SIGNATURE.KEY.UNKNOWN |
| `unsupported-version.json` | `receiptVersion` = v0 | SCHEMA.VERSION.UNSUPPORTED |
| `missing-limitations.json` | standard limitations removed | SCHEMA.LIMITATIONS.MISSING |
| `illegal-truth-label.json` | `ANCHORED` asserted at issuance | SCHEMA.LABEL.ILLEGAL |
| `broken-merkle-proof.json` | proof step sides flipped | MERKLE.PROOF.INVALID |
| `live-without-txhash.json` | mode LIVE + CONFIRMED, no `body.txHash` | MODE.LIVE.UNSUPPORTED_CLAIM |
| `wrong-request-binding.json` | request object with a different method | BINDING.REQUEST.MISMATCH |
| (rulepack mutated in test) | `perTransactionMaxAtomic` changed | POLICY.HASH.MISMATCH |
| `reused-nonce-ledger.json` | second payment receipt with the same nonce | CHAIN.NONCE.REUSED |
| `broken-chain-ledger.json` | one receipt removed | CHAIN.SEQUENCE.GAP / CHAIN.PREV_HASH.MISMATCH |
| `circular-supersession.json` | A→B and B→A | LIFECYCLE.SUPERSESSION.CIRCULAR |
| (event mutated in test) | revocation event pointing at a different subject hash | LIFECYCLE.EVENT.SUBJECT_HASH_MISMATCH, event not applied |

Run: `cd packages/g402-verify && node --test test/*.test.ts` — 21 tests.
