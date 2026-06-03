import { blake2b } from "@noble/hashes/blake2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { z } from "zod";

import {
  type CreatePaymentIdInput,
  type CreateRequestHashInput,
} from "./types";
import { canonicalJson, normalizeUrl } from "./canonical";

const hexHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const nonEmptyStringSchema = z.string().trim().min(1);
const positiveAmountSchema = nonEmptyStringSchema.refine(
  (value) => {
    try {
      return /^(0|[1-9]\d*)$/.test(value) && BigInt(value) > 0n;
    } catch {
      return false;
    }
  },
  { message: "Amount must be a positive integer string." },
);

const createRequestHashInputSchema = z
  .object({
    method: nonEmptyStringSchema,
    url: z.string().url(),
    bodyHash: hexHashSchema,
    endpointId: nonEmptyStringSchema,
    merchantId: nonEmptyStringSchema,
    agentId: nonEmptyStringSchema,
    nonce: nonEmptyStringSchema,
    expiresAt: z.string().datetime(),
  })
  .strict();

const createPaymentIdInputSchema = z
  .object({
    policyId: nonEmptyStringSchema,
    merchantAccount: nonEmptyStringSchema,
    amount: positiveAmountSchema,
    endpointId: nonEmptyStringSchema,
    requestHash: hexHashSchema,
    nonce: nonEmptyStringSchema,
  })
  .strict();

export function blake2b256Hex(input: string): string {
  return bytesToHex(blake2b(utf8ToBytes(input), { dkLen: 32 }));
}

export function createBodyHash(requestBody: unknown): string {
  return blake2b256Hex(canonicalJson(requestBody ?? {}));
}

export function createResponseHash(responseBody: unknown): string {
  return blake2b256Hex(
    ["CSPR_AGENTPAY_RESPONSE_V1", canonicalJson(responseBody ?? {})].join("\n"),
  );
}

export function createRequestHash(input: CreateRequestHashInput): string {
  const parsed = createRequestHashInputSchema.parse(input);

  return blake2b256Hex(
    [
      "CSPR_AGENTPAY_REQUEST_V1",
      parsed.method.toUpperCase(),
      normalizeUrl(parsed.url),
      parsed.bodyHash,
      parsed.endpointId,
      parsed.merchantId,
      parsed.agentId,
      parsed.nonce,
      new Date(parsed.expiresAt).toISOString(),
    ].join("\n"),
  );
}

export function createPaymentId(input: CreatePaymentIdInput): string {
  const parsed = createPaymentIdInputSchema.parse(input);

  return blake2b256Hex(
    [
      "CSPR_AGENTPAY_PAYMENT_V1",
      parsed.policyId,
      parsed.merchantAccount,
      parsed.amount,
      parsed.endpointId,
      parsed.requestHash,
      parsed.nonce,
    ].join("\n"),
  );
}

export const computeRequestHash = createRequestHash;
export const computePaymentId = createPaymentId;
