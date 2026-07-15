import {
  CASPER_PAYMENT_AUTHORIZATION_VERSION,
  createCasperPaymentAuthorizationHash,
  createCasperRequirementHash,
  createPaymentId,
  deriveCasperTransferId,
  type CasperPaymentAuthorization,
  type GuardDecision,
  type GuardedPaymentRequest,
} from "@cspr-agentpay/protocol";

import { FileSubmissionStore } from "./idempotency";
import { pollTransaction } from "./submitter";
import type {
  CasperPaymentSigner,
  CasperSettlementEvidence,
  CasperTransactionSubmitter,
  SignedCasperPayment,
} from "./types";
import { CasperSettlementVerifier } from "./verifier";

export function buildCasperPaymentAuthorization(input: {
  request: GuardedPaymentRequest;
  decision: Extract<GuardDecision, { allowed: true }>;
  agentId: string;
  now?: Date;
}): CasperPaymentAuthorization {
  const issuedAt = (
    input.now ?? new Date(input.decision.checkedAt)
  ).toISOString();
  const paymentId = createPaymentId({
    policyId: input.decision.policyId,
    merchantAccount: input.request.payee,
    amount: input.request.amount,
    endpointId: input.request.endpointId,
    requestHash: input.request.requestHash,
    nonce: input.request.nonce,
  });
  return {
    version: CASPER_PAYMENT_AUTHORIZATION_VERSION,
    paymentId,
    policyId: input.decision.policyId,
    agentId: input.agentId,
    requestHash: input.request.requestHash,
    bodyHash: input.request.bodyHash,
    merchantId: input.request.merchantId,
    destination: input.request.payee,
    network: "casper-test",
    asset: "CSPR",
    amountMotes: input.request.amount,
    nonce: input.request.nonce,
    transferId: deriveCasperTransferId(paymentId),
    issuedAt,
    expiresAt: input.request.expiresAt,
    facilitator: input.request.facilitator ?? new URL(input.request.url).origin,
    requirementHash: createCasperRequirementHash(input.request),
  };
}

export class RealGuardedCasperPaymentFlow {
  constructor(
    readonly signer: CasperPaymentSigner,
    readonly submitter: CasperTransactionSubmitter,
    readonly verifier: CasperSettlementVerifier,
    readonly store: FileSubmissionStore,
  ) {
    if (store.mode !== "real")
      throw new Error("REAL_FLOW_REQUIRES_REAL_IDEMPOTENCY_STORE");
  }

  async execute(input: {
    authorization: CasperPaymentAuthorization;
    dryRun?: boolean;
    poll?: { timeoutMs?: number; intervalMs?: number };
  }): Promise<{
    signed: SignedCasperPayment;
    submitted: boolean;
    evidence?: CasperSettlementEvidence;
  }> {
    const hash = createCasperPaymentAuthorizationHash(input.authorization);
    return withExecutionLock(hash, () => this.#executeLocked(hash, input));
  }

  async #executeLocked(
    hash: string,
    input: {
      authorization: CasperPaymentAuthorization;
      dryRun?: boolean;
      poll?: { timeoutMs?: number; intervalMs?: number };
    },
  ): Promise<{
    signed: SignedCasperPayment;
    submitted: boolean;
    evidence?: CasperSettlementEvidence;
  }> {
    const record = await this.store.prepare(hash);
    const signed = await this.signer.buildTransaction(input.authorization);
    if (signed.authorizationHash !== hash)
      throw new Error("SIGNER_AUTHORIZATION_HASH_MISMATCH");
    if (input.dryRun) return { signed, submitted: false };

    let transactionHash = record.transactionHash;
    if (record.state === "prepared") {
      // Persist the deterministic SDK hash before the network call. If the RPC
      // response is lost after acceptance, a retry queries this hash and never
      // submits the transaction a second time.
      transactionHash = signed.transactionHash.toLowerCase();
      await this.store.transition(hash, "submitted", { transactionHash });
      let submitted;
      try {
        submitted = await this.submitter.submit(signed.transaction);
      } catch (error) {
        throw new Error(
          `CASPER_SUBMISSION_UNCERTAIN: status lookup required for ${transactionHash}`,
          { cause: error },
        );
      }
      if (
        submitted.transactionHash.toLowerCase() !==
        signed.transactionHash.toLowerCase()
      ) {
        await this.store.transition(hash, "failed", {
          failureReason: "RPC_RETURNED_DIFFERENT_HASH",
        });
        throw new Error("RPC_RETURNED_DIFFERENT_HASH");
      }
    }
    if (!transactionHash)
      throw new Error("IDEMPOTENCY_TRANSACTION_HASH_MISSING");

    const status = await pollTransaction(
      this.submitter,
      transactionHash,
      input.poll,
    );
    if (status.status === "failed") {
      await this.store.transition(hash, "failed", {
        transactionHash,
        failureReason: status.reason,
      });
      throw new Error(`CASPER_EXECUTION_FAILED: ${status.reason}`);
    }
    const evidence = await this.verifier.verify({
      transactionHash,
      authorizationHash: hash,
      authorization: input.authorization,
      expectedSigner: signed.signer,
    });
    await this.store.transition(hash, "confirmed", { transactionHash });
    return { signed, submitted: true, evidence };
  }
}

const executionLocks = new Map<string, Promise<unknown>>();
async function withExecutionLock<T>(
  hash: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = executionLocks.get(hash) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  executionLocks.set(hash, current);
  try {
    return await current;
  } finally {
    if (executionLocks.get(hash) === current) executionLocks.delete(hash);
  }
}
