import { NextResponse } from "next/server";

import verifiedPayment from "../../../../../../docs/evidence/first-guarded-testnet-payment.json";

export const dynamic = "force-dynamic";

export function GET() {
  const env = process.env;
  const checks = {
    publicKey: Boolean(env.CASPER_TESTNET_PUBLIC_KEY),
    secretKey: Boolean(env.CASPER_TESTNET_SECRET_KEY_PATH),
    rpc: Boolean(env.CASPER_RPC_URL),
    payee: Boolean(env.X402_CASPER_PAYEE),
    amount: Boolean(env.X402_CASPER_PAYMENT_AMOUNT_MOTES),
  };
  return NextResponse.json({
    mode: "casper-testnet",
    readyForLocalDryRun: Object.values(checks).every(Boolean),
    checks,
    payee: env.X402_CASPER_PAYEE ?? null,
    amountMotes: env.X402_CASPER_PAYMENT_AMOUNT_MOTES ?? null,
    network: env.CASPER_NETWORK ?? "casper-test",
    resource:
      env.AGENTPAY_REAL_RESOURCE_URL ??
      "http://127.0.0.1:4000/premium/rwa/parking-asset/MAD-001",
    hostedSigningEnabled: false,
    gitCommit: env.VERCEL_GIT_COMMIT_SHA ?? null,
    verifiedPayment,
  });
}
