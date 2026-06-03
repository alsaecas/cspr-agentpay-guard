import {
  evaluatePaymentPolicy,
  updateSpendStateAfterAuthorization,
} from "@cspr-agentpay/policy";
import {
  PROTOCOL_VERSION,
  PaymentRequirementSchema,
  blake2b256Hex,
  createPaymentId,
  createRequestHash,
  createResponseHash,
  validateAgentPolicy,
  validateMerchant,
  type AgentPolicy,
  type AuditEvent,
  type AuditEventType,
  type CasperProof,
  type Merchant,
  type PaymentAuthorization,
  type PaymentReceipt,
  type PaymentStatus,
  type PolicyDenialReason,
} from "@cspr-agentpay/protocol";

import type {
  AuthorizePaymentInput,
  CasperPaymentAdapter,
  CreatePolicyInput,
  ListAuditEventsFilter,
  ListPaymentsFilter,
  MarkFulfilledInput,
  PaymentAuthorizationResult,
  RegisterMerchantInput,
  SettlePaymentInput,
  SettlementResult,
  SubmitPaymentInput,
  TxResult,
} from "./types";

export interface MockCasperPaymentAdapterOptions {
  seed?: string | undefined;
  seedDemoData?: boolean | undefined;
}

export class MockCasperPaymentAdapter implements CasperPaymentAdapter {
  readonly mode = "mock" as const;

  private readonly seed: string;
  private readonly policies = new Map<string, AgentPolicy>();
  private readonly merchants = new Map<string, Merchant>();
  private readonly authorizations = new Map<string, PaymentAuthorization>();
  private readonly payments = new Map<string, PaymentReceipt>();
  private readonly auditEvents: AuditEvent[] = [];
  private readonly usedRequirementNonces = new Set<string>();
  private readonly usedAuthorizationNonces = new Set<string>();
  private readonly usedReceiptNonces = new Set<string>();
  private readonly usedPaymentIds = new Set<string>();
  private sequence = 0;

  constructor(options: MockCasperPaymentAdapterOptions = {}) {
    this.seed =
      options.seed ?? process.env.AGENTPAY_DEMO_SEED ?? "agentpay-demo";
    if (options.seedDemoData ?? true) {
      this.seedDemoData();
    }
  }

  async createPolicy(input: CreatePolicyInput): Promise<AgentPolicy> {
    const policy = validateAgentPolicy(input);
    this.policies.set(policy.policyId, clone(policy));
    this.emit("policy_created", {
      createdAt: policy.createdAt,
      policyId: policy.policyId,
      message: `Policy ${policy.policyId} created.`,
    });
    return clone(policy);
  }

  async revokePolicy(policyId: string): Promise<TxResult> {
    const now = new Date().toISOString();
    const policy = this.policies.get(policyId);
    if (policy) {
      this.policies.set(policyId, { ...policy, status: "revoked" });
    }

    const proof = this.createProof("policy-revoked", policyId);
    this.emit("policy_revoked", {
      createdAt: now,
      policyId,
      proof,
      message: `Policy ${policyId} revoked.`,
    });

    return {
      status: "ok",
      proof,
      createdAt: now,
      policyId,
    };
  }

  async registerMerchant(input: RegisterMerchantInput): Promise<Merchant> {
    const merchant = validateMerchant(input);
    this.merchants.set(merchant.merchantId, clone(merchant));
    this.emit("merchant_registered", {
      createdAt: merchant.createdAt,
      merchantId: merchant.merchantId,
      message: `Merchant ${merchant.merchantId} registered.`,
    });
    return clone(merchant);
  }

