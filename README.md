# 402-truth — Genesis402

**Pay for proof, not promises.**

Genesis402 is an in-progress proof and payment infrastructure stack with operational local receipt
issuance and x402 settlement capability. Public verification, discovery, anchoring, and broader
action-gating are being progressively released. Operated by UnyKorn LLC (Wyoming).

This repository is the **console producer toolkit**: the frozen `genesis402-receipt-v1` format that the
UnyKorn operator console issues, its offline verifier, the interim discovery documents, and a one-file
payer for the live rail.

**Where it sits (ADR-0006, accepted 2026-09-13).** The canonical public interface of genesis402.com is
the witness contract published in [FTHTrading/truth-adapters](https://github.com/FTHTrading/truth-adapters-):
`truth-record-v1` and `truth-attestation-v1`. `genesis402-receipt-v1` is one producer format, witnessed
one-way through the `g402-receipt` adapter. It does not define the Genesis402 platform contract, and
`site/` here is not deployed to the apex.

```
console receipt-v1  →  g402-receipt adapter  →  truth-record-v1 (witnessed, signed, chained)
```

> Authorized does not mean universally right. Refused does not mean universally wrong. Each receipt
> reports an outcome under a declared scope, evidence state, policy version, and time.

## What is live, what is not

| Capability | State | Where |
|---|---|---|
| x402 payment rail (Base USDC, XRPL XRP) | **LIVE** | https://twin.unykorn.org |
| Machine discovery on the canonical host | **LIVE** (interim Worker; superseded at cut-over by the gateway in truth-adapters) | https://genesis402.com/.well-known/x402 · [agent.json](https://genesis402.com/.well-known/agent.json) · [openapi.json](https://genesis402.com/openapi.json) · [status.json](https://genesis402.com/status.json) · [pricing.json](https://genesis402.com/pricing.json) |
| Rail receipts (tx hash, replay-protected) | LIVE_LIMITED | returned by every paid call |
| **Paid proof receipts** `POST /prove` (0.25 USDC): signed receipt-v1 for a digest, bound to your payment tx | **LIVE** | https://twin.unykorn.org/prove · keys at [/prove/keys](https://twin.unykorn.org/prove/keys) · lookup `/prove/receipts/{id}` |
| Public canonical formats `truth-record-v1` / `truth-attestation-v1` | see truth-adapters | [FTHTrading/truth-adapters](https://github.com/FTHTrading/truth-adapters-) |
| Console producer format `genesis402-receipt-v1` | **FROZEN** (producer profile) | [spec/genesis402-receipt-v1](spec/genesis402-receipt-v1/README.md) |
| Offline verifier + CLI | LOCAL_ONLY (this repo, not on npm yet) | [packages/verify](packages/verify/README.md) |
| External anchoring of segment roots | NOT_YET_AVAILABLE, coverage 0% | — |
| Agent action authorization | PAYMENTS_ONLY | operator desk, private |
| MCP server | NOT_YET_AVAILABLE | — |
| RWA workflows | NOT_OFFERED | — |

## Buy something in 60 seconds

Four tasks, 0.25 USDC each, one successful execution per payment proof, failed tasks release the proof.

```bash
cd examples && npm i
X402_PAYER_KEY=0x<a Base wallet holding a few USDC, no ETH needed> node pay-with-x402.mjs genesis-sim '{"n":20,"epochs":20}'
# DRY-RUN by default: fetches the 402, signs the EIP-3009 authorization, submits nothing.
X402_LIVE=1 X402_PAYER_KEY=0x… node pay-with-x402.mjs genesis-sim '{"n":20,"epochs":20}'
# buy a signed proof receipt for your own digest, then verify it offline:
X402_LIVE=1 X402_PAYER_KEY=0x… node pay-with-x402.mjs prove '{"sha256":"<64 hex>","claim":"invoice 1042 existed before the dispute"}'
curl -s https://twin.unykorn.org/prove/keys > keys.json   # then: g402-verify receipt receipt.json --keys keys.json
```

The payer refuses any price above `X402_MAX_ATOMIC` (default 250000 = $0.25) and any asset that is not
Base USDC. The server sets the price; the payer never does.

## Verify a receipt without trusting anyone

```bash
node packages/verify/bin/g402-verify.ts bundle spec/genesis402-receipt-v1/examples/bundle-authorized.json --keys spec/genesis402-receipt-v1/examples/keys.json --at issuance
# (a DRY_RUN authorization expires with its 15-minute validBefore; without --at issuance the same bundle reports EXPIRED, which is also correct)
node packages/verify/bin/g402-verify.ts receipt spec/genesis402-receipt-v1/examples/receipt-revoked.json --keys spec/genesis402-receipt-v1/examples/keys.json --events spec/genesis402-receipt-v1/examples/lifecycle-events.json
cd packages/verify && node --test test/*.test.ts     # 21 tests, 14 of them must-fail vectors
```

Zero dependencies. Node 24. Never touches the network. Checks schema, canonical hash, Ed25519 issuer
signature, RFC 6962 inclusion proof, append-only lifecycle (revoked / superseded / expired), policy
hash binding, request and response binding, ledger chain continuity, nonce reuse.

## Layout

```
spec/genesis402-receipt-v1/   the frozen format: envelope, canonicalization, truth labels, lifecycle,
                              limitations policy, reason codes, security model, test vectors, examples
spec/ADR-0002-…               approved and forbidden public language (the claims gate)
packages/verify/              @genesis402/verify — offline verifier + CLI + fixtures
discovery/                    interim discovery documents (served by a route-scoped Worker until the cut-over to the
                              truth-adapters gateway), the claims gate (check-claims.cjs), verify-served gate
examples/                     pay-with-x402.mjs
site/                         console-side homepage draft. NOT for the apex (ADR-0006).
```

## Truth labels, in one line each

OBSERVED the issuer measured it · ATTESTED a named signer asserted it · VERIFIED a deterministic check
passed · CONFIRMED an external system returned a corroborating artifact · PENDING · REFUSED with reason
codes · PROJECTION nothing was executed. Derived states (anchoring, revocation, supersession, expiry)
are computed by the verifier from later evidence, never asserted at issuance.

## What this is not

Not a bank, broker-dealer, exchange, custodian, trustee, transfer agent, appraiser, auditor, investment
adviser, money transmitter, or issuer. Receipts do not establish universal truth, legal compliance,
ownership, or the correctness of third-party content. `rwa-screen` reads a curated static table and is
not investment, legal or tax advice. No global scores of any kind: capabilities are scoped, expiring, and
inspectable.

## License

MIT. Producer spec frozen 2026-09-13; changes go in `genesis402-receipt-v2`. The public contract lives in
truth-adapters (ADR-0006); this repo adapts to it, not the other way round.
