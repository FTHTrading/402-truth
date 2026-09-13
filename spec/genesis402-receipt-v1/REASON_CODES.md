# Reason codes

Stable, dotted, upper-case. A verifier and a human can both read them. Codes are never reused with a
different meaning; retire and add instead.

## Policy (from control/policy.js, prefixed `POLICY.` in receipts)

| Code | Meaning |
|---|---|
| POLICY.OK | All declared checks satisfied |
| POLICY.NEEDS_APPROVAL | Satisfied, but above the operator threshold |
| POLICY.FLEET_FROZEN · POLICY.TWIN_FROZEN | Emergency stop active |
| POLICY.POLICY_MISSING | No policy bound to the agent |
| POLICY.SESSION_NOT_STARTED · POLICY.SESSION_EXPIRED | Outside the session window |
| POLICY.MAX_TX_REACHED · POLICY.RATE_LIMIT | Count limits |
| POLICY.WRONG_CHAIN · POLICY.WRONG_ASSET | Chain or token mismatch |
| POLICY.AMOUNT_INVALID · POLICY.PER_TX_CAP · POLICY.DAILY_CAP · POLICY.LIFETIME_CAP | Amount limits (atomic integers) |
| POLICY.RECIPIENT_UNKNOWN · POLICY.RECIPIENT_NOT_APPROVED · POLICY.RECIPIENT_DELEGATED | Registry (deny by default; EIP-7702 code refused) |
| POLICY.HOST_NOT_ALLOWED · POLICY.METHOD_NOT_ALLOWED · POLICY.PATH_NOT_ALLOWED | Destination rules |
| POLICY.NONCE_REPLAY | Nonce missing or already seen |

## Payment

| Code | Meaning |
|---|---|
| PAYMENT.AUTHORIZATION.SIGNED_NOT_SUBMITTED | DRY_RUN: EIP-3009 authorization signed and verified, not sent |
| PAYMENT.RAIL.SETTLED | Rail returned a settlement response with a tx reference |
| PAYMENT.RAIL.REJECTED | Rail refused the authorization |

## Task and evidence

| Code | Meaning |
|---|---|
| TASK.RESULT.SIGNATURE_VALID | Twin's secp256k1 signature over the result hash recovered to its registered address |
| TASK.CLAIM.MATCHED | The completing twin is the twin that claimed the task |
| EVIDENCE.BYTES.HASHED | Issuer hashed the supplied bytes |
| EVIDENCE.MANIFEST.ASSEMBLED | Manifest built from stored hashes |

## Lifecycle (used as `reasonCode` on events; issuer-defined namespace)

| Code | Meaning |
|---|---|
| ISSUER.KEY.COMPROMISED | Issuer key rotation after compromise |
| ISSUER.ERROR.CORRECTED | Issuer corrected a mistaken receipt (supersede) |
| SUBJECT.EVIDENCE.WITHDRAWN | Underlying evidence withdrawn or found invalid |
| OPERATOR.DECISION | Operator revoked with a note |
| DISPUTE.RAISED | A party disputes the receipt |

## Verifier failure codes (packages/g402-verify)

| Code | Meaning |
|---|---|
| SCHEMA.VERSION.UNSUPPORTED · SCHEMA.FIELD.MISSING · SCHEMA.FIELD.INVALID | Envelope shape |
| SCHEMA.LABEL.ILLEGAL | Derived label at issuance, or label forbidden for the mode |
| SCHEMA.LIMITATIONS.MISSING | Standard limitations absent |
| INTEGRITY.CANONICAL_HASH.MISMATCH · INTEGRITY.LEAF_HASH.MISMATCH | Recompute failed |
| SIGNATURE.KEY.UNKNOWN · SIGNATURE.INVALID | Issuer key not in supplied registry, or signature bad |
| MERKLE.PROOF.INVALID | Inclusion proof does not reach the segment root |
| CHAIN.SEQUENCE.GAP · CHAIN.PREV_HASH.MISMATCH | Ledger continuity |
| LIFECYCLE.SUPERSESSION.CIRCULAR · LIFECYCLE.EVENT.SUBJECT_HASH_MISMATCH | Event chain problems |
| POLICY.HASH.MISMATCH | Supplied RulePack does not hash to `policy.hash` |
| BINDING.REQUEST.MISMATCH · BINDING.RESPONSE.MISMATCH · BINDING.MISSING | Request/response binding |
| MODE.LIVE.UNSUPPORTED_CLAIM | LIVE/CONFIRMED without an external reference |
| STATUS.NOT_ACTIVE | Active status was required (`--require-active`) but status is not ACTIVE |