  async authorizePayment(
    input: AuthorizePaymentInput,
  ): Promise<PaymentAuthorizationResult> {
    const now = input.now ?? new Date();
    const authorizedAt = now.toISOString();
    const requirement = PaymentRequirementSchema.parse(input.requirement);
    const policy = this.policies.get(input.policyId) ?? null;
    const merchant = this.merchants.get(requirement.merchantId) ?? null;
    const expectedRequestHash = input.request
      ? createRequestHash(input.request)
      : input.expectedRequestHash;

    const decision = evaluatePaymentPolicy({
      policy,
      merchant,
      requirement,
      expectedRequestHash,
      currentPayments: Array.from(this.payments.values()),
      now,
    });

    if (!decision.allowed) {
      this.emit("payment_denied", {
        createdAt: authorizedAt,
        policyId: input.policyId,
        merchantId: requirement.merchantId,
        status: "required",
        reason: decision.reason,
        message: decision.message,
      });
      throw new Error(decision.reason);
    }

    if (!policy || !merchant) {
      throw new Error("POLICY_NOT_FOUND");
    }

    const paymentNonce =
      input.authorizationNonce ??
      mockId(
        "payment-nonce",
        `${this.seed}:${decision.policyId}:${requirement.requirementId}`,
      );
    const authorizationNonceKey = `${policy.agentId}:${paymentNonce}`;

    const paymentId = createPaymentId({
      policyId: decision.policyId,
      merchantAccount: requirement.merchantAccount,
      amount: requirement.amount,
      endpointId: requirement.endpointId,
      requestHash: requirement.requestHash,
      nonce: paymentNonce,
    });

    if (this.usedPaymentIds.has(paymentId) || this.payments.has(paymentId)) {
      this.emit("replay_rejected", {
        createdAt: authorizedAt,
        policyId: decision.policyId,
        merchantId: decision.merchantId,
        paymentId,
        reason: "REPLAY_DETECTED",
        message: "Payment ID was already authorized.",
      });
      throw new Error("REPLAY_DETECTED");
    }

    const requirementNonceKey = `${requirement.merchantId}:${requirement.nonce}`;
    this.rejectReplayIfUsed(
      this.usedRequirementNonces,
      requirementNonceKey,
      "Requirement nonce was already used.",
      {
        createdAt: authorizedAt,
        policyId: decision.policyId,
        merchantId: decision.merchantId,
        paymentId,
      },
    );

    this.rejectReplayIfUsed(
      this.usedAuthorizationNonces,
      authorizationNonceKey,
      "Authorization nonce was already used.",
      {
        createdAt: authorizedAt,
        policyId: decision.policyId,
        merchantId: decision.merchantId,
        paymentId,
      },
    );

    const receiptNonce =
      input.receiptNonce ?? mockId("receipt", `${this.seed}:${paymentId}`);
    this.rejectReplayIfUsed(
      this.usedReceiptNonces,
      receiptNonce,
      "Receipt nonce was already used.",
      {
        createdAt: authorizedAt,
        policyId: decision.policyId,
        merchantId: decision.merchantId,
        paymentId,
      },
    );

    this.usedRequirementNonces.add(requirementNonceKey);
    this.usedAuthorizationNonces.add(authorizationNonceKey);
    this.usedReceiptNonces.add(receiptNonce);
    this.usedPaymentIds.add(paymentId);

    const authorization: PaymentAuthorization = {
      version: PROTOCOL_VERSION,
      paymentId,
      policyId: decision.policyId,
      agentId: policy.agentId,
      merchantId: requirement.merchantId,
      merchantAccount: requirement.merchantAccount,
      requirementId: requirement.requirementId,
      endpointId: requirement.endpointId,
      requestHash: requirement.requestHash,
      amount: requirement.amount,
      currency: requirement.currency,
      nonce: paymentNonce,
      expiresAt: requirement.expiresAt,
      authorizedAt,
      signature: mockId("signature", paymentId),
    };
    const proof = this.createProof("authorized", paymentId);
    const receipt = this.createReceipt({
      authorization,
      receiptNonce,
      status: "authorized",
      proof,
      issuedAt: authorizedAt,
      expiresAt: requirement.expiresAt,
    });
    const updatedPolicy = updateSpendStateAfterAuthorization(
      policy,
      requirement.amount,
    );

    this.policies.set(updatedPolicy.policyId, clone(updatedPolicy));
    this.authorizations.set(paymentId, clone(authorization));
    this.payments.set(paymentId, clone(receipt));
    this.emit("payment_authorized", {
      createdAt: authorizedAt,
      policyId: decision.policyId,
      merchantId: decision.merchantId,
      paymentId,
      status: "authorized",
      proof,
      message: `Payment ${paymentId} authorized.`,
    });

    return {
      authorization: clone(authorization),
      decision,
      receipt: clone(receipt),
      proof,
      updatedPolicy: clone(updatedPolicy),
    };
  }

