import { resolve } from "node:path";

import {
  decodePaymentRequiredHeader,
  encodePaymentSignatureHeader,
} from "@x402/core/http";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import {
  PROTOCOL_VERSION,
  computeExpectedGuardedRequestHashes,
  createCasperPaymentAuthorizationHash,
  normalizeX402PaymentRequired,
  type AgentPolicy,
  type Merchant,
} from "@cspr-agentpay/protocol";
import { evaluateGuardedPayment } from "@cspr-agentpay/policy";

import {
  buildCasperPaymentAuthorization,
  CasperSettlementVerifier,
  FileSubmissionStore,
  LocalTestnetCasperSigner,
  MemoryConsumedTransactionStore,
  RealGuardedCasperPaymentFlow,
  SdkCasperTransactionSubmitter,
  SdkCasperTransferReader,
} from "../src/index";

const dryRun = process.argv.includes("--dry-run");
const checkOnly = process.argv.includes("--check");
const confirmationIndex = process.argv.indexOf("--confirm-authorization");
const confirmation =
  confirmationIndex >= 0 ? process.argv[confirmationIndex + 1] : undefined;
if (checkOnly) {
  const publicConfig = [
    "CASPER_RPC_URL",
    "X402_CASPER_PAYEE",
    "X402_CASPER_PAYMENT_AMOUNT_MOTES",
  ] as const;
  const missingPublicConfig = publicConfig.filter((name) => !process.env[name]);
  console.log("CSPR AgentPay Guard — real Testnet payment readiness");
  console.log("mode: READINESS CHECK (no I/O, signing, or submission)");
  console.log(`public configuration: ${missingPublicConfig.length ? "incomplete" : "present"}`);
  if (missingPublicConfig.length) console.log(`missing: ${missingPublicConfig.join(", ")}`);
  console.log("No .env file or key was loaded, no request was sent, and no transaction was signed or submitted.");
  process.exit(0);
}

const env = process.env;
const required = [
  "CASPER_TESTNET_PUBLIC_KEY",
  "CASPER_TESTNET_SECRET_KEY_PATH",
  "CASPER_RPC_URL",
  "X402_CASPER_PAYEE",
  "X402_CASPER_PAYMENT_AMOUNT_MOTES",
] as const;
const missing = required.filter((name) => !env[name]);

console.log("CSPR AgentPay Guard — real Testnet payment readiness");
console.log(`mode: ${dryRun ? "DRY RUN (no submission)" : "LIVE GATED"}`);
if (missing.length) {
  console.log(
    `ready: no\nmissing: ${missing.join(", ")}\nNo key was loaded and no transaction was submitted.`,
  );
  process.exit(1);
}

const resource =
  env.AGENTPAY_REAL_RESOURCE_URL ??
  "http://127.0.0.1:4000/premium/rwa/parking-asset/MAD-001";
const initial = await fetch(resource);
if (initial.status !== 402)
  throw new Error(`requirement: expected HTTP 402, received ${initial.status}`);
const requiredHeader = initial.headers.get("PAYMENT-REQUIRED");
if (!requiredHeader)
  throw new Error("requirement: PAYMENT-REQUIRED header missing");
const paymentRequired = decodePaymentRequiredHeader(requiredHeader);
const request = normalizeX402PaymentRequired({
  paymentRequired,
  method: "GET",
  url: resource,
  body: {},
  agentId: env.AGENT_ID ?? "agent_research_001",
  endpointId: "rwa-parking-asset-MAD-001",
});
if (request.payee.toLowerCase() !== env.X402_CASPER_PAYEE!.toLowerCase())
  throw new Error("requirement: configured payee mismatch");
if (request.amount !== env.X402_CASPER_PAYMENT_AMOUNT_MOTES)
  throw new Error("requirement: configured amount mismatch");

