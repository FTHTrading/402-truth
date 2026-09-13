#!/usr/bin/env node
// Pay a Genesis402 task with x402 on Base USDC, in one file.
//
//   npm i viem@2.52.0
//   X402_PAYER_KEY=0x... node pay-with-x402.mjs genesis-sim '{"n":20,"epochs":20}'
//
// Default is DRY-RUN: fetch the 402, sign an EIP-3009 authorization, print it, submit nothing.
// Set X402_LIVE=1 to submit. The rail settles via its facilitator (gasless for you) and returns a
// rail receipt with a Base tx hash. 0.25 USDC per successful execution; a failed task releases the
// payment proof for re-presentation.
//
// The key is read from the environment and never printed. Fund it with a few USDC on Base; no ETH needed.
import { privateKeyToAccount } from 'viem/accounts';
import { randomBytes } from 'node:crypto';

const RAIL = process.env.X402_RAIL || 'https://twin.unykorn.org';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const DOMAIN = { name: 'USD Coin', version: '2', chainId: 8453, verifyingContract: USDC };
const TYPES = { TransferWithAuthorization: [
  { name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' },
  { name: 'validAfter', type: 'uint256' }, { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' } ] };
const MAX_ATOMIC = BigInt(process.env.X402_MAX_ATOMIC || '250000'); // refuse anything above $0.25 unless you raise it

const [task, paramsJson] = process.argv.slice(2);
if (!task) { console.error('usage: pay-with-x402.mjs <genesis-sim|wallet-ops|rwa-screen> [paramsJSON]'); process.exit(2); }
const key = process.env.X402_PAYER_KEY;
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) { console.error('X402_PAYER_KEY missing or malformed'); process.exit(2); }
const account = privateKeyToAccount(key);
const body = JSON.stringify({ params: paramsJson ? JSON.parse(paramsJson) : {} });
const url = RAIL + '/' + task;

// 1. Ask; expect 402 with payment requirements set by the server.
const challenge = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
if (challenge.status !== 402) { console.error('expected 402, got', challenge.status, await challenge.text()); process.exit(1); }
const req = await challenge.json();
const accept = (req.accepts || []).find((a) => String(a.network).includes('8453'));
if (!accept) { console.error('no Base USDC lane offered', JSON.stringify(req.accepts)); process.exit(1); }
const value = BigInt(accept.maxAmountRequired || accept.amount);
if (value > MAX_ATOMIC) { console.error('refusing: price', value.toString(), 'atomic exceeds X402_MAX_ATOMIC', MAX_ATOMIC.toString()); process.exit(1); }
if (String(accept.asset).toLowerCase() !== USDC.toLowerCase()) { console.error('refusing: asset is not Base USDC'); process.exit(1); }

// 2. Sign an EIP-3009 authorization for exactly the server's price to exactly the server's payTo.
const now = Math.floor(Date.now() / 1000);
const authorization = { from: account.address, to: accept.payTo, value: value.toString(), validAfter: '0', validBefore: String(now + 900), nonce: '0x' + randomBytes(32).toString('hex') };
const signature = await account.signTypedData({ domain: DOMAIN, types: TYPES, primaryType: 'TransferWithAuthorization',
  message: { ...authorization, value, validAfter: 0n, validBefore: BigInt(authorization.validBefore) } });
const header = Buffer.from(JSON.stringify({ x402Version: 2, scheme: 'exact', network: 'eip155:8453', payload: { signature, authorization } })).toString('base64');

console.log('payer     ', account.address);
console.log('task      ', task, 'price', value.toString(), 'atomic USDC to', accept.payTo);
if (process.env.X402_LIVE !== '1') { console.log('DRY-RUN   authorization signed, NOT submitted. Set X402_LIVE=1 to pay.'); console.log(JSON.stringify({ authorization, signaturePrefix: signature.slice(0, 18) + '…' }, null, 1)); process.exit(0); }

// 3. Pay: re-send with X-PAYMENT. One proof buys exactly one execution.
const paid = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'X-PAYMENT': header }, body });
const out = await paid.json().catch(() => null);
console.log('status    ', paid.status);
if (out && out.receipt) console.log('receipt   ', out.receipt.receipt_id, 'tx', out.receipt.tx_hash, 'https://basescan.org/tx/' + out.receipt.tx_hash);
console.log(JSON.stringify(out, null, 1).slice(0, 2000));
process.exit(paid.status === 200 ? 0 : 1);
