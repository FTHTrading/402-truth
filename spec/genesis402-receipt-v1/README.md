# genesis402-receipt-v1

The frozen receipt format for Genesis402 / Unykorn Control. Read in this order:

1. RECEIPT_SPEC.md — the envelope and the hashing/signing order
2. CANONICALIZATION_SPEC.md — how bytes are made deterministic
3. TRUTH_LABELS.md — how a statement came to be, never whether it is right
4. LIFECYCLE_SPEC.md — append-only revocation, supersession, dispute, expiry
5. LIMITATIONS_POLICY.md — the founding principle and forbidden language
6. REASON_CODES.md — every code an issuer or verifier may emit
7. SECURITY_MODEL.md — what is protected, by what, and what is not
8. TEST_VECTORS.md — how the fixtures in `packages/g402-verify/test/fixtures` were made
9. examples/ — one real receipt per lifecycle state, produced by the reference issuer

Verify anything here without touching the API:

```
node packages/g402-verify/bin/g402-verify.ts receipt spec/genesis402-receipt-v1/examples/receipt-authorized.json --keys spec/genesis402-receipt-v1/examples/keys.json
```

Frozen 2026-09-13. Changes go in `genesis402-receipt-v2`.
