# genesis402-receipt-v1 — Receipt Specification

Status: FROZEN 2026-09-13 (tag `receipt-v1`). Amend only by `genesis402-receipt-v2`; never edit meaning here.
Reference implementation: `control/receipts.js` (issuer) and `packages/g402-verify` (verifier).

## 1. What a receipt is

A receipt is a **scoped technical record**: who issued it, what subject it concerns, what statement is
made, under which policy and state machine, with which evidence commitment, and what the outcome was.
It is not truth, correctness, legal validity, or universal authorization. Every receipt carries the
claim boundary in `claim.limitations` (§6) and a verifier must surface it.

> Authorized does not mean universally right. Refused does not mean universally wrong. Each receipt
> reports an outcome under a declared scope, evidence state, policy version, and time.

## 2. Envelope

All fields are required unless marked optional. Unknown top-level fields are a schema failure.

| Field | Type | Meaning |
|---|---|---|
| `receiptVersion` | `"genesis402-receipt-v1"` | Exact string. Verifiers reject anything else. |
| `receiptId` | string `g402_rcpt_[0-9a-f]{12}` | Unique id. Not a hash. |
| `kind` | string `a.b[.c]` | Domain kind, e.g. `payment.dry_run`, `task.completed`, `evidence.hashed`, `receipt.revoked`. |
| `mode` | enum | `LOCAL` · `DRY_RUN` · `TESTNET` · `LIVE` · `SIMULATED`. See §4. |
| `truthLabels` | string[] | Issuance labels only (§3). `ANCHORED`, `REVOKED`, `SUPERSEDED`, `EXPIRED` are derived and forbidden here. |
| `workflow.id` | string | Workflow / deal / payment grouping id. |
| `workflow.stateMachineId` | string | One of the registered machines (§7). |
| `workflow.stateMachineVersion` | semver | Version of the transition rules that applied. |
| `workflow.sequence` | integer ≥ 1 | Position in the issuer's ordered receipt chain. |
| `workflow.previousReceiptHash` | `sha256:<64hex>` | `integrity.canonicalBodyHash` of the previous receipt in the chain; 64 zeros for the first. |
| `subject.type` | string | `payment` · `task` · `evidence` · `deal` · `receipt` · … |
| `subject.id` | string | Subject identifier. |
| `claim.scope` | string | What, exactly, the statement covers. |
| `claim.statement` | string | The statement, in scoped language. |
| `claim.limitations` | string[] | Must include the four standard limitations (§6). May add more. |
| `evidence.root` | `sha256:…` or null | Commitment to the evidence set. |
| `evidence.count` | integer | Items committed. |
| `evidence.classification` | enum | `METADATA_ONLY` · `HASH_ONLY` · `ENCRYPTED_REF` |
| `policy` | object or null | `{ id, version, hash }`. `hash` is `sha256:` of the canonical policy document (RulePack). |
| `decision` | object or null | `{ outcome, reasonCodes[] }`. See REASON_CODES.md. |
| `binding` | object or null | `{ requestHash, responseHash, nonce }`. Required when `kind` starts with `payment.`. |
| `body` | object | Kind-specific payload, verbatim. Never interpreted by the verifier. |
| `lifecycle.statusAtIssuance` | `"ACTIVE"` | Always ACTIVE. Effective status is derived by replay (LIFECYCLE_SPEC.md). |
| `lifecycle.issuedAt` | ISO-8601 UTC | |
| `lifecycle.expiresAt` | ISO-8601 UTC or null | |
| `lifecycle.revocationStatusAtIssuance` | `"NOT_REVOKED"` | Always. |
| `issuer.id` | string | Issuer name, e.g. `unykorn-control`. |
| `issuer.keyId` | string | `g402-key-<16hex>` = first 16 hex of SHA-256 over the SPKI DER of the public key. |
| `issuer.alg` | `"ed25519"` | |
| `issuer.signature` | hex(64 bytes) | Ed25519 signature over the 32 raw bytes of `integrity.canonicalBodyHash`. |
| `integrity` | object | Computed after signing; **not** covered by the signature. `{ canonicalBodyHash, leafHash, segmentRoot, inclusionProof, leafIndex?, segmentId? }` |

## 3. Truth labels at issuance

`OBSERVED` · `ATTESTED` · `VERIFIED` · `CONFIRMED` · `PENDING` · `REFUSED` · `PROJECTION`.
Definitions and the mode/label matrix are in TRUTH_LABELS.md.

## 4. Mode

| Mode | Meaning | Verifier rule |
|---|---|---|
| `LOCAL` | Produced by a local issuer; no external system consulted for the outcome | none |
| `DRY_RUN` | A real artifact (e.g. a signature) was produced but **not submitted** anywhere | `CONFIRMED` label forbidden |
| `TESTNET` | Submitted to a test network | `CONFIRMED` allowed |
| `LIVE` | Submitted to a production system | `binding.responseHash` required; `CONFIRMED` requires `body.txHash` or an equivalent external reference |
| `SIMULATED` | No real artifact; illustrative only | `VERIFIED` and `CONFIRMED` forbidden |

## 5. Hashing and signing order

1. Build the envelope without `integrity` and with `issuer.signature = null`.
2. `canonicalBodyHash = "sha256:" + SHA256(canonicalize(envelope minus integrity, minus issuer.signature))` (CANONICALIZATION_SPEC.md).
3. `issuer.signature = Ed25519.sign(rawBytes(canonicalBodyHash))`.
4. `leafHash = SHA256(0x00 || canonicalize(envelope minus integrity))` — RFC 6962 leaf over the **signed** envelope.
5. Store. Later, sealing sets `integrity.segmentRoot`, `inclusionProof`, `leafIndex`, `segmentId`.

A verifier recomputes 2, checks 3 against the registry key, recomputes 4, then checks the inclusion
proof against `segmentRoot` if present.

## 6. Standard limitations (verbatim, all four required)

1. Authorized does not mean universally right. Refused does not mean universally wrong. Each receipt reports an outcome under a declared scope, evidence state, policy version, and time.
2. This receipt does not establish universal truth, legal compliance, ownership, or the correctness of third-party content.
3. This receipt is valid only for the declared subject, policy, time window, and evidence set.
4. Not a legal opinion or guarantee.

## 7. Registered state machines (v1)

| id | version | transitions |
|---|---|---|
| `x402-payment-delivery` | 1.0.0 | quoted → needs_approval → authorized_dry_run \| settled \| rejected \| denied |
| `task-execution` | 1.0.0 | queued → claimed → done \| failed → queued |
| `evidence-manifest` | 1.0.0 | hashed → manifest → sealed |
| `receipt-lifecycle` | 1.0.0 | ACTIVE → EXPIRED \| REVOKED \| SUPERSEDED \| DISPUTED (append-only events) |

## 8. Legacy

Receipts issued before this freeze carry `version = legacy-m1` in the issuer's store. They have no
issuer signature and no truth labels. They verify by hash recompute only and must be displayed as
**legacy** wherever shown. They are never rewritten.

## 9. Anchoring

`ANCHORED` is a derived label that requires an external anchor artifact (chain tx, OTS proof) bound to
`integrity.segmentRoot`. No v1 issuer currently produces one (founder flag F-3). Verifiers report
`anchor: UNANCHORED` until an anchor artifact is supplied and checked.
