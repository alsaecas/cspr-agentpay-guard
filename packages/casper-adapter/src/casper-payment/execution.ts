import type { ObservedCasperTransfer, TransactionStatus } from "./types";

type ObservedExecution = Pick<
  ObservedCasperTransfer,
  "executionStatus" | "failureReason"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The one fail-closed interpretation of Casper SDK execution information. */
export function classifyCasperExecution(
  execution: unknown,
  raw?: unknown,
): TransactionStatus {
  if (!isRecord(execution)) return { status: "pending" };
  const executionResult = execution.executionResult;
  if (!isRecord(executionResult) || !("errorMessage" in executionResult)) {
    return { status: "pending" };
  }
  const errorMessage = executionResult.errorMessage;
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

/** Maps the canonical classifier to the transfer-reader status shape. */
export function mapCasperExecutionToTransferStatus(
  execution: unknown,
): ObservedExecution {
  const classified = classifyCasperExecution(execution);
  if (classified.status === "failed") {
    return {
      executionStatus: "failed",
      failureReason: classified.reason,
    };
  }
  return { executionStatus: classified.status };
}

/** @deprecated Use classifyCasperExecution. */
export const classifyTransactionExecution = classifyCasperExecution;
