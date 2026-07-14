import { z } from "zod";

import { normalizeUrl } from "./canonical";
import { createBodyHash, createRequestHash } from "./hash";
import { PROTOCOL_VERSION, type GuardedPaymentRequest } from "./types";
import { GuardedPaymentRequestSchema } from "./validation";

const guardMetadataSchema = z
  .object({
    merchantId: z.string().trim().min(1),
    providerId: z.string().trim().min(1).optional(),
    nonce: z.string().trim().min(1),
    issuedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    requestHash: z.string().regex(/^[a-f0-9]{64}$/),
    bodyHash: z.string().regex(/^[a-f0-9]{64}$/),
    facilitator: z.string().url().optional(),
  })
  .strict();

const paymentRequiredV2Schema = z
  .object({
    x402Version: z.literal(2),
    resource: z.object({ url: z.string().url() }).passthrough(),
    accepts: z
      .array(
        z
          .object({
            scheme: z.string().trim().min(1),
            network: z.string().trim().min(1),
            asset: z.string().trim().min(1),
            amount: z.string().regex(/^[1-9]\d*$/),
            payTo: z.string().trim().min(1),
            maxTimeoutSeconds: z.number().int().positive(),
            extra: z.record(z.string(), z.unknown()),
          })
          .passthrough(),
      )
      .min(1),
    extensions: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export interface NormalizeX402RequirementInput {
  paymentRequired: unknown;
  method: string;
  url: string;
  body?: unknown;
  agentId: string;
  endpointId?: string | undefined;
  select?: (accepts: Record<string, unknown>[]) => number;
}

/** Normalize an official x402 v2 PaymentRequired into the fail-closed guard model. */
export function normalizeX402PaymentRequired(
  input: NormalizeX402RequirementInput,
): GuardedPaymentRequest {
  const parsed = paymentRequiredV2Schema.parse(input.paymentRequired);
  const selectedIndex = input.select?.(parsed.accepts) ?? 0;
  const selected = parsed.accepts[selectedIndex];
  if (!selected) {
    throw new Error(
      "MALFORMED_REQUIREMENT: selected x402 payment option is missing",
    );
  }

  const metadata = guardMetadataSchema.parse(selected.extra.agentPayGuard);
  const url = normalizeUrl(input.url);
  if (normalizeUrl(parsed.resource.url) !== url) {
    throw new Error("REQUEST_HASH_MISMATCH");
  }

  return GuardedPaymentRequestSchema.parse({
    version: PROTOCOL_VERSION,
    x402Version: 2,
    scheme: selected.scheme,
    method: input.method.toUpperCase(),
    url,
    endpointId: input.endpointId ?? parsed.resource.url,
    bodyHash: metadata.bodyHash,
    requestHash: metadata.requestHash,
    merchantId: metadata.merchantId,
    providerId: metadata.providerId ?? metadata.merchantId,
    payee: selected.payTo,
    network: selected.network,
    asset: selected.asset,
    amount: selected.amount,
    nonce: metadata.nonce,
    issuedAt: metadata.issuedAt,
    expiresAt: metadata.expiresAt,
    facilitator: metadata.facilitator,
    originalPaymentRequired: parsed,
    selectedRequirement: selected,
  }) satisfies GuardedPaymentRequest;
}

export function computeExpectedGuardedRequestHashes(input: {
  request: GuardedPaymentRequest;
  body?: unknown;
  agentId: string;
  endpointId?: string | undefined;
}): { bodyHash: string; requestHash: string } {
  const bodyHash = createBodyHash(input.body ?? {});
  return {
    bodyHash,
    requestHash: createRequestHash({
      method: input.request.method,
      url: input.request.url,
      bodyHash,
      endpointId: input.endpointId ?? input.request.endpointId,
      merchantId: input.request.merchantId,
      agentId: input.agentId,
      nonce: input.request.nonce,
      expiresAt: input.request.expiresAt,
    }),
  };
}