  async submitPayment(input: SubmitPaymentInput): Promise<PaymentReceipt> {
    const now = input.now ?? new Date();
    const submittedAt = now.toISOString();
    const receipt = this.requirePayment(input.paymentId);
    this.assertStatus(receipt, ["authorized"], "submit payment");

    const submittedProof = this.createProof("submitted", input.paymentId);
    const submittedReceipt = this.withProofAndStatus(
      receipt,
      "submitted",
      submittedProof,
    );
    this.payments.set(input.paymentId, clone(submittedReceipt));
    this.emit("payment_submitted", {
      createdAt: submittedAt,
      policyId: receipt.policyId,
      merchantId: receipt.merchantId,
      paymentId: input.paymentId,
      status: "submitted",
      proof: submittedProof,
      message: `Payment ${input.paymentId} submitted.`,
    });

    const escrowProof = this.createProof("escrowed", input.paymentId);
    const escrowedReceipt = this.withProofAndStatus(
      submittedReceipt,
      "escrowed",
      escrowProof,
    );
    this.payments.set(input.paymentId, clone(escrowedReceipt));
    this.emit("payment_escrowed", {
      createdAt: submittedAt,
      policyId: receipt.policyId,
      merchantId: receipt.merchantId,
      paymentId: input.paymentId,
      status: "escrowed",
      proof: escrowProof,
      message: `Payment ${input.paymentId} escrowed.`,
    });

    return clone(escrowedReceipt);
  }

  async markFulfilled(input: MarkFulfilledInput): Promise<PaymentReceipt> {
    const now = input.now ?? new Date();
    const fulfilledAt = now.toISOString();
    const receipt = this.requirePayment(input.paymentId);
    this.assertStatus(receipt, ["escrowed"], "mark fulfilled");

    const responseHash =
      input.responseHash ?? createResponseHash(input.responseBody ?? {});
    const proof = this.createProof("fulfilled", input.paymentId);
    const fulfilledReceipt = {
      ...this.withProofAndStatus(receipt, "fulfilled", proof),
      responseHash,
    };
    this.payments.set(input.paymentId, clone(fulfilledReceipt));
    this.emit("payment_fulfilled", {
      createdAt: fulfilledAt,
      policyId: receipt.policyId,
      merchantId: receipt.merchantId,
      paymentId: input.paymentId,
      status: "fulfilled",
      proof,
      message: `Payment ${input.paymentId} fulfilled.`,
    });

    return clone(fulfilledReceipt);
  }

  async settlePayment(input: SettlePaymentInput): Promise<SettlementResult> {
    const now = input.now ?? new Date();
    const settledAt = now.toISOString();
    const receipt = this.requirePayment(input.paymentId);

    if (receipt.status === "settled") {
      this.emit("duplicate_settlement_rejected", {
        createdAt: settledAt,
        policyId: receipt.policyId,
        merchantId: receipt.merchantId,
        paymentId: input.paymentId,
        status: "settled",
        reason: "DUPLICATE_SETTLEMENT",
        message: `Payment ${input.paymentId} is already settled.`,
      });
      throw new Error("DUPLICATE_SETTLEMENT");
    }

    this.assertStatus(receipt, ["fulfilled"], "settle payment");

    const proof = this.createProof("settled", input.paymentId);
    const settledReceipt = this.withProofAndStatus(receipt, "settled", proof);
    this.payments.set(input.paymentId, clone(settledReceipt));
    this.emit("payment_settled", {
      createdAt: settledAt,
      policyId: receipt.policyId,
      merchantId: receipt.merchantId,
      paymentId: input.paymentId,
      status: "settled",
      proof,
      message: `Payment ${input.paymentId} settled.`,
    });

    return {
      paymentId: input.paymentId,
      status: "settled",
      proof,
      casperDeployHash: proofDisplayHash(proof),
      casperEventId: proofEventId(proof),
      settledAt,
    };
  }

