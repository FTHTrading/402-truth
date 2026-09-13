# ADR-0002: Genesis402 public claims and language

- **Status:** Accepted 2026-09-13 (Kevan, "proceed" on the step 3 ship receipt)
- **Date:** 2026-09-13
- **Deciders:** Kevan, Claude
- **Scope:** Every public surface that mentions Genesis402: genesis402.com, discovery documents,
  OpenAPI, MCP tool descriptions, README, verifier output, desk copy.
- **Supersedes:** nothing. Companion to `~/.claude/rules/templates/adr-0002-marketing-copy.md`
  (UnyKorn-wide forbidden list still applies: no custodian names, no "UNYKORN 7777", no LEI/MIC claims).

## Context

genesis402.com today serves the legacy "UNYKORN — The Empire Operating System" page for every route,
so its discovery paths return HTML. The live x402 rail is at twin.unykorn.org. The receipt format is
frozen (`genesis402-receipt-v1`) and an offline verifier exists. Public copy must describe exactly
that maturity and nothing beyond it.

## Decision

### Positioning statement (verbatim, approved)

> Genesis402 is an in-progress proof and payment infrastructure stack with operational local receipt
> issuance and x402 settlement capability. Public verification, discovery, anchoring, and broader
> action-gating are being progressively released.

### Companion rule (verbatim, required next to any receipt, verifier output, or "trust" heading)

> Authorized does not mean universally right. Refused does not mean universally wrong. Each receipt
> reports an outcome under a declared scope, evidence state, policy version, and time.

### Approved phrases (usable verbatim)

| Topic | Approved |
|---|---|
| Tagline | "Pay for proof, not promises." |
| Receipts | "signed, scoped, replayable receipt" · "machine-verifiable proof receipt" |
| Verification | "verified against declared checks" · "deterministic verification" |
| Authorization | "authorized under RulePack {id}@{version}" · "agent action authorization (payments only at present)" |
| Refusal | "refused under declared policy with reason code {code}" · "a valid refusal is a delivered outcome" |
| Payments | "x402 payment-gated API" · "stablecoin micropayments for APIs" · "three settled receipts on the live x402 rail" (while true) |
| Sealing | "sealed in a local RFC 6962 segment" |
| Anchoring | "not yet externally anchored" · "anchor coverage: 0%" |
| Evidence | "evidence hash", "evidence manifest", "tamper-evident audit trail" |
| Entity | "UnyKorn LLC (Wyoming)" · "operated by UnyKorn LLC" |
| Trust | "trust mechanisms" (always with the companion rule) · "independent verification" · "open verifier" |
| Maturity | LIVE · LIVE_LIMITED · LOCAL_ONLY · DRY_RUN · NOT_YET_AVAILABLE · NOT_OFFERED (exactly these tokens) |

### Forbidden phrases (must not appear on any Genesis402 surface)

| Phrase | Why |
|---|---|
| "the truth", "we are the truth", "source of truth" (about outcomes) | receipts are scoped records |
| "guaranteed", "guaranteed compliance", "settlement guaranteed" | no guarantee exists |
| "immutable" (for local-only data), "immutable everything" | nothing is anchored yet |
| "trustless", "no trust required", "zero-knowledge" | false; issuer key and local DB are trust roots |
| "anchored", "externally anchored" (until an anchor artifact exists) | anchor coverage is 0% |
| "compliant", "SEC-compliant", "MiCA-compliant", "regulated", "licensed" | regulated claims; counsel first |
| "RWA Decision Services", "tokenized securities", "mint authorization" as offered products | NOT_OFFERED; broker-dealer supervised workflow record required first |
| "Trust Center" as a page title (until verifier + key registry + status are public) | would imply a live surface |
| "trust score", "reputation", "social credit", any global score | social-credit primitive; forbidden by design |
| "proves ownership", "proof of ownership" | hashing bytes is not title |
| "AI decides correctly", "AI makes the final decision" | operator approves; twins propose |
| "fraudulent", "wrong", "illegitimate" as outcomes | moral/legal judgment without basis |
| any custodian name; "custody insurance" | inherited UnyKorn rule |

### Required disclosures on every discovery document

`capabilityMaturity` block with the tokens above; `paymentSettlementMode` where payments are described;
the companion rule in a `limitations` array; `operator: "UnyKorn LLC (Wyoming)"`.

## Consequences

- A grep of the forbidden list runs before any deploy of a Genesis402 surface (add to the ship receipt).
- Adding an approved phrase needs a successor ADR. Removing one needs a deprecation date.
- The legacy "Empire Operating System" page must not be served under genesis402.com once discovery
  documents go live, because its copy has not been reviewed against this list.

## Related

`spec/genesis402-receipt-v1/LIMITATIONS_POLICY.md` · `docs/decisions/ADR-0001-control-api-inside-desk.md`
