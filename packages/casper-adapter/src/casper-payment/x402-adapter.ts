import {
  decodePaymentResponseHeader,
  encodePaymentSignatureHeader,
} from "@x402/core/http";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import {
  assertAuthorizationMatchesRequest,
  normalizeX402PaymentRequired,
  type GuardDecision,
  type GuardedPaymentRequest,
  type NormalizeX402RequirementInput,
  type PaymentSettlementEvidence,
} from "@cspr-agentpay/protocol";

import {
  X402_HEADERS,
  type X402PaymentAuthorization,
  type X402SettlementAdapter,
  type X402SettlementResult,
} from "../x402";
import {
  buildCasperPaymentAuthorization,
  RealGuardedCasperPaymentFlow,
} from "./flow";
import type { CasperSettlementEvidence } from "./types";

/** Project-specific direct native-CSPR x402 scheme; not an official Casper x402 facilitator. */
export class DirectCasperX402SettlementAdapter implements X402SettlementAdapter {
  readonly mode = "casper-testnet" as const;
  readonly #results = new Map<string, CasperSettlementEvidence>();

  constructor(
    readonly agentId: string,
    readonly flow: RealGuardedCasperPaymentFlow,
    readonly dryRun = false,
  ) {}

  inspectRequirement(
    input: NormalizeX402RequirementInput,
  ): GuardedPaymentRequest {
    return normalizeX402PaymentRequired(input);
  }

  async createPaymentAuthorization(input: {
    request: GuardedPaymentRequest;
    decision: Extract<GuardDecision, { allowed: true }>;
  }): Promise<X402PaymentAuthorization> {
    const authorization = buildCasperPaymentAuthorization({
      ...input,
      agentId: this.agentId,
    });
    assertAuthorizationMatchesRequest(authorization, input.request);
    const result = await this.flow.execute({
      authorization,
      dryRun: this.dryRun,
    });
    if (!result.evidence && !this.dryRun)
      throw new Error("SETTLEMENT_NOT_VERIFIED");
    const authorizationId = result.signed.authorizationHash;
    if (result.evidence) this.#results.set(authorizationId, result.evidence);
    const paymentPayload: PaymentPayload = {
      x402Version: 2,
      resource: { url: input.request.url },
      accepted: input.request.selectedRequirement as PaymentRequirements,
      payload: {
        scheme: "agentpay-casper-native-v1",
        authorization,
        authorizationHash: result.signed.authorizationHash,
        authorizationSignature: result.signed.authorizationSignature,
        transactionHash: result.signed.transactionHash,
        signer: result.signed.signer,
        verified: Boolean(result.evidence),
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
    const evidence = this.#results.get(input.authorizationId);
    if (!evidence) throw new Error("SETTLEMENT_NOT_VERIFIED");
    return { authorization: input, evidence: this.#protocolEvidence(evidence) };
  }

  async verifySettlement(input: {
    response: Response;
    authorization: X402PaymentAuthorization;
  }): Promise<PaymentSettlementEvidence> {
    const local = this.#results.get(input.authorization.authorizationId);
    if (!local) throw new Error("SETTLEMENT_NOT_VERIFIED");
    const header = input.response.headers.get(X402_HEADERS.paymentResponse);
    if (!header) throw new Error("MISSING_PAYMENT_RESPONSE");
    const response = decodePaymentResponseHeader(header);
    if (
      !response.success ||
      response.transaction.toLowerCase() !== local.transactionHash.toLowerCase()
    ) {
      throw new Error("PAYMENT_RESPONSE_MISMATCH");
    }
    return this.#protocolEvidence(local);
  }

  #protocolEvidence(
    evidence: CasperSettlementEvidence,
  ): PaymentSettlementEvidence {
    return {
      mode: "casper-testnet",
      status: "settled",
      network: "casper:casper-test",
      transactionHash: evidence.transactionHash,
      explorerUrl: `https://testnet.cspr.live/transaction/${evidence.transactionHash}`,
    };
  }
}