  async expirePayment(paymentId: string): Promise<TxResult> {
    const now = new Date().toISOString();
    const receipt = this.requirePayment(paymentId);
    this.assertStatus(
      receipt,
      ["authorized", "submitted", "escrowed", "fulfilled"],
      "expire payment",
    );
    const proof = this.createProof("expired", paymentId);
    this.payments.set(
      paymentId,
      clone(this.withProofAndStatus(receipt, "expired", proof)),
    );
    this.emit("payment_expired", {
      createdAt: now,
      policyId: receipt.policyId,
      merchantId: receipt.merchantId,
      paymentId,
      status: "expired",
      proof,
      message: `Payment ${paymentId} expired.`,
    });

    return {
      status: "ok",
      proof,
      createdAt: now,
      paymentId,
    };
  }

  async getPolicy(policyId: string): Promise<AgentPolicy | null> {
    return cloneOrNull(this.policies.get(policyId));
  }

  async getMerchant(merchantId: string): Promise<Merchant | null> {
    return cloneOrNull(this.merchants.get(merchantId));
  }

  async getPayment(paymentId: string): Promise<PaymentReceipt | null> {
    return cloneOrNull(this.payments.get(paymentId));
  }

  async listPayments(
    filter: ListPaymentsFilter = {},
  ): Promise<PaymentReceipt[]> {
    return Array.from(this.payments.values())
      .filter((payment) => {
        return (
          (!filter.policyId || payment.policyId === filter.policyId) &&
          (!filter.merchantId || payment.merchantId === filter.merchantId) &&
          (!filter.status || payment.status === filter.status)
        );
      })
      .map((payment) => clone(payment));
  }

  async listAuditEvents(
    filter: ListAuditEventsFilter = {},
  ): Promise<AuditEvent[]> {
    return this.auditEvents
      .filter((event) => {
        return (
          (!filter.policyId || event.policyId === filter.policyId) &&
          (!filter.merchantId || event.merchantId === filter.merchantId) &&
          (!filter.paymentId || event.paymentId === filter.paymentId)
        );
      })
      .map((event) => clone(event));
  }

  private seedDemoData() {
    const createdAt = "2026-06-03T00:00:00.000Z";
    const policy: AgentPolicy = {
      version: PROTOCOL_VERSION,
      policyId: "policy_demo_agent_001",
      ownerAccount: "mock-owner-account",
      agentId: "agent_research_001",
      status: "active",
      currency: "CSPR",
      maxAmountPerPayment: "2500000000",
      totalBudget: "10000000000",
      spentAmount: "0",
      budgetWindow: "demo-total",
      allowedMerchantIds: ["merchant_market_data_001"],
      allowedResourcePatterns: ["GET https://api.example.test/premium/*"],
      expiresAt: "2026-06-04T00:00:00.000Z",
      policyNonce: "policy-nonce-001",
      createdAt,
    };
    const merchant: Merchant = {
      version: PROTOCOL_VERSION,
      merchantId: "merchant_market_data_001",
      displayName: "Market Data Merchant",
      status: "active",
      casperAccount: "mock-merchant-account",
      settlementAccount: "mock-merchant-account",
      allowedOrigins: ["https://api.example.test"],
      allowedResourcePatterns: ["GET https://api.example.test/premium/*"],
      createdAt,
    };

    this.policies.set(policy.policyId, clone(policy));
    this.merchants.set(merchant.merchantId, clone(merchant));
    this.emit("policy_created", {
      createdAt,
      policyId: policy.policyId,
      message: `Seed policy ${policy.policyId} loaded.`,
    });
    this.emit("merchant_registered", {
      createdAt,
      merchantId: merchant.merchantId,
      message: `Seed merchant ${merchant.merchantId} loaded.`,
    });
  }

