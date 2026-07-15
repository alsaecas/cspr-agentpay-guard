import {
  buildCasperPaymentAuthorizationFromRequest,
  verifyCasperAuthorizationSignature,
} from "@cspr-agentpay/casper-adapter";
import {
  assertAuthorizationMatchesRequest,
  canonicalJson,
  computeExpectedGuardedRequestHashes,
  createCasperPaymentAuthorizationHash,
  normalizeX402PaymentRequired,
  validateCasperPaymentAuthorization,
  type CasperPaymentAuthorization,
  type GuardedPaymentRequest,
} from "@cspr-agentpay/protocol";
import type { PaymentRequired } from "@x402/core/types";

export interface TrustedCasperPaymentTerms {
  policyId: string;
  agentId: string;
  merchantId: string;
  expectedSigner: string;
  destination: string;
  network: "casper:casper-test";
  asset: "CSPR";
  amountMotes: string;
  facilitator: string;
  endpointId: string;
}

export function reconstructServerCasperAuthorization(input: {
  paymentRequired: PaymentRequired;
  method: string;
  url: string;
  body?: unknown;
  trusted: TrustedCasperPaymentTerms;
  now?: Date;
}): {
  authorization: CasperPaymentAuthorization;
  request: GuardedPaymentRequest;
  authorizationHash: string;
  expectedSigner: string;
} {
  if (
    !/^(01[0-9a-fA-F]{64}|02[0-9a-fA-F]{66})$/.test(
      input.trusted.expectedSigner,
    )
  ) {
    throw new Error("SERVER_EXPECTED_SIGNER_INVALID");
  }
  const request = normalizeX402PaymentRequired({
    paymentRequired: input.paymentRequired,
    method: input.method,
    url: input.url,
    body: input.body ?? {},
    agentId: input.trusted.agentId,
    endpointId: input.trusted.endpointId,
  });
  const hashes = computeExpectedGuardedRequestHashes({
    request,
    body: input.body ?? {},
    agentId: input.trusted.agentId,
    endpointId: input.trusted.endpointId,
  });
  const termsMatch =
    request.requestHash === hashes.requestHash &&
    request.bodyHash === hashes.bodyHash &&
    request.merchantId === input.trusted.merchantId &&
    request.payee.toLowerCase() === input.trusted.destination.toLowerCase() &&
    request.network === input.trusted.network &&
    request.asset === input.trusted.asset &&
    request.amount === input.trusted.amountMotes &&
    request.facilitator === input.trusted.facilitator;
  if (!termsMatch) throw new Error("SERVER_ISSUED_REQUIREMENT_INVALID");

  const authorization = buildCasperPaymentAuthorizationFromRequest({
    request,
    policyId: input.trusted.policyId,
    agentId: input.trusted.agentId,
  });
  validateCasperPaymentAuthorization(
    authorization,
    input.now === undefined ? {} : { now: input.now },
  );
  assertAuthorizationMatchesRequest(authorization, request);
  return {
    authorization,
    request,
    authorizationHash: createCasperPaymentAuthorizationHash(authorization),
    expectedSigner: input.trusted.expectedSigner.toLowerCase(),
  };
}

export function assertClientAuthorizationEqualsExpected(input: {
  clientAuthorization: unknown;
  expectedAuthorization: CasperPaymentAuthorization;
  request: GuardedPaymentRequest;
  now?: Date;
}): CasperPaymentAuthorization {
  const client = validateCasperPaymentAuthorization(
    input.clientAuthorization,
    input.now === undefined ? {} : { now: input.now },
  );
  const expected = input.expectedAuthorization;
  if (client.paymentId !== expected.paymentId)
    throw new Error("PAYMENT_ID_MISMATCH");
  if (client.transferId !== expected.transferId)
    throw new Error("TRANSFER_ID_MISMATCH");
  if (client.requirementHash !== expected.requirementHash) {
    throw new Error("REQUIREMENT_HASH_MISMATCH");
  }
  if (
    client.requestHash !== expected.requestHash ||
    client.bodyHash !== expected.bodyHash ||
    client.destination.toLowerCase() !== expected.destination.toLowerCase() ||
    client.amountMotes !== expected.amountMotes ||
    client.network !== expected.network ||
    client.asset !== expected.asset ||
    client.nonce !== expected.nonce
  ) {
    throw new Error("AUTHORIZATION_REQUEST_MISMATCH");
  }
  if (canonicalJson(client) !== canonicalJson(expected)) {
    throw new Error("AUTHORIZATION_FIELD_MISMATCH");
  }
  assertAuthorizationMatchesRequest(client, input.request);
  return client;
}

export function assertCasperAuthorizationSignature(input: {
  signer: unknown;
  expectedSigner: string;
  authorizationHash: string;
  clientAuthorizationHash: unknown;
  signature: unknown;
}): void {
  if (
    typeof input.clientAuthorizationHash !== "string" ||
    input.clientAuthorizationHash !== input.authorizationHash
  ) {
    throw new Error("AUTHORIZATION_HASH_MISMATCH");
  }
  if (
    typeof input.signer !== "string" ||
    input.signer.toLowerCase() !== input.expectedSigner.toLowerCase() ||
    typeof input.signature !== "string" ||
    !verifyCasperAuthorizationSignature({
      publicKey: input.expectedSigner,
      authorizationHash: input.authorizationHash,
      signature: input.signature,
    })
  ) {
    throw new Error("AUTHORIZATION_SIGNATURE_INVALID");
  }
}
