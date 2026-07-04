import type {
  AgentPolicy,
  AuditEvent,
  Merchant,
  PaymentReceipt,
} from "@cspr-agentpay/protocol";
import { access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type {
  AuthorizePaymentInput,
  CasperPaymentAdapter,
  CreatePolicyInput,
  ListAuditEventsFilter,
  ListPaymentsFilter,
  MarkFulfilledInput,
  PaymentAuthorizationResult,
  RealCasperAdapterConfig,
  RegisterMerchantInput,
  SettlePaymentInput,
  SettlementResult,
  SubmitPaymentInput,
  TxResult,
} from "./types";

const NOT_IMPLEMENTED_MESSAGE =
  "is not implemented yet. Use mock mode or complete contract deployment." as const;

const execFileAsync = promisify(execFile);

type TestnetProof =
  | {
      kind: "transaction-v1";
      transactionHash?: string | undefined;
    }
  | {
      kind: "legacy-deploy";
      deployHash?: string | undefined;
    };

const DEFAULT_CASPER_RPC_URL = "https://node.testnet.casper.network/rpc";
const DEFAULT_CASPER_NETWORK = "casper-test";
const DEFAULT_PROOF_GAS_MOTES = "5000000000";
const HEX_64 = /^[0-9a-fA-F]{64}$/;

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function normalizeContractHash(hash: string): string {
  return hash.startsWith("hash-") ? hash.slice("hash-".length) : hash;
}

function getProofGasMotes(env: NodeJS.ProcessEnv): string {
  return (
    env.CASPER_PROOF_GAS_MOTES ??
    env.CASPER_PAYMENT_GAS_MOTES ??
    DEFAULT_PROOF_GAS_MOTES
  );
}

function buildSessionArg(
  name: string,
  type: "string" | "opt_string",
  value: string | undefined,
): string {
  if (type === "opt_string" && !value) {
    return `${name}:opt_string=null`;
  }

  const escaped = (value ?? "").replaceAll("\\", "\\\\").replaceAll("'", "\\'");
  return `${name}:${type}='${escaped}'`;
}

function extractDeployHash(output: string): string | undefined {
  const jsonMatch = output.match(/"deploy_hash"\s*:\s*"([0-9a-fA-F]{64})"/);
  if (jsonMatch?.[1]) {
    return jsonMatch[1];
  }

  const textMatch = output.match(/\b([0-9a-fA-F]{64})\b/);
  return textMatch?.[1];
}

function truncateOutput(output: string): string {
  const trimmed = output.trim();
  if (trimmed.length <= 1200) {
    return trimmed;
  }
  return `${trimmed.slice(0, 1200)}...`;
}

export class RealCasperTestnetAdapter implements CasperPaymentAdapter {
  readonly mode = "casper-testnet" as const;

  constructor(private readonly config: RealCasperAdapterConfig) {}

  // ---------------------------------------------------------------------------
  // CasperPaymentAdapter interface
  // ---------------------------------------------------------------------------

  async createPolicy(_input: CreatePolicyInput): Promise<AgentPolicy> {
    throw new Error(`Casper Testnet createPolicy ${NOT_IMPLEMENTED_MESSAGE}`);
  }

  async revokePolicy(_policyId: string): Promise<TxResult> {
    throw new Error(`Casper Testnet revokePolicy ${NOT_IMPLEMENTED_MESSAGE}`);
  }

  async registerMerchant(_input: RegisterMerchantInput): Promise<Merchant> {
    throw new Error(
      `Casper Testnet registerMerchant ${NOT_IMPLEMENTED_MESSAGE}`,
    );
  }

  async authorizePayment(
    _input: AuthorizePaymentInput,
  ): Promise<PaymentAuthorizationResult> {
    throw new Error(
      `Casper Testnet authorizePayment ${NOT_IMPLEMENTED_MESSAGE}`,
    );
  }

  async submitPayment(_input: SubmitPaymentInput): Promise<PaymentReceipt> {
    throw new Error(`Casper Testnet submitPayment ${NOT_IMPLEMENTED_MESSAGE}`);
  }

  async markFulfilled(_input: MarkFulfilledInput): Promise<PaymentReceipt> {
    throw new Error(`Casper Testnet markFulfilled ${NOT_IMPLEMENTED_MESSAGE}`);
  }

  async settlePayment(_input: SettlePaymentInput): Promise<SettlementResult> {
    throw new Error(`Casper Testnet settlePayment ${NOT_IMPLEMENTED_MESSAGE}`);
  }

  async expirePayment(_paymentId: string): Promise<TxResult> {
    throw new Error(`Casper Testnet expirePayment ${NOT_IMPLEMENTED_MESSAGE}`);
  }

  async getPolicy(_policyId: string): Promise<AgentPolicy | null> {
    throw new Error(`Casper Testnet getPolicy ${NOT_IMPLEMENTED_MESSAGE}`);
  }

  async getMerchant(_merchantId: string): Promise<Merchant | null> {
    throw new Error(`Casper Testnet getMerchant ${NOT_IMPLEMENTED_MESSAGE}`);
  }

  async getPayment(_paymentId: string): Promise<PaymentReceipt | null> {
    throw new Error(`Casper Testnet getPayment ${NOT_IMPLEMENTED_MESSAGE}`);
  }

  async listPayments(
    _filter: ListPaymentsFilter = {},
  ): Promise<PaymentReceipt[]> {
    throw new Error(`Casper Testnet listPayments ${NOT_IMPLEMENTED_MESSAGE}`);
  }

  async listAuditEvents(
    _filter: ListAuditEventsFilter = {},
  ): Promise<AuditEvent[]> {
    throw new Error(
      `Casper Testnet listAuditEvents ${NOT_IMPLEMENTED_MESSAGE}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Prompt 10: Testnet proof support (not production escrow)
  // ---------------------------------------------------------------------------

  /**
   * Build a dry-run CasperProof payload WITHOUT submitting to the chain.
   * Always safe — no credentials needed.
   *
   * Returns a CasperProof that WOULD be submitted if env is configured.
   * The proof.kind is "transaction-v1" when a contract hash is available,
   * otherwise falls back to a documented placeholder.
   */
  static buildProofDryRun(input: {
    paymentId: string;
    requestHash: string;
    policyId: string;
    merchantId: string;
    status: string;
    receiptHash?: string;
    env?: NodeJS.ProcessEnv;
  }): {
    proof: TestnetProof;
    payload: Record<string, string>;
    missingEnvVars: string[];
  } {
    const env = input.env ?? process.env;
    const missing = RealCasperTestnetAdapter.getMissingChainEnvVars(env);

    const payload: Record<string, string> = {
      paymentId: input.paymentId,
      requestHash: input.requestHash,
      policyId: input.policyId,
      merchantId: input.merchantId,
      status: input.status,
    };
    if (input.receiptHash) {
      payload.receiptHash = input.receiptHash;
    }

    const proof = { kind: "legacy-deploy" as const };

    return { proof, payload, missingEnvVars: missing };
  }

  /**
   * Record an AgentPay proof on Casper Testnet.
   *
   * Uses the locally installed casper-client to submit a legacy deploy
   * calling AgentPayProofRecorder.record_proof. It returns submitted=false
   * for missing configuration or CLI failures and never fabricates a hash.
   */
  static async recordAgentPayProof(input: {
    paymentId: string;
    requestHash: string;
    policyId: string;
    merchantId: string;
    status: string;
    receiptHash?: string;
    env?: NodeJS.ProcessEnv;
  }): Promise<{
    proof: TestnetProof;
    submitted: boolean;
    message: string;
  }> {
    const env = input.env ?? process.env;
    const missing = RealCasperTestnetAdapter.getMissingChainEnvVars(env);

    if (missing.length > 0) {
      return {
        proof: {
          kind: "legacy-deploy",
        },
        submitted: false,
        message:
          `Cannot submit to Casper Testnet. Missing env vars: ${missing.join(", ")}. ` +
          `Set them in .env or run with pnpm proof:testnet:dry-run to validate payload.`,
      };
    }

    const secretKeyPath = env.CASPER_TESTNET_SECRET_KEY_PATH;
    if (!secretKeyPath || !(await pathExists(secretKeyPath))) {
      return {
        proof: {
          kind: "legacy-deploy",
        },
        submitted: false,
        message:
          `Cannot submit to Casper Testnet. Secret key file not found at ` +
          `CASPER_TESTNET_SECRET_KEY_PATH. Set it to an absolute path for a funded Testnet key.`,
      };
    }

    const contractHash = normalizeContractHash(
      env.CASPER_AGENTPAY_CONTRACT_HASH ?? "",
    );
    if (!HEX_64.test(contractHash)) {
      return {
        proof: {
          kind: "legacy-deploy",
        },
        submitted: false,
        message:
          "Cannot submit to Casper Testnet. CASPER_AGENTPAY_CONTRACT_HASH must be a 64-character hex hash, with or without the hash- prefix.",
      };
    }

    const casperClient = env.CASPER_CLIENT_BIN ?? "casper-client";
    const args = [
      "put-deploy",
      "--node-address",
      env.CASPER_RPC_URL ?? DEFAULT_CASPER_RPC_URL,
      "--secret-key",
      secretKeyPath,
      "--chain-name",
      env.CASPER_NETWORK ?? DEFAULT_CASPER_NETWORK,
      "--payment-amount",
      getProofGasMotes(env),
      "--session-hash",
      contractHash,
      "--session-entry-point",
      "record_proof",
      "--session-arg",
      buildSessionArg("payment_id", "string", input.paymentId),
      "--session-arg",
      buildSessionArg("request_hash", "string", input.requestHash),
      "--session-arg",
      buildSessionArg("policy_id", "string", input.policyId),
      "--session-arg",
      buildSessionArg("merchant_id", "string", input.merchantId),
      "--session-arg",
      buildSessionArg("status", "string", input.status),
      "--session-arg",
      buildSessionArg("receipt_hash", "opt_string", input.receiptHash),
    ];

    let stdout = "";
    let stderr = "";
    try {
      const result = await execFileAsync(casperClient, args, {
        env: {
          ...process.env,
          ...env,
        },
        maxBuffer: 1024 * 1024,
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error) {
      const err = error as {
        message?: string;
        stdout?: string;
        stderr?: string;
      };
      const details = truncateOutput(
        [err.stderr, err.stdout, err.message].filter(Boolean).join("\n"),
      );
      return {
        proof: {
          kind: "legacy-deploy",
        },
        submitted: false,
        message:
          "casper-client failed before returning a deploy hash. No fake proof was recorded." +
          (details ? ` Details: ${details}` : ""),
      };
    }

    const deployHash = extractDeployHash(`${stdout}\n${stderr}`);
    if (!deployHash) {
      return {
        proof: {
          kind: "legacy-deploy",
        },
        submitted: false,
        message:
          "casper-client finished but no deploy hash was found in its output. No proof hash will be reported.",
      };
    }

    return {
      proof: {
        kind: "legacy-deploy",
        deployHash,
      },
      submitted: true,
      message: "Submitted AgentPay proof to Casper Testnet with casper-client.",
    };
  }

  // ---------------------------------------------------------------------------
  // Environment validation
  // ---------------------------------------------------------------------------

  /**
   * Required env vars for chain submission (no CSPR.cloud needed).
   */
  static getMissingChainEnvVars(
    env: NodeJS.ProcessEnv = process.env,
  ): string[] {
    const required: string[] = [
      "CASPER_TESTNET_PUBLIC_KEY",
      "CASPER_TESTNET_SECRET_KEY_PATH",
      "CASPER_AGENTPAY_CONTRACT_HASH",
    ];

    return required.filter((name) => !env[name]);
  }

  /**
   * Required env vars for CSPR.cloud event reads (optional).
   */
  static getMissingCsprCloudEnvVars(
    env: NodeJS.ProcessEnv = process.env,
  ): string[] {
    const required: string[] = ["CSPR_CLOUD_AUTH_TOKEN", "CSPR_CLOUD_API_URL"];

    return required.filter((name) => !env[name]);
  }

  /**
   * Returns the names of required environment variables that are missing
   * or empty. Does not throw. Useful for early diagnostics before
   * attempting any real Casper Testnet operation.
   *
   * Includes CSPR.cloud vars for backward compatibility.
   */
  static getMissingEnvVars(env: NodeJS.ProcessEnv = process.env): string[] {
    const required: string[] = [
      "CASPER_TESTNET_PUBLIC_KEY",
      "CASPER_TESTNET_SECRET_KEY_PATH",
      "CSPR_CLOUD_AUTH_TOKEN",
      "CASPER_AGENTPAY_CONTRACT_HASH",
    ];

    return required.filter((name) => !env[name]);
  }

  /**
   * Validates that all required environment variables for real Casper
   * Testnet operations are set. Throws with a detailed message listing
   * all missing variables if any are absent.
   */
  static assertEnvReady(env: NodeJS.ProcessEnv = process.env): void {
    const missing = RealCasperTestnetAdapter.getMissingEnvVars(env);
    if (missing.length > 0) {
      throw new Error(
        `Casper Testnet environment is not ready. ` +
          `Missing variables: ${missing.join(", ")}. ` +
          `Set them in your .env file or use mock mode (AGENTPAY_MODE=mock).`,
      );
    }
  }
}

export function loadRealCasperConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): RealCasperAdapterConfig {
  const config: RealCasperAdapterConfig = {
    network: env.CASPER_NETWORK ?? "casper-test",
    rpcUrl: env.CASPER_RPC_URL ?? DEFAULT_CASPER_RPC_URL,
  };

  if (env.CASPER_TESTNET_SECRET_KEY_PATH) {
    config.secretKeyPath = env.CASPER_TESTNET_SECRET_KEY_PATH;
  }
  if (env.CASPER_TESTNET_PUBLIC_KEY) {
    config.publicKey = env.CASPER_TESTNET_PUBLIC_KEY;
  }

  return config;
}
