import { blake2b } from "@noble/hashes/blake2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

import { type PaymentIdInput, type RequestHashInput } from "./types";
import {
  canonicalJson,
  canonicalSelectedHeaders,
  normalizeUrl,
} from "./canonical";

export function blake2b256Hex(input: string): string {
  return bytesToHex(blake2b(utf8ToBytes(input), { dkLen: 32 }));
}

export function computeRequestHash(input: RequestHashInput): string {
  const requestBodyHash = blake2b256Hex(canonicalJson(input.body ?? {}));
  const selectedHeadersHash = blake2b256Hex(
    canonicalJson(canonicalSelectedHeaders(input.headers)),
  );

  return blake2b256Hex(
    [
      "CSPR_AGENTPAY_REQUEST_V1",
      input.method.toUpperCase(),
      normalizeUrl(input.url),
      input.resourceId,
      input.merchantId,
      input.agentId,
      requestBodyHash,
      selectedHeadersHash,
    ].join("\n"),
  );
}

export function computePaymentId(input: PaymentIdInput): string {
  return blake2b256Hex(
    [
      "CSPR_AGENTPAY_PAYMENT_V1",
      input.policyId,
      input.agentId,
      input.merchantId,
      input.requirementId,
      input.requestHash,
      input.amount,
      input.currency,
      input.requirementNonce,
      input.authorizationNonce,
    ].join("\n"),
  );
}
