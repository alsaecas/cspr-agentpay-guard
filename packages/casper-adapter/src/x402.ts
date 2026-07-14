import type {
  PaymentPayload,
  PaymentRequired,
  PaymentRequirements,
  SettleResponse,
} from "@x402/core/types";
import {
  HTTPFacilitatorClient,
  type FacilitatorClient,
} from "@x402/core/server";
import {
  decodePaymentResponseHeader,
  encodePaymentSignatureHeader,
} from "@x402/core/http";
import {
  blake2b256Hex,
  canonicalJson,
  normalizeX402PaymentRequired,
  type GuardDecision,
  type GuardedPaymentRequest,
  type NormalizeX402RequirementInput,
  type PaymentSettlementEvidence,
} from "@cspr-agentpay/protocol";

export const X402_HEADERS = {
  paymentRequired: "PAYMENT-REQUIRED",
  paymentSignature: "PAYMENT-SIGNATURE",
  paymentResponse: "PAYMENT-RESPONSE",
} as const;

export interface X402PaymentAuthorization {
  authorizationId: string;
  paymentHeader: string;
  paymentPayload: PaymentPayload;
  request: GuardedPaymentRequest;
}

export interface X402SettlementResult {
  authorization: X402PaymentAuthorization;
  evidence: PaymentSettlementEvidence;
}

export interface X402SettlementAdapter {
  readonly mode: "mock" | "casper-testnet";
  inspectRequirement(
    input: NormalizeX402RequirementInput,
  ): GuardedPaymentRequest;
  createPaymentAuthorization(input: {
    request: GuardedPaymentRequest;
    decision: Extract<GuardDecision, { allowed: true }>;
  }): Promise<X402PaymentAuthorization>;
  settle(input: X402PaymentAuthorization): Promise<X402SettlementResult>;
  verifySettlement(input: {
    response: Response;
    authorization: X402PaymentAuthorization;
  }): Promise<PaymentSettlementEvidence>;
}

export class MockX402SettlementAdapter implements X402SettlementAdapter {
  readonly mode = "mock" as const;
  readonly calls = { inspect: 0, authorize: 0, settle: 0, verify: 0 };

  private readonly usedNonces = new Set<string>();
  private readonly settledAuthorizations = new Set<string>();

  inspectRequirement(
    input: NormalizeX402RequirementInput,
  ): GuardedPaymentRequest {
    this.calls.inspect += 1;
    return normalizeX402PaymentRequired(input);
  }

  async createPaymentAuthorization(input: {
    request: GuardedPaymentRequest;
    decision: Extract<GuardDecision, { allowed: true }>;
  }): Promise<X402PaymentAuthorization> {
    this.calls.authorize += 1;
    const nonceKey = `${input.request.merchantId}:${input.request.nonce}`;
    if (this.usedNonces.has(nonceKey)) {
      throw new Error("NONCE_ALREADY_USED");
    }
    this.usedNonces.add(nonceKey);

    const authorizationId = `mock-x402-authorization-${blake2b256Hex(
      `${input.decision.policyId}:${input.request.requestHash}:${input.request.nonce}`,
    ).slice(0, 32)}`;
    const paymentPayload: PaymentPayload = {
      x402Version: 2,
      resource: { url: input.request.url },
      accepted: input.request.selectedRequirement as PaymentRequirements,
      payload: {
        authorizationId,
        signature: `mock-signature-${blake2b256Hex(authorizationId).slice(0, 32)}`,
      },
    };

    return {
      authorizationId,
      paymentHeader: encodePaymentSignatureHeader(paymentPayload),
      paymentPayload,
      request: input.request,
    };
  }

  async settle(input: X402PaymentAuthorization): Promise<X402SettlementResult> {
    this.calls.settle += 1;
    if (this.settledAuthorizations.has(input.authorizationId)) {
      throw new Error("DUPLICATE_SETTLEMENT");
    }
    this.settledAuthorizations.add(input.authorizationId);

    return {
      authorization: input,
      evidence: {
        mode: "mock",
        status: "settled",
        network: input.request.network,
        settlementId: `mock-x402-settlement-${blake2b256Hex(input.authorizationId).slice(0, 32)}`,
      },
    };
  }

  async verifySettlement(input: {
    response: Response;
    authorization: X402PaymentAuthorization;
  }): Promise<PaymentSettlementEvidence> {
    this.calls.verify += 1;
    const header = input.response.headers.get(X402_HEADERS.paymentResponse);
    if (!header) {
      throw new Error("MISSING_PAYMENT_RESPONSE");
    }
    const response = decodePaymentResponseHeader(header);
    if (!response.success) {
      throw new Error(response.errorReason ?? "SETTLEMENT_FAILED");
    }
    return (await this.settle(input.authorization)).evidence;
  }
}

export type X402CasperSigner = (input: {
  paymentRequired: PaymentRequired;
  paymentRequirements: PaymentRequirements;
  request: GuardedPaymentRequest;
}) => Promise<PaymentPayload>;