const now = new Date();
const agentId = env.AGENT_ID ?? "agent_research_001";
const policyId = env.POLICY_ID ?? "policy_demo_agent_001";
const merchantId = env.MERCHANT_ID ?? "merchant_market_data_001";
const policy: AgentPolicy = {
  version: PROTOCOL_VERSION,
  policyId,
  ownerAccount: env.CASPER_TESTNET_PUBLIC_KEY!,
  agentId,
  status: "active",
  currency: "CSPR",
  maxAmountPerPayment: request.amount,
  totalBudget: request.amount,
  spentAmount: "0",
  budgetWindow: "single-testnet-demo",
  allowedMerchantIds: [merchantId],
  allowedResourcePatterns: [`GET ${resource}`],
  allowedNetworks: ["casper:casper-test"],
  allowedAssets: ["CSPR"],
  allowedPayees: [request.payee],
  allowedFacilitators: request.facilitator ? [request.facilitator] : undefined,
  expiresAt: new Date(now.getTime() + 60 * 60_000).toISOString(),
  policyNonce: "local-testnet-demo",
  createdAt: now.toISOString(),
};
const merchant: Merchant = {
  version: PROTOCOL_VERSION,
  merchantId,
  displayName: "Testnet parking API",
  status: "active",
  casperAccount: request.payee,
  settlementAccount: request.payee,
  allowedOrigins: [new URL(resource).origin],
  allowedResourcePatterns: [`GET ${resource}`],
  createdAt: now.toISOString(),
};
const hashes = computeExpectedGuardedRequestHashes({
  request,
  body: {},
  agentId,
  endpointId: "rwa-parking-asset-MAD-001",
});
const decision = evaluateGuardedPayment({
  policy,
  merchant,
  request,
  expectedRequestHash: hashes.requestHash,
  expectedBodyHash: hashes.bodyHash,
  expectedAmount: env.X402_CASPER_PAYMENT_AMOUNT_MOTES,
  now,
});
console.log(`policy: ${decision.decision}`);
for (const check of decision.checks)
  console.log(
    `  ${check.passed ? "PASS" : "FAIL"} ${check.check}: ${check.message}`,
  );
if (!decision.allowed) throw new Error(`policy: ${decision.reason}`);
const authorization = buildCasperPaymentAuthorization({
  request,
  decision,
  agentId,
});
const authorizationHash = createCasperPaymentAuthorizationHash(authorization);
console.log(`signer: ${env.CASPER_TESTNET_PUBLIC_KEY}`);
console.log(`payee: ${authorization.destination}`);
console.log(`amount: ${authorization.amountMotes} motes`);
console.log(`network: ${authorization.network}`);
console.log(`resource: ${resource}`);
console.log(`authorization hash: ${authorizationHash}`);

const signer = new LocalTestnetCasperSigner({
  secretKeyPath: env.CASPER_TESTNET_SECRET_KEY_PATH!,
  expectedPublicKey: env.CASPER_TESTNET_PUBLIC_KEY!,
  paymentGasMotes: Number(env.CASPER_TRANSFER_GAS_MOTES ?? "100000000"),
});
const submitter = new SdkCasperTransactionSubmitter(env.CASPER_RPC_URL!);
const verifier = new CasperSettlementVerifier(
  new SdkCasperTransferReader(env.CASPER_RPC_URL!),
  new MemoryConsumedTransactionStore(),
);
const store = new FileSubmissionStore(
  resolve(
    env.AGENTPAY_REAL_IDEMPOTENCY_PATH ?? ".agentpay/submissions.real.json",
  ),
  "real",
);
const flow = new RealGuardedCasperPaymentFlow(
  signer,
  submitter,
  verifier,
  store,
);
const prepared = await flow.execute({ authorization, dryRun: true });
console.log(`transaction hash: ${prepared.signed.transactionHash}`);
console.log(
  `transaction: signed TransactionV1 (${prepared.signed.transaction.toBytes().length} bytes); submitted: no`,
);
if (dryRun) process.exit(0);
if (confirmation !== authorizationHash) {
  console.log(
    `LIVE SUBMISSION BLOCKED. Re-run with --confirm-authorization ${authorizationHash} only after explicit review.`,
  );
  process.exit(2);
}
const settled = await flow.execute({
  authorization,
  poll: {
    timeoutMs: Number(env.CASPER_POLL_TIMEOUT_MS ?? "120000"),
    intervalMs: Number(env.CASPER_POLL_INTERVAL_MS ?? "3000"),
  },
});
console.log(`submitted transaction: ${settled.signed.transactionHash}`);
console.log(`independent verification: ${JSON.stringify(settled.evidence)}`);
const paymentPayload: PaymentPayload = {
  x402Version: 2,
  resource: { url: resource },
  accepted: request.selectedRequirement as PaymentRequirements,
  payload: {
    scheme: "agentpay-casper-native-v1",
    authorization,
    authorizationHash,
    authorizationSignature: settled.signed.authorizationSignature,
    transactionHash: settled.signed.transactionHash,
    signer: settled.signed.signer,
    verified: true,
  },
};
const premium = await fetch(resource, {
  headers: {
    "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(paymentPayload),
  },
});
if (!premium.ok)
  throw new Error(
    `premium-retry: HTTP ${premium.status}: ${await premium.text()}`,
  );
if (!premium.headers.get("PAYMENT-RESPONSE"))
  throw new Error("premium-retry: PAYMENT-RESPONSE missing");
console.log(`premium response: ${JSON.stringify(await premium.json())}`);
console.log("REAL TESTNET FUNDS WERE MOVED.");
