# Truth labels

A label says **how** a statement came to be, never whether it is right.

## Issuance labels (may appear in `truthLabels`)

| Label | Meaning | Who could produce it |
|---|---|---|
| `OBSERVED` | The issuer itself computed or measured the thing (e.g. hashed bytes it was given) | issuer |
| `ATTESTED` | A named, signing party asserted it (a twin, an uploader, the issuer about its own act) | any signer |
| `VERIFIED` | The issuer ran a deterministic check that passed (signature recovered, hash matched, policy evaluated) | issuer |
| `CONFIRMED` | An external system returned a corroborating artifact (rail settlement response, tx hash) | external |
| `PENDING` | The outcome awaits evidence or a decision | issuer |
| `REFUSED` | A declared rule was not satisfied; the refusal carries reason codes | issuer |
| `PROJECTION` | The artifact describes what *would* happen; nothing was executed (DRY_RUN) | issuer |

## Derived labels (never in `truthLabels`; a verifier computes them)

| Label | Derived from |
|---|---|
| `ANCHORED` | An external anchor artifact verifies against `integrity.segmentRoot` |
| `EXPIRED` | `lifecycle.expiresAt` ≤ evaluation time |
| `REVOKED` | A `receipt.revoked` event with `effectiveAt` ≤ evaluation time references this receipt |
| `SUPERSEDED` | A `receipt.superseded` event references this receipt |

## Mode × label matrix

| | OBSERVED | ATTESTED | VERIFIED | CONFIRMED | PENDING | REFUSED | PROJECTION |
|---|---|---|---|---|---|---|---|
| LOCAL | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ |
| DRY_RUN | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ |
| TESTNET | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| LIVE | ✓ | ✓ | ✓ | ✓ (needs external ref) | ✓ | ✓ | ✗ |
| SIMULATED | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ |

## Labels as used by the reference issuer today

| kind | mode | labels |
|---|---|---|
| `evidence.hashed` | LOCAL | OBSERVED, ATTESTED |
| `evidence.manifest` | LOCAL | ATTESTED, VERIFIED |
| `task.completed` | LOCAL | ATTESTED, VERIFIED |
| `payment.dry_run` | DRY_RUN | VERIFIED, PROJECTION |
| `payment.settled` | LIVE | VERIFIED, CONFIRMED |
| `payment.rejected` | LIVE | VERIFIED, REFUSED |
| `receipt.revoked` / `receipt.superseded` / `receipt.disputed` | LOCAL | ATTESTED |

## What labels do not do

They do not rank, score, or compare. Two receipts with the same labels can have opposite outcomes under
different policies. That is by design (see the founding principle in LIMITATIONS_POLICY.md).
