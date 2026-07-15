import { z } from "zod";

import { canonicalJson } from "./canonical";
import { blake2b256Hex } from "./hash";
import {
  CASPER_PAYMENT_AUTHORIZATION_VERSION,
  type CasperPaymentAuthorization,
  type GuardedPaymentRequest,
} from "./types";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const positiveInteger = z.string().regex(/^[1-9]\d*$/);
const transferId = positiveInteger.refine(
  (value) => BigInt(value) <= BigInt(Number.MAX_SAFE_INTEGER),
  "transferId must fit in a JavaScript safe integer for casper-js-sdk",
);
const destination = z
  .string()
  .refine(
    (value) =>
      /^(01[0-9a-fA-F]{64}|02[0-9a-fA-F]{66})$/.test(value) ||
      /^(account-hash-)?[0-9a-fA-F]{64}$/.test(value),
    "destination must be a Casper public key or account hash",
  );

export const CasperPaymentAuthorizationSchema = z
  .object({
    version: z.literal(CASPER_PAYMENT_AUTHORIZATION_VERSION),
    paymentId: hash,
    policyId: z.string().trim().min(1),
    agentId: z.string().trim().min(1),
    requestHash: hash,
    bodyHash: hash,
    merchantId: z.string().trim().min(1),
    destination,
    network: z.literal("casper-test"),
    asset: z.literal("CSPR"),
    amountMotes: positiveInteger,
    nonce: z.string().trim().min(1),
    transferId,
    issuedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    facilitator: z.string().url(),
    requirementHash: hash,
  })
  .strict();

export function canonicalizeCasperPaymentAuthorization(
  input: CasperPaymentAuthorization,
): string {
  return canonicalJson(CasperPaymentAuthorizationSchema.parse(input));
}

export function createCasperPaymentAuthorizationHash(
  input: CasperPaymentAuthorization,
): string {
  return blake2b256Hex(
    `CSPR_AGENTPAY_CASPER_AUTHORIZATION_V1\n${canonicalizeCasperPaymentAuthorization(input)}`,
  );
}

export function createCasperRequirementHash(
  requirement: GuardedPaymentRequest,
): string {
  return blake2b256Hex(
    `CSPR_AGENTPAY_X402_REQUIREMENT_V1\n${canonicalJson(requirement.selectedRequirement)}`,
  );
}

export function deriveCasperTransferId(authorizationSeed: string): string {
  if (!/^[a-f0-9]{64}$/.test(authorizationSeed)) {
    throw new Error("transfer ID seed must be a 32-byte lowercase hex hash");
  }
  return BigInt(`0x${authorizationSeed.slice(0, 13)}`).toString();
}

export function validateCasperPaymentAuthorization(
  input: unknown,
  options: { now?: Date } = {},
): CasperPaymentAuthorization {
  const authorization = CasperPaymentAuthorizationSchema.parse(input);
  if (
    Date.parse(authorization.issuedAt) >= Date.parse(authorization.expiresAt)
  ) {
    throw new Error("AUTHORIZATION_INVALID_WINDOW");
  }
  if (
    Date.parse(authorization.expiresAt) <= (options.now ?? new Date()).getTime()
  ) {
    throw new Error("AUTHORIZATION_EXPIRED");
  }
  return authorization;
}

export function assertAuthorizationMatchesRequest(
  authorization: CasperPaymentAuthorization,
  request: GuardedPaymentRequest,
): void {
  const mismatches = [
    authorization.requestHash !== request.requestHash && "requestHash",
    authorization.bodyHash !== request.bodyHash && "bodyHash",
    authorization.merchantId !== request.merchantId && "merchantId",
    authorization.destination.toLowerCase() !== request.payee.toLowerCase() &&
      "destination",
    authorization.amountMotes !== request.amount && "amountMotes",
    authorization.nonce !== request.nonce && "nonce",
    authorization.network !== request.network.replace(/^casper:/, "") &&
      "network",
    authorization.asset !== request.asset && "asset",
    authorization.requirementHash !== createCasperRequirementHash(request) &&
      "requirementHash",
  ].filter(Boolean);
  if (mismatches.length > 0) {
    throw new Error(`AUTHORIZATION_REQUEST_MISMATCH: ${mismatches.join(", ")}`);
  }
}
