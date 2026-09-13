#!/usr/bin/env bash
# Verify-served gate for the Genesis402 discovery release (FORGE Phase 6).
# Fetches every routed path from the live host, checks status + content-type, saves the served bytes,
# runs the claims gate against the SERVED bytes (not the repo), and diffs them against the reviewed drafts.
set -u
HOST="${1:-https://genesis402.com}"
OUT="$(dirname "$0")/../control/data/tmp/served-discovery"
mkdir -p "$OUT/.well-known"
fail=0
check() { # path expected-content-type-prefix
  local p="$1" want="$2"
  local ct code
  code=$(curl -s -m 20 -o "$OUT$p" -w "%{http_code}" -D "$OUT$p.headers" "$HOST$p")
  ct=$(grep -i '^content-type:' "$OUT$p.headers" | tr -d '\r' | awk -F': ' '{print $2}')
  if [ "$code" = "200" ] && [[ "$ct" == "$want"* ]]; then echo "OK   $code  $ct  $p"; else echo "FAIL $code  $ct  $p"; fail=1; fi
}
check /.well-known/x402 application/json
check /.well-known/x402.json application/json
check /.well-known/agent.json application/json
check /.well-known/security.txt text/plain
check /security.txt text/plain
check /openapi.json application/json
check /status.json application/json
check /pricing.json application/json
echo "SKIP /llms.txt (served by unykorn-geo-index, not this Worker)"
echo "--- JSON parses + maturity block present ---"
for f in /.well-known/x402 /.well-known/agent.json /openapi.json /status.json /pricing.json; do
  node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const m=j.capabilityMaturity||j['x-capability-maturity']||(j.paymentSettlementMode?{paymentSettlementMode:j.paymentSettlementMode}:null);if(!m){console.log('FAIL no maturity block',process.argv[2]);process.exit(1)}console.log('OK   maturity',process.argv[2],JSON.stringify(m).slice(0,80))" "$OUT$f" "$f" || fail=1
done
echo "--- claims gate on SERVED bytes ---"
rm -f "$OUT"/*.headers "$OUT"/.well-known/*.headers
node "$(dirname "$0")/check-claims.cjs" "$OUT" || fail=1
echo "--- served vs reviewed drafts (byte diff after JSON normalisation) ---"
D="$(dirname "$0")/genesis402"
for f in /.well-known/x402 /.well-known/agent.json /openapi.json /status.json /pricing.json; do
  a=$(node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))))" "$D$f"); b=$(node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))))" "$OUT$f")
  [ "$a" = "$b" ] && echo "OK   identical $f" || { echo "FAIL differs   $f"; fail=1; }
done
for f in /.well-known/security.txt; do cmp -s "$D$f" "$OUT$f" && echo "OK   identical $f" || { echo "FAIL differs   $f"; fail=1; }; done
echo "--- old fallback gone? ---"
grep -q "<!DOCTYPE html" "$OUT/.well-known/x402" && { echo "FAIL HTML fallback still served at /.well-known/x402"; fail=1; } || echo "OK   no HTML fallback"
[ $fail = 0 ] && echo "VERIFY-SERVED: PASS" || echo "VERIFY-SERVED: FAIL"
exit $fail
