'use strict';
// Forbidden-phrase gate from spec/adr/ADR-0002. Exit 1 if any forbidden phrase appears in the given files.
const fs = require('fs'); const path = require('path');
const FORBIDDEN = [/\bthe truth\b/i, /source of truth/i, /(?<!(?:or|no) )\bguarantee[ds]?\b/i, /\bimmutable\b/i, /trustless/i, /no trust required/i, /zero-knowledge/i,
  /(?<!(?:not|yet|externally|un) ?)\banchored\b/i, /\bcompliant\b/i, /SEC-compliant/i, /MiCA/i, /\bregulated\b/i, /\blicensed\b/i, /RWA Decision Services/i, /tokenized securit/i,
  /mint authorization/i, /Trust Center/i, /trust score/i, /reputation/i, /social credit/i, /proof of ownership/i, /proves ownership/i, /decides correctly/i,
  /final decision/i, /\bfraudulent\b/i, /BitGo/i, /UNYKORN 7777/i, /2549008J7LUHSQ73SI26/i, /\bUBEC\b/, /custody insurance/i];
const SELF = /^(check-claims\.c?js|verify-served\.sh)$/;   // the gate's own pattern list is not public copy
function walk(d, out = []) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); } else if (!SELF.test(e.name)) out.push(p); } return out; }
const root = process.argv[2] || path.join(__dirname, 'genesis402');
const files = fs.statSync(root).isDirectory() ? walk(root) : [root];
let bad = 0;
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  for (const re of FORBIDDEN) { const m = re.exec(text); if (m) { bad++; console.log('FORBIDDEN', path.relative(root, f), JSON.stringify(m[0]), 'at', text.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ')); } }
}
console.log(bad ? bad + ' forbidden phrase hit(s)' : 'claims gate: clean');
process.exit(bad ? 1 : 0);
