# Limitations policy

## Founding principle

> Genesis402 does not declare universal truth or moral correctness. It records scoped claims, verifies
> declared evidence, executes transparent rules, preserves refusal and dispute paths, and issues
> portable receipts that others can independently inspect.

## Companion rule (must appear wherever a receipt is shown or returned)

> Authorized does not mean universally right. Refused does not mean universally wrong. Each receipt
> reports an outcome under a declared scope, evidence state, policy version, and time.

This sentence is limitation #1 in every v1 receipt, the first line of every verifier report, and
required in: the Proof Explorer, the Trust Center, audit bundles, SDK types, and MCP tool descriptions.

## Scoped language (use)

```
Verified under declared checks
Attested by <named issuer>
Authorized under <RulePack id>@<version>
Refused under <policy> with reason <code>
Sealed in segment <id>            (local)
Anchored at <time> via <artifact> (only when an anchor artifact exists)
Current as of <timestamp>
Evidence complete for declared workflow
Not a legal opinion or guarantee
```

## Forbidden in any receipt statement, scope, or public surface

"the truth", "guaranteed", "immutable" (for local-only data), "trustless", "no trust required",
"compliant" without a named rule set, "legitimate", "correct" as a moral or legal judgment,
"fraudulent" without an authorized legal basis, any global score or reputation number.

## What a receipt may never be used to imply

- Ownership of an asset.
- Legal compliance or regulatory approval.
- Suitability or accreditation of an investor.
- That a document is authentic (only that specific bytes were hashed at a time).
- That an agent, wallet, or person is trustworthy in any other context.
- That an outcome would be the same under a different policy.
