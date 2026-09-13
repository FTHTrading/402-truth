# Security model

## Trust roots

| Root | Held by | Verified how |
|---|---|---|
| Issuer Ed25519 key | The Control API process; encrypted at rest under a local KEK (`control/keys/issuer.key.json`). NOT an HSM. | Public key + keyId published at `GET /keys`; consumers pin the keyId in a local registry file passed to the verifier |
| Twin secp256k1 keys | Each twin process; encrypted at rest | Twin address recorded at registration by signed challenge; result signatures recovered by the API before a receipt is issued |
| Segment roots | Issuer database | RFC 6962 inclusion proofs; **no external anchor yet** (F-3) |

## What a compromise of each root allows

- Issuer key: forge new receipts. Mitigation: rotate; publish a `receipt.revoked` event with
  `ISSUER.KEY.COMPROMISED` for the window; the registry keeps the old key with status `retired` and a
  `validUntil`, so verifiers can reject signatures dated after retirement.
- Issuer database: rewrite history. Mitigation today: hash-chained audit log and hash-chained receipt
  ledger make rewrites detectable by anyone holding an earlier copy. Mitigation once F-3 lands:
  external anchoring makes rewrites detectable by everyone.
- Twin key: a twin can attest false results. Mitigation: results are ATTESTED, never VERIFIED beyond
  their signature; policy caps bound any payment consequence.

## Explicit non-guarantees

- No availability guarantee. The verifier works offline on a bundle precisely so availability of the
  issuer does not gate verification.
- No confidentiality of receipt contents; put secrets in `evidence` references, never in `body`.
- No anchoring. A receipt labelled anything other than `UNANCHORED` by a v1 verifier is a verifier bug.

## Verifier requirements

- Must not fetch from the network by default.
- Must reject an unknown keyId rather than trusting the key embedded in a bundle alone; the bundle's
  `keys[]` may be used only when the caller passes `--trust-bundle-keys` (explicit).
- Must print the companion rule (LIMITATIONS_POLICY.md) on every report.
