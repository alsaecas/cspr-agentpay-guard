import type { CasperPaymentAuthorization } from "@cspr-agentpay/protocol";
import * as CasperSdk from "casper-js-sdk";

import type { CasperSettlementEvidence, CasperTransferReader } from "./types";

export interface ConsumedTransactionStore {
  getAuthorizationHash(transactionHash: string): Promise<string | undefined>;
  consume(transactionHash: string, authorizationHash: string): Promise<void>;
}

export class MemoryConsumedTransactionStore implements ConsumedTransactionStore {
  readonly #consumed = new Map<string, string>();
  async getAuthorizationHash(hash: string) {
    return this.#consumed.get(hash);
  }
  async consume(hash: string, authorizationHash: string) {
    const existing = this.#consumed.get(hash);
    if (existing && existing !== authorizationHash)
      throw new Error("TRANSACTION_ALREADY_CONSUMED");
    this.#consumed.set(hash, authorizationHash);
  }
}

export class CasperSettlementVerifier {
  constructor(
    readonly reader: CasperTransferReader,
    readonly consumed: ConsumedTransactionStore,
  ) {}

  async verify(input: {
    transactionHash: string;
    authorizationHash: string;
    authorization: CasperPaymentAuthorization;
    expectedSigner: string;
    now?: Date;
  }): Promise<CasperSettlementEvidence> {
    const observed = await this.reader.readTransfer(input.transactionHash);
    if (!observed) throw new Error("TRANSACTION_NOT_FOUND");
    if (observed.executionStatus === "pending")
      throw new Error("TRANSACTION_PENDING");
    if (observed.executionStatus === "failed") {
      throw new Error(
        `TRANSACTION_EXECUTION_FAILED${observed.failureReason ? `: ${observed.failureReason}` : ""}`,
      );
    }
    const expected = input.authorization;
    const mismatches = [
      observed.transactionHash.toLowerCase() !==
        input.transactionHash.toLowerCase() && "transactionHash",
      observed.network !== expected.network && "network",
      observed.signer.toLowerCase() !== input.expectedSigner.toLowerCase() &&
        "signer",
      observed.destination.toLowerCase() !==
        expected.destination.toLowerCase() && "destination",
      observed.amountMotes !== expected.amountMotes && "amountMotes",
      observed.transferId !== expected.transferId && "transferId",
      observed.timestamp &&
        Date.parse(observed.timestamp) > Date.parse(expected.expiresAt) &&
        "expiry",
    ].filter(Boolean);
    if (mismatches.length)
      throw new Error(`SETTLEMENT_MISMATCH: ${mismatches.join(", ")}`);
    const existing = await this.consumed.getAuthorizationHash(
      input.transactionHash,
    );
    if (existing && existing !== input.authorizationHash)
      throw new Error("TRANSACTION_ALREADY_CONSUMED");
    await this.consumed.consume(input.transactionHash, input.authorizationHash);
    return {
      mode: "casper-testnet",
      transactionHash: input.transactionHash.toLowerCase(),
      executionStatus: "succeeded",
      signer: observed.signer,
      destination: observed.destination,
      amountMotes: observed.amountMotes,
      transferId: observed.transferId,
      verifiedAt: (input.now ?? new Date()).toISOString(),
      ...(observed.blockHash ? { blockHash: observed.blockHash } : {}),
      ...(observed.blockHeight !== undefined
        ? { blockHeight: observed.blockHeight }
        : {}),
      ...(observed.timestamp ? { timestamp: observed.timestamp } : {}),
      ...(observed.confirmations !== undefined
        ? { confirmations: observed.confirmations }
        : {}),
    };
  }
}

/** Reads and parses the authoritative TransactionV1 and execution info from Casper RPC. */
export class SdkCasperTransferReader implements CasperTransferReader {
  readonly #client: CasperSdk.RpcClient;
  constructor(rpcUrl: string) {
    this.#client = new CasperSdk.RpcClient(new CasperSdk.HttpHandler(rpcUrl));
  }

  async readTransfer(transactionHash: string) {
    try {
      const result =
        await this.#client.getTransactionByTransactionHash(transactionHash);
      const transaction = result.transaction;
      if (!transaction.getTransactionV1())
        throw new Error("NOT_TRANSACTION_V1");
      if (
        transaction.entryPoint.type !==
        CasperSdk.TransactionEntryPointEnum.Transfer
      ) {
        throw new Error("NOT_NATIVE_TRANSFER");
      }
      const execution = result.executionInfo;
      const amount = transaction.args.getByName("amount")?.toJSON();
      const target = transaction.args.getByName("target")?.toJSON();
      const id = transaction.args.getByName("id")?.toJSON();
      const signer = transaction.initiatorAddr.publicKey?.toHex();
      if (
        typeof amount !== "string" ||
        typeof target !== "string" ||
        id === undefined ||
        !signer
      ) {
        throw new Error("TRANSACTION_TRANSFER_FIELDS_MISSING");
      }
      return {
        transactionHash: transaction.hash.toHex().toLowerCase(),
        executionStatus: !execution
          ? ("pending" as const)
          : execution.executionResult.errorMessage
            ? ("failed" as const)
            : ("succeeded" as const),
        ...(execution?.executionResult.errorMessage
          ? { failureReason: execution.executionResult.errorMessage }
          : {}),
        network: transaction.chainName,
        signer: signer.toLowerCase(),
        destination: target.toLowerCase(),
        amountMotes: amount,
        transferId: String(id),
        timestamp: transaction.timestamp.toJSON(),
        ...(execution
          ? {
              blockHash: execution.blockHash.toHex(),
              blockHeight: execution.blockHeight,
            }
          : {}),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/not found|NoSuchTransaction|32001/i.test(message)) return null;
      throw error;
    }
  }
}
