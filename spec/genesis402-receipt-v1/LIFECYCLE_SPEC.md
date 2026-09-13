# Lifecycle — append-only

A receipt is never edited. Its effective status is **computed** by replaying later receipts that
reference it.

```
ISSUED (statusAtIssuance = ACTIVE)
   ├── EXPIRED       lifecycle.expiresAt ≤ now
   ├── REVOKED       a receipt of kind receipt.revoked   with subject.id = this receiptId
   ├── SUPERSEDED    a receipt of kind receipt.superseded with subject.id = this receiptId
   └── DISPUTED      a receipt of kind receipt.disputed   with subject.id = this receiptId
```

## Event receipt

An event is itself a v1 receipt (signed, chained, sealable) with:

- `kind` ∈ `receipt.revoked` · `receipt.superseded` · `receipt.disputed`
- `subject = { type: "receipt", id: <original receiptId> }`
- `workflow.stateMachineId = "receipt-lifecycle"`
- `decision = { outcome: <EVENT>, reasonCodes: [<reason>] }`
- `body = { eventType, reasonCode, effectiveAt, subjectReceiptId, subjectCanonicalBodyHash, supersededByReceiptId|null, note|null }`

`subjectCanonicalBodyHash` binds the event to the exact bytes it revokes, so an event cannot be
re-pointed at a different receipt with the same id.

## Precedence at evaluation time `t`

Consider only events with `effectiveAt ≤ t`.

1. Any `REVOKED` → status `REVOKED` (terminal).
2. Else any `SUPERSEDED` → `SUPERSEDED`.
3. Else any `DISPUTED` → `DISPUTED`.
4. Else if `expiresAt ≤ t` → `EXPIRED`.
5. Else `ACTIVE`.

`EXPIRED` and `REVOKED` are both terminal; `REVOKED` wins for display because it carries a reason code.

## Supersession rules

- `supersededByReceiptId` must exist and must not equal the subject.
- Chains are followed at most 32 hops; a cycle or longer chain is a verifier failure
  (`LIFECYCLE.SUPERSESSION.CIRCULAR`).
- Superseding does not revoke: the old receipt remains a true record of what was issued then.

## Who may emit events

Operators and the issuer. Twins may not (`403 twins_cannot_revoke` in the reference API).
Every event is also an audit-log row.

## Status response (reference API `GET /receipts/{id}/status`)

```json
{ "receiptId": "...", "version": "genesis402-receipt-v1", "status": "ACTIVE",
  "anchor": "UNANCHORED", "sealed": true, "derivedLabels": ["SEALED"],
  "events": [], "evaluatedAt": "2026-09-13T12:00:00.000Z" }
```
