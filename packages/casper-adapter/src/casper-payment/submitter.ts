import type { RpcClient, Transaction } from "casper-js-sdk";

import { CasperSdk } from "./sdk";
import type { CasperTransactionSubmitter, TransactionStatus } from "./types";

const TRANSACTION_HASH = /^[a-fA-F0-9]{64}$/;

export class SdkCasperTransactionSubmitter implements CasperTransactionSubmitter {
  readonly #client: RpcClient;

  constructor(rpcUrl: string) {
    const url = new URL(rpcUrl);
    if (
      url.protocol !== "https:" &&
      url.hostname !== "127.0.0.1" &&
      url.hostname !== "localhost"
    ) {
      throw new Error("CASPER_RPC_URL must use HTTPS unless it is local");
    }
    this.#client = new CasperSdk.RpcClient(
      new CasperSdk.HttpHandler(url.toString()),
    );
  }

  async submit(transaction: Transaction): Promise<{ transactionHash: string }> {
    const result = await this.#client.putTransaction(transaction);
    const transactionHash = result.transactionHash.toHex().toLowerCase();
    if (!TRANSACTION_HASH.test(transactionHash)) {
      throw new Error("CASPER_RPC_INVALID_TRANSACTION_HASH");
    }
    return { transactionHash };
  }

  async getStatus(transactionHash: string): Promise<TransactionStatus> {
    if (!TRANSACTION_HASH.test(transactionHash)) {
      throw new Error("CASPER_TRANSACTION_HASH_INVALID");
    }
    try {
      const result =
        await this.#client.getTransactionByTransactionHash(transactionHash);
      return classifyTransactionExecution(result.executionInfo, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/not found|NoSuchTransaction|32001/i.test(message))
        return { status: "pending" };
      throw new Error(`CASPER_STATUS_QUERY_FAILED: ${message}`);
    }
  }
}

export function classifyTransactionExecution(
  execution:
    | { executionResult: { errorMessage?: string | null } }
    | null
    | undefined,
  raw?: unknown,
): TransactionStatus {
  if (!execution) return { status: "pending" };
  const errorMessage = execution.executionResult.errorMessage;
  if (errorMessage === null) return { status: "succeeded", raw };
  if (typeof errorMessage === "string") {
    return {
      status: "failed",
      reason: errorMessage || "Casper execution failed",
      raw: raw ?? execution,
    };
  }
  return { status: "pending" };
}

export async function pollTransaction(
  submitter: CasperTransactionSubmitter,
  transactionHash: string,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<Exclude<TransactionStatus, { status: "pending" }>> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const intervalMs = options.intervalMs ?? 3_000;
  if (timeoutMs <= 0 || intervalMs <= 0) throw new Error("POLL_CONFIG_INVALID");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await submitter.getStatus(transactionHash);
    if (status.status !== "pending") return status;
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.min(intervalMs, Math.max(1, deadline - Date.now())),
      ),
    );
  }
  throw new Error(
    `CASPER_EXECUTION_TIMEOUT: ${transactionHash} remained pending for ${timeoutMs}ms`,
  );
}