export interface RealX402SettlementAdapterConfig {
  network: string;
  facilitatorUrl?: string | undefined;
  signer?: X402CasperSigner | undefined;
  facilitatorClient?: FacilitatorClient | undefined;
}

/**
 * Real x402/Casper boundary. @x402/core provides the official v2 transport and
 * facilitator contract, but no Casper scheme implementation. Without an
 * injected Casper signer and facilitator client this adapter fails closed.
 */
export class RealX402SettlementAdapter implements X402SettlementAdapter {
  readonly mode = "casper-testnet" as const;

  constructor(private readonly config: RealX402SettlementAdapterConfig) {}

  static getMissingConfiguration(
    env: NodeJS.ProcessEnv = process.env,
  ): string[] {
    return [
      "X402_CASPER_FACILITATOR_URL",
      "CASPER_TESTNET_PUBLIC_KEY",
      "CASPER_TESTNET_SECRET_KEY_PATH",
    ].filter((name) => !env[name]);
  }

  static assertConfiguration(env: NodeJS.ProcessEnv = process.env): void {
    const missing = RealX402SettlementAdapter.getMissingConfiguration(env);
    if (missing.length > 0) {
      throw new Error(
        `Real Casper x402 configuration is incomplete. Missing: ${missing.join(", ")}. ` +
          "Mock mode remains available; no signing or settlement was attempted.",
      );
    }
  }

  inspectRequirement(
    input: NormalizeX402RequirementInput,
  ): GuardedPaymentRequest {
    return normalizeX402PaymentRequired(input);
  }

  async createPaymentAuthorization(input: {
    request: GuardedPaymentRequest;
    decision: Extract<GuardDecision, { allowed: true }>;
  }): Promise<X402PaymentAuthorization> {
    if (input.request.network !== this.config.network) {
      throw new Error("NETWORK_NOT_ALLOWED");
    }
    if (!this.config.signer) {
      throw new Error(
        "X402_CASPER_SIGNER_UNAVAILABLE: @x402/core 2.18.0 has no official Casper scheme signer; inject a verified Casper signer implementation.",
      );
    }

    const paymentRequired = input.request
      .originalPaymentRequired as PaymentRequired;
    const requirements = input.request
      .selectedRequirement as PaymentRequirements;
    const paymentPayload = await this.config.signer({
      paymentRequired,
      paymentRequirements: requirements,
      request: input.request,
    });
    const authorizationId = blake2b256Hex(canonicalJson(paymentPayload));

    return {
      authorizationId,
      paymentHeader: encodePaymentSignatureHeader(paymentPayload),
      paymentPayload,
      request: input.request,
    };
  }

  async settle(input: X402PaymentAuthorization): Promise<X402SettlementResult> {
    if (!this.config.facilitatorClient) {
      return {
        authorization: input,
        evidence: {
          mode: "casper-testnet",
          status: "unsupported",
          network: input.request.network,
          message:
            "No verified Casper-capable x402 facilitator client is configured.",
        },
      };
    }

    const response = await this.config.facilitatorClient.settle(
      input.paymentPayload,
      input.request.selectedRequirement as PaymentRequirements,
    );
    return {
      authorization: input,
      evidence: settlementResponseToEvidence(response),
    };
  }

  async verifySettlement(input: {
    response: Response;
    authorization: X402PaymentAuthorization;
  }): Promise<PaymentSettlementEvidence> {
    const header = input.response.headers.get(X402_HEADERS.paymentResponse);
    if (!header) {
      throw new Error("MISSING_PAYMENT_RESPONSE");
    }
    return settlementResponseToEvidence(decodePaymentResponseHeader(header));
  }
}

export function loadRealX402SettlementAdapterFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  signer?: X402CasperSigner,
): RealX402SettlementAdapter {
  const facilitatorUrl = env.X402_CASPER_FACILITATOR_URL;
  return new RealX402SettlementAdapter({
    network: env.X402_CASPER_NETWORK ?? "casper:casper-test",
    ...(facilitatorUrl ? { facilitatorUrl } : {}),
    ...(facilitatorUrl
      ? {
          facilitatorClient: new HTTPFacilitatorClient({ url: facilitatorUrl }),
        }
      : {}),
    ...(signer ? { signer } : {}),
  });
}

function settlementResponseToEvidence(
  response: SettleResponse,
): PaymentSettlementEvidence {
  if (!response.success) {
    return {
      mode: "casper-testnet",
      status: "failed",
      network: response.network,
      message:
        response.errorMessage ?? response.errorReason ?? "Settlement failed.",
    };
  }
  if (!/^[a-fA-F0-9]{64}$/.test(response.transaction)) {
    throw new Error("INVALID_CASPER_TRANSACTION_HASH");
  }
  return {
    mode: "casper-testnet",
    status: "settled",
    network: response.network,
    transactionHash: response.transaction,
    explorerUrl: `https://testnet.cspr.live/transaction/${response.transaction}`,
  };
}
