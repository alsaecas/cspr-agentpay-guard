import type { CasperPaymentAuthorization } from "@cspr-agentpay/protocol";
import type { Transaction } from "casper-js-sdk";

export interface SignedCasperPayment {
  authorization: CasperPaymentAuthorization;
  authorizationHash: string;
  authorizationSignature: string;
  signer: string;
  transactionHash: string;
  transaction: Transaction;
  transactionJson: unknown;
}

export interface CasperPaymentSigner {
  getPublicKey(): Promise<string>;
  buildTransaction(
    authorization: CasperPaymentAuthorization,
  ): Promise<SignedCasperPayment>;
}

export type SubmissionState = "prepared" | "submitted" | "confirmed" | "failed";

export interface SubmissionRecord {
  authorizationHash: string;
  state: SubmissionState;
  transactionHash?: string;
  createdAt: string;
  updatedAt: string;
  failureReason?: string;
}

export type TransactionStatus =
  | { status: "pending" }
  | { status: "succeeded"; raw: unknown }
  | { status: "failed"; reason: string; raw?: unknown };

export interface CasperTransactionSubmitter {
  submit(transaction: Transaction): Promise<{ transactionHash: string }>;
  getStatus(transactionHash: string): Promise<TransactionStatus>;
}

export interface CasperSettlementEvidence {
  mode: "casper-testnet";
  transactionHash: string;
  executionStatus: "succeeded";
  blockHash?: string;
  blockHeight?: number;
  timestamp?: string;
  signer: string;
  destination: string;
  amountMotes: string;
  transferId: string;
  confirmations?: number;
  verifiedAt: string;
}

export interface ObservedCasperTransfer {
  transactionHash: string;
  executionStatus: "pending" | "succeeded" | "failed";
  failureReason?: string;
  network: string;
  signer: string;
  destination: string;
  amountMotes: string;
  transferId: string;
  blockHash?: string;
  blockHeight?: number;
  timestamp?: string;
  confirmations?: number;
}

export interface CasperTransferReader {
  readTransfer(transactionHash: string): Promise<ObservedCasperTransfer | null>;
}
