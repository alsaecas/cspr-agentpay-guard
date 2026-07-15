import { decodePaymentRequiredHeader } from "@x402/core/http";
import {
  computeExpectedGuardedRequestHashes,
  normalizeUrl,
  type AgentPolicy,
  type GuardDecision,
  type Merchant,
  type PaymentSettlementEvidence,
} from "@cspr-agentpay/protocol";
import { evaluateGuardedPayment } from "@cspr-agentpay/policy";

import {
  X402_HEADERS,
  type X402PaymentAuthorization,
  type X402SettlementAdapter,
} from "./x402";

export interface GuardedFetchOptions {
  method?: string | undefined;
  body?: unknown;
  headers?: HeadersInit | undefined;
  policyId: string;
  agentId: string;
  policy: AgentPolicy;
  merchant: Merchant;
  endpointId?: string | undefined;
  expectedAmount?: string | undefined;
  expectedPayee?: string | undefined;
  settlementAdapter: X402SettlementAdapter;
  usedNonces?: Set<string> | undefined;
  policySignatureValid?: boolean | undefined;
  fetchFn?: typeof fetch | undefined;
  now?: Date | undefined;
}

export type GuardedFetchResult =
  | { paid: false; response: Response }
  | {
      paid: true;
      response: Response;
      decision: Extract<GuardDecision, { allowed: false }>;
      normalizedRequest?: import("@cspr-agentpay/protocol").GuardedPaymentRequest;
      settlementAdapterCalled: false;
    }
  | {
      paid: true;
      response: Response;
      decision: Extract<GuardDecision, { allowed: true }>;
      normalizedRequest: import("@cspr-agentpay/protocol").GuardedPaymentRequest;
      authorization: X402PaymentAuthorization;
      evidence: PaymentSettlementEvidence;
      settlementAdapterCalled: true;
      updatedPolicy: AgentPolicy;
    };

export async function guardedFetch(
  url: string,
  options: GuardedFetchOptions,
): Promise<GuardedFetchResult> {
  const fetchFn = options.fetchFn ?? fetch;
  const method = (options.method ?? "GET").toUpperCase();
  const normalizedUrl = normalizeUrl(url);
  const headers = new Headers(options.headers);
  const serializedBody = serializeBody(options.body, headers);
  const initialResponse = await fetchFn(normalizedUrl, {
    method,
    headers,
    ...(serializedBody === undefined ? {} : { body: serializedBody }),
  });

  if (initialResponse.status !== 402) {
    return { paid: false, response: initialResponse };
  }

  let paymentRequired: unknown;
  try {
    paymentRequired = await readPaymentRequired(initialResponse);
  } catch (error) {
    return deniedForMalformed(initialResponse, options, error);
  }

  let request;
  try {
    request = options.settlementAdapter.inspectRequirement({
      paymentRequired,
      method,
      url: normalizedUrl,
      body: options.body ?? {},
      agentId: options.agentId,
      endpointId: options.endpointId ?? normalizedUrl,
    });
  } catch (error) {
    return deniedForMalformed(initialResponse, options, error);
  }

  const hashes = computeExpectedGuardedRequestHashes({
    request,
    body: options.body ?? {},
    agentId: options.agentId,
    endpointId: options.endpointId ?? normalizedUrl,
  });
  const decision = evaluateGuardedPayment({
    policy:
      options.policy.policyId === options.policyId ? options.policy : null,
    merchant: options.merchant,
    request,
    expectedRequestHash: hashes.requestHash,
    expectedBodyHash: hashes.bodyHash,
    expectedAmount: options.expectedAmount,
    expectedPayee: options.expectedPayee,
    usedNonces: options.usedNonces,
    policySignatureValid: options.policySignatureValid,
    now: options.now,
  });

  if (!decision.allowed) {
    return {
      paid: true,
      response: initialResponse,
      decision,
      normalizedRequest: request,
      settlementAdapterCalled: false,
    };
  }

  const authorization =
    await options.settlementAdapter.createPaymentAuthorization({
      request,
      decision,
    });

  const retryHeaders = new Headers(headers);
  retryHeaders.set(X402_HEADERS.paymentSignature, authorization.paymentHeader);
  const premiumResponse = await fetchFn(normalizedUrl, {
    method,
    headers: retryHeaders,
    ...(serializedBody === undefined ? {} : { body: serializedBody }),
  });
  if (!premiumResponse.ok) {
    throw new Error(
      `Paid request retry failed with HTTP ${premiumResponse.status}.`,
    );
  }
  const evidence = await options.settlementAdapter.verifySettlement({
    response: premiumResponse,
    authorization,
  });
  if (evidence.status !== "settled") {
    throw new Error(evidence.message ?? "X402 settlement did not complete.");
  }

  const usedNonces = options.usedNonces;
  usedNonces?.add(`${request.merchantId}:${request.nonce}`);
  const updatedPolicy = {
    ...options.policy,
    spentAmount: (
      BigInt(options.policy.spentAmount) + BigInt(request.amount)
    ).toString(),
  };

  return {
    paid: true,
    response: premiumResponse,
    decision,
    normalizedRequest: request,
    authorization,
    evidence,
    settlementAdapterCalled: true,
    updatedPolicy,
  };
}

async function readPaymentRequired(response: Response): Promise<unknown> {
  const header = response.headers.get(X402_HEADERS.paymentRequired);
  if (header) {
    return decodePaymentRequiredHeader(header);
  }
  const body = (await response.clone().json()) as Record<string, unknown>;
  const paymentRequired = body.paymentRequired ?? body.paymentRequirement;
  if (!paymentRequired) {
    throw new Error("402 response did not include PAYMENT-REQUIRED.");
  }
  return paymentRequired;
}

function deniedForMalformed(
  response: Response,
  options: GuardedFetchOptions,
  error: unknown,
): Extract<GuardedFetchResult, { paid: true; settlementAdapterCalled: false }> {
  const message = error instanceof Error ? error.message : String(error);
  const reason = message.includes("REQUEST_HASH_MISMATCH")
    ? ("REQUEST_HASH_MISMATCH" as const)
    : ("MALFORMED_REQUIREMENT" as const);
  return {
    paid: true,
    response,
    settlementAdapterCalled: false,
    decision: {
      allowed: false,
      decision: "DENY",
      policyId: options.policyId,
      merchantId: options.merchant.merchantId,
      reason,
      message,
      checkedAt: (options.now ?? new Date()).toISOString(),
      checks: [{ check: "requirement", passed: false, reason, message }],
      budgetBefore: (
        BigInt(options.policy.totalBudget) - BigInt(options.policy.spentAmount)
      ).toString(),
      budgetAfter: (
        BigInt(options.policy.totalBudget) - BigInt(options.policy.spentAmount)
      ).toString(),
    },
  };
}

function serializeBody(body: unknown, headers: Headers): BodyInit | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }
  if (typeof body === "string" || body instanceof URLSearchParams) {
    return body;
  }
  headers.set("content-type", "application/json");
  return JSON.stringify(body);
}
