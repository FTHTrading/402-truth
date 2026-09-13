#!/usr/bin/env node
// g402-verify — offline verifier for genesis402-receipt-v1. Never touches the network.
//   g402-verify receipt <receipt.json> --keys keys.json [--events events.json] [--segment segment.json] [--rulepack rp.json] [--request req.json] [--response res.json] [--require-active] [--json]
//   g402-verify bundle <bundle.json> [--keys keys.json] [--trust-bundle-keys] [--require-active] [--json]
//   g402-verify chain <ledger.json|ledger.jsonl> [--json]
//   g402-verify inclusion <receipt.json> --segment <segment.json> [--json]
//   g402-verify lifecycle <receipt.json> --events <events.json> [--json]
//   g402-verify policy <receipt.json> --rulepack <rulepack.json> [--json]
//   g402-verify all <bundle.json> [--keys keys.json] [--trust-bundle-keys] [--json]
import { readFileSync } from 'node:fs';
import { verifyReceipt, verifyChain, verifyBundle, type Report } from '../src/verify.ts';
import { computeLeafHash, COMPANION_RULE } from '../src/receipt.ts';
import { verifyProof } from '../src/merkle.ts';
import { effectiveStatus } from '../src/lifecycle.ts';
import { hashCanonical } from '../src/hash.ts';

function readJson(p: string): any { const t = readFileSync(p, 'utf8'); if (p.endsWith('.jsonl')) return t.split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)); return JSON.parse(t); }
function flags(argv: string[]): { pos: string[]; opt: Record<string, string | boolean> } {
  const pos: string[] = []; const opt: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); const n = argv[i + 1]; if (n && !n.startsWith('--')) { opt[k] = n; i++; } else opt[k] = true; } else pos.push(a); }
  return { pos, opt };
}
function human(r: Report): string {
  const line = (k: string, v: string) => k.padEnd(22) + v;
  return [
    'Receipt: ' + r.receiptId + '  (' + r.kind + ', ' + r.mode + ')',
    line('Schema:', r.checks.schema), line('Canonical hash:', r.checks.canonicalHash), line('Signature:', r.checks.signature),
    line('Leaf hash:', r.checks.leafHash), line('Inclusion proof:', r.checks.inclusionProof), line('Policy binding:', r.checks.policyBinding),
    line('Request binding:', r.checks.requestBinding), line('Response binding:', r.checks.responseBinding),
    line('Lifecycle status:', r.lifecycle), line('Anchor status:', r.anchor), line('Truth labels:', r.truthLabels.join(', ') + (r.derivedLabels.length ? '  (+ ' + r.derivedLabels.join(', ') + ')' : '')),
    line('Limitations:', r.limitationsPresent ? 'PRESENT' : 'MISSING'),
    ...r.findings.map((f) => '  ! ' + f.code + (f.detail ? '  ' + f.detail : '')),
    'Overall: ' + r.overallStatus, '', COMPANION_RULE
  ].join('\n');
}

const { pos, opt } = flags(process.argv.slice(2));
const cmd = pos[0]; const file = pos[1];
const out = (obj: any, text: string, ok: boolean) => { console.log(opt.json ? JSON.stringify(obj, null, 2) : text); process.exit(ok ? 0 : 1); };
if (!cmd || !file) { console.error('usage: g402-verify <receipt|bundle|chain|inclusion|lifecycle|policy|all> <file> [options]'); process.exit(2); }

const keys = opt.keys ? readJson(String(opt.keys)) : [];
// --at <ISO|issuance>: evaluate lifecycle as of that time (default: now). "issuance" = the receipt's issuedAt.
const atFor = (rc: any): number | undefined => { const a = opt.at; if (!a) return undefined; if (a === 'issuance') return Date.parse(rc.lifecycle.issuedAt) + 1000; const t = Date.parse(String(a)); if (isNaN(t)) { console.error('bad --at'); process.exit(2); } return t; };
if (cmd === 'receipt') {
  const rc = readJson(file);
  const r = verifyReceipt(rc, { keys, events: opt.events ? readJson(String(opt.events)) : [], segment: opt.segment ? readJson(String(opt.segment)) : null, rulepack: opt.rulepack ? readJson(String(opt.rulepack)) : undefined, request: opt.request ? readJson(String(opt.request)) : undefined, response: opt.response ? readJson(String(opt.response)) : undefined, requireActive: Boolean(opt['require-active']), atMs: atFor(rc) });
  out(r, human(r), r.overallStatus !== 'INVALID');
} else if (cmd === 'bundle' || cmd === 'all') {
  const b = readJson(file);
  const r = verifyBundle(b, { keys, trustBundleKeys: Boolean(opt['trust-bundle-keys']), requireActive: Boolean(opt['require-active']), atMs: atFor(b.receipt) });
  out(r, human(r), r.overallStatus !== 'INVALID');
} else if (cmd === 'chain') {
  const r = verifyChain(readJson(file));
  out(r, 'Ledger: ' + r.count + ' receipts\nChain: ' + (r.ok ? 'VALID' : 'INVALID') + '\nHead: ' + r.head + '\n' + r.findings.map((f) => '  ! ' + f.code + '  ' + (f.detail || '')).join('\n'), r.ok);
} else if (cmd === 'inclusion') {
  const rc = readJson(file); const seg = readJson(String(opt.segment)); const leaf = computeLeafHash(rc);
  const ok = Array.isArray(rc.integrity && rc.integrity.inclusionProof) && verifyProof(leaf, rc.integrity.inclusionProof, seg.root);
  out({ receiptId: rc.receiptId, leafHash: leaf, root: seg.root, inclusionProof: ok ? 'VALID' : 'INVALID' }, 'Leaf: ' + leaf + '\nRoot: ' + seg.root + '\nInclusion proof: ' + (ok ? 'VALID' : 'INVALID'), ok);
} else if (cmd === 'lifecycle') {
  const rc = readJson(file); const ev = readJson(String(opt.events));
  const st = effectiveStatus(rc, ev, undefined, hashCanonical((() => { const { integrity, ...rest } = rc; const issuer = { ...rest.issuer }; delete issuer.signature; return { ...rest, issuer }; })()));
  out(st, 'Receipt: ' + rc.receiptId + '\nStatus: ' + st.status + '\nEvents applied: ' + st.appliedEvents.length + st.appliedEvents.map((e) => '\n  ' + e.eventType + ' ' + e.reasonCode + ' @ ' + e.effectiveAt + ' (' + e.receiptId + ')').join('') + st.findings.map((f) => '\n  ! ' + f.code + ' ' + (f.detail || '')).join(''), st.findings.length === 0);
} else if (cmd === 'policy') {
  const rc = readJson(file); const rp = readJson(String(opt.rulepack)); const h = hashCanonical(rp);
  const ok = Boolean(rc.policy) && h === rc.policy.hash;
  out({ receiptId: rc.receiptId, rulepackHash: h, receiptPolicyHash: rc.policy && rc.policy.hash, policyBinding: ok ? 'VALID' : 'INVALID' }, 'RulePack hash: ' + h + '\nReceipt policy hash: ' + (rc.policy && rc.policy.hash) + '\nPolicy binding: ' + (ok ? 'VALID' : 'INVALID'), ok);
} else { console.error('unknown command ' + cmd); process.exit(2); }
