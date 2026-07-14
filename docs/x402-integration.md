# Guarded x402 Integration

## Status

Milestone 1 implements an official x402 v2 transport-compatible guard pipeline.
It does not claim that Casper x402 settlement is live. `@x402/core` 2.18.0 has no
official Casper scheme package, so real mode requires an injected verified Casper
signer and facilitator and otherwise fails closed without a transaction hash.

## Wire Flow

```text
client -> resource
resource -> 402 + PAYMENT-REQUIRED (Base64 PaymentRequired)
client -> normalize selected accepts[] entry
client -> deterministic AgentPay policy checks
DENY -> stop; signer and facilitator are not called
ALLOW -> create PaymentPayload and PAYMENT-SIGNATURE
client -> retry resource with PAYMENT-SIGNATURE
resource/facilitator -> verify and settle
resource -> premium response + PAYMENT-RESPONSE
client -> verify settlement response and store audit evidence
```

The official v2 object fields are preserved. AgentPay-specific integrity data is
carried in `accepts[n].extra.agentPayGuard`:

```json
{
  "merchantId": "merchant_market_data_001",
  "providerId": "parking-data-provider",
  "nonce": "unique-requirement-nonce",
  "issuedAt": "2030-01-01T00:00:00.000Z",
  "expiresAt": "2030-01-01T00:05:00.000Z",
  "requestHash": "64-character-blake2b-256-hex",
  "bodyHash": "64-character-blake2b-256-hex",
  "facilitator": "https://allowlisted-facilitator.example"
}
```

## Guarded Fetch Usage

```ts
import {
  MockX402SettlementAdapter,
  guardedFetch,
} from "@cspr-agentpay/casper-adapter";

const result = await guardedFetch("https://api.example.test/premium/report", {
  method: "POST",
  body: { lotId: "MAD-001" },
  endpointId: "premium-parking-report",
  expectedAmount: "1000000000",
  policyId: policy.policyId,
  agentId: policy.agentId,
  policy,
  merchant,
  settlementAdapter: new MockX402SettlementAdapter(),
  usedNonces,
});

if (result.paid && !result.decision.allowed) {
  console.error(result.decision.reason, result.decision.checks);
}
```

`policy` should specify `allowedNetworks`, `allowedAssets`, `allowedPayees`, and,
when present in the requirement, `allowedFacilitators`. `expectedAmount` binds a
known resource price and detects a changed quote even when the modified value is
still below the per-payment maximum.

## Configuration

```bash
AGENTPAY_MODE=mock
X402_CASPER_NETWORK=casper:casper-test
X402_CASPER_ASSET=CSPR
X402_CASPER_FACILITATOR_URL=
X402_ALLOWED_FACILITATORS=

CASPER_TESTNET_PUBLIC_KEY=
CASPER_TESTNET_SECRET_KEY_PATH=
```

`casper:casper-test` is a local project identifier pending a verified official
x402/CAIP binding. A facilitator URL alone is insufficient: a Casper scheme
signer must also be injected. Secrets and PEM files must remain outside the repo.

## Real Versus Mock

| Capability | Mock adapter | Real adapter foundation |
|---|---|---|
| Official x402 v2 objects and headers | Yes | Yes |
| Deterministic guard before signing | Yes | Yes |
| Payment signature | Deterministic `mock-*` payload | Requires injected verified Casper signer |
| Facilitator settlement | Deterministic local state | Requires Casper-capable facilitator |
| Transaction hash | Never shown as Casper evidence | Only accepted as 64-character hex from settlement response |
| CSPR movement | No | Not implemented in this milestone |
| Existing proof recorder | Separate from payment | Separate optional post-settlement anchor |

## Threat Model

### Prompt injection

Provider data or a tool result may say “ignore the policy”, increase the amount,
or replace the payee. That text can change agent intent but cannot mutate the
policy object or guard decision. Exact payee, expected price, budget, and all
other checks execute deterministically before the signer or facilitator.

### Requirement tampering

The guard recomputes the canonical body hash and request hash from the outgoing
method, normalized URL, body, endpoint, merchant, agent, nonce, and expiry. It
also checks network, asset, exact payee, and expected price independently. A
production Casper scheme must sign all payment fields so a facilitator or server
cannot change them after authorization.

### Replay

The foundation rejects a used `merchantId:nonce` before signing and rejects a
duplicate mock settlement authorization. Real mode still needs an atomic durable
nonce/in-flight store shared across server instances and a unique Casper transfer
identifier bound into the signed x402 payload.

## Remaining Work for Real Testnet Settlement

1. Specify and review the Casper x402 `exact` payload and network identifier.
2. Implement the `@x402/core` client, server, and facilitator scheme interfaces.
3. Build/sign a Casper 2.0 native transfer with a verified SDK or CLI path.
4. Verify signatures and signed fields at `/verify`.
5. Submit exactly once at `/settle`, wait for execution, and return the real hash.
6. Independently verify the executed transfer before releasing premium data.
7. Add credential-gated Testnet integration tests and show a real transaction in
   Judge Mode only after independent confirmation.

Primary references:

- https://docs.x402.org/core-concepts/http-402
- https://docs.x402.org/core-concepts/client-server
- https://github.com/x402-foundation/x402
- https://docs.casper.network/condor/transactions