  private rejectReplayIfUsed(
    set: Set<string>,
    key: string,
    message: string,
    context: {
      createdAt: string;
      policyId?: string | undefined;
      merchantId?: string | undefined;
      paymentId?: string | undefined;
    },
  ) {
    if (!set.has(key)) {
      return;
    }

    this.emit("replay_rejected", {
      ...context,
      reason: "REPLAY_DETECTED",
      message,
    });
    throw new Error("REPLAY_DETECTED");
  }

  private requirePayment(paymentId: string): PaymentReceipt {
    const receipt = this.payments.get(paymentId);
    if (!receipt) {
      throw new Error("PAYMENT_NOT_FOUND");
    }
    return receipt;
  }

  private assertStatus(
    receipt: PaymentReceipt,
    allowed: PaymentStatus[],
    action: string,
  ) {
    if (allowed.includes(receipt.status)) {
      return;
    }

    this.emit("payment_failed", {
      createdAt: new Date().toISOString(),
      policyId: receipt.policyId,
      merchantId: receipt.merchantId,
      paymentId: receipt.paymentId,
      status: "failed",
      message: `Cannot ${action} while payment is ${receipt.status}.`,
    });
    throw new Error("INVALID_STATE_TRANSITION");
  }

  private createReceipt(input: {
    authorization: PaymentAuthorization;
    receiptNonce: string;
    status: PaymentStatus;
    proof: CasperProof;
    issuedAt: string;
    expiresAt: string;
  }): PaymentReceipt {
    return {
      version: PROTOCOL_VERSION,
      paymentId: input.authorization.paymentId,
      policyId: input.authorization.policyId,
      agentId: input.authorization.agentId,
      merchantId: input.authorization.merchantId,
      merchantAccount: input.authorization.merchantAccount,
      endpointId: input.authorization.endpointId,
      requestHash: input.authorization.requestHash,
      amount: input.authorization.amount,
      currency: input.authorization.currency,
      status: input.status,
      chainMode: this.mode,
      proof: input.proof,
      casperDeployHash: proofDisplayHash(input.proof),
      casperEventId: proofEventId(input.proof),
      receiptNonce: input.receiptNonce,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
    };
  }

  private withProofAndStatus(
    receipt: PaymentReceipt,
    status: PaymentStatus,
    proof: CasperProof,
  ): PaymentReceipt {
    return {
      ...receipt,
      status,
      proof,
      casperDeployHash: proofDisplayHash(proof),
      casperEventId: proofEventId(proof),
    };
  }

  private createProof(kind: string, seed: string): CasperProof {
    return {
      kind: "mock",
      hash: mockId(kind, seed),
      eventId: mockId(`${kind}-event`, seed),
    };
  }

  private emit(
    type: AuditEventType,
    input: {
      createdAt: string;
      policyId?: string | undefined;
      merchantId?: string | undefined;
      paymentId?: string | undefined;
      status?: PaymentStatus | undefined;
      reason?:
        | PolicyDenialReason
        | "REPLAY_DETECTED"
        | "DUPLICATE_SETTLEMENT"
        | undefined;
      proof?: CasperProof | undefined;
      message: string;
      metadata?: Record<string, string | number | boolean | null> | undefined;
    },
  ) {
    this.sequence += 1;
    this.auditEvents.push({
      eventId: mockId(
        "event",
        `${this.seed}:${this.sequence}:${type}:${input.paymentId ?? ""}`,
      ),
      type,
      ...input,
    });
  }
}

export function mockId(kind: string, seed: string): string {
  return `mock-${kind}-${blake2b256Hex(`${kind}:${seed}`).slice(0, 32)}`;
}

function proofDisplayHash(proof: CasperProof): string {
  if (proof.kind === "mock") {
    return proof.hash;
  }
  if (proof.kind === "transaction-v1") {
    return proof.transactionHash;
  }
  return proof.deployHash;
}

function proofEventId(proof: CasperProof): string | undefined {
  return proof.eventId;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneOrNull<T>(value: T | undefined): T | null {
  return value ? clone(value) : null;
}
