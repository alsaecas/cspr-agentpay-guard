import {
  PROTOCOL_VERSION,
  blake2b256Hex,
  type PaymentReceipt,
} from "@cspr-agentpay/protocol";

import type {
  CasperPaymentAdapter,
  SettlePaymentInput,
  SettlementResult,
  SubmitPaymentInput,
} from "./types";

export class MockCasperPaymentAdapter implements CasperPaymentAdapter {
  readonly mode = "mock" as const;

  async submitPayment(input: SubmitPaymentInput): Promise<PaymentReceipt> {
    const issuedAt = (input.now ?? new Date()).toISOString();

    return {
      version: PROTOCOL_VERSION,
      paymentId: input.authorization.paymentId,
      policyId: input.authorization.policyId,
      agentId: input.authorization.agentId,
      merchantId: input.authorization.merchantId,
      requestHash: input.authorization.requestHash,
      amount: input.authorization.amount,
      currency: input.authorization.currency,
      status: "escrowed",
      casperDeployHash: mockId("deploy", input.authorization.paymentId),
      casperEventId: mockId("event", input.authorization.paymentId),
      receiptNonce: mockId("receipt", input.authorization.paymentId),
      issuedAt,
      expiresAt: input.requirement.expiresAt,
    };
  }

  async settlePayment(input: SettlePaymentInput): Promise<SettlementResult> {
    const settledAt = (input.now ?? new Date()).toISOString();

    return {
      paymentId: input.paymentId,
      status: "settled",
      casperDeployHash: mockId("settlement-deploy", input.paymentId),
      casperEventId: mockId("settlement-event", input.paymentId),
      settledAt,
    };
  }
}

export function mockId(kind: string, seed: string): string {
  return `mock-${kind}-${blake2b256Hex(`${kind}:${seed}`).slice(0, 32)}`;
}
