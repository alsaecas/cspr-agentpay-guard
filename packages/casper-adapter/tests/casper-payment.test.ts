import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  CASPER_PAYMENT_AUTHORIZATION_VERSION,
  createCasperPaymentAuthorizationHash,
  type CasperPaymentAuthorization,
} from "@cspr-agentpay/protocol";
import { KeyAlgorithm, NativeTransferBuilder, PrivateKey } from "casper-js-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CasperSettlementVerifier,
  FileConsumedTransactionStore,
  FileSubmissionStore,
  LocalTestnetCasperSigner,
  MemoryConsumedTransactionStore,
  RealGuardedCasperPaymentFlow,
  classifyTransactionExecution,
  pollTransaction,
  verifyCasperAuthorizationSignature,
  type CasperTransactionSubmitter,
  type ObservedCasperTransfer,
  type SignedCasperPayment,
} from "../src/index";
import { CasperSdk } from "../src/casper-payment/sdk";

const directories: string[] = [];

describe("Casper SDK runtime interop", () => {
  it("loads constructable RPC clients", () => {
    const handler = new CasperSdk.HttpHandler("https://example.com/rpc");
    expect(new CasperSdk.RpcClient(handler)).toBeDefined();
  });
});

describe("TransactionV1 execution classification", () => {
  it("treats a null error_message as successful execution", () => {
    expect(
      classifyTransactionExecution({
        executionResult: { errorMessage: null },
      }).status,
    ).toBe("succeeded");
  });

  it("preserves a real execution error as failure", () => {
    expect(
      classifyTransactionExecution({
        executionResult: { errorMessage: "Insufficient payment" },
      }),
    ).toMatchObject({
      status: "failed",
      reason: "Insufficient payment",
    });
  });
});

afterEach(async () =>
  Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  ),
);

const authorization: CasperPaymentAuthorization = {
  version: CASPER_PAYMENT_AUTHORIZATION_VERSION,
  paymentId: "11".repeat(32),
  policyId: "policy",
  agentId: "agent",
  requestHash: "22".repeat(32),
  bodyHash: "33".repeat(32),
  merchantId: "merchant",
  destination: `01${"44".repeat(32)}`,
  network: "casper-test",
  asset: "CSPR",
  amountMotes: "2500000000",
  nonce: "nonce",
  transferId: "42",
  issuedAt: "2030-01-01T00:00:00.000Z",
  expiresAt: "2030-01-01T00:05:00.000Z",
  facilitator: "https://merchant.example.test",
  requirementHash: "55".repeat(32),
};

async function tempStore() {
  const directory = await mkdtemp(join(tmpdir(), "agentpay-"));
  directories.push(directory);
  return new FileSubmissionStore(
    join(directory, "submissions.real.json"),
    "real",
  );
}

async function tempConsumedStore() {
  const directory = await mkdtemp(join(tmpdir(), "agentpay-consumed-"));
  directories.push(directory);
  return new FileConsumedTransactionStore(
    join(directory, "consumed.real.json"),
    "real",
  );
}

describe("file submission idempotency", () => {
  it("clears stale failure metadata after confirmed recovery", async () => {
    const store = await tempStore();
    const hash = createCasperPaymentAuthorizationHash(authorization);
    await store.prepare(hash, new Date("2030-01-01"));
    await store.transition(hash, "failed", {
      transactionHash: "aa".repeat(32),
      failureReason: "false local failure",
    });

    const confirmed = await store.transition(hash, "confirmed", {
      transactionHash: "aa".repeat(32),
    });

    expect(confirmed.failureReason).toBeUndefined();
    expect(confirmed.state).toBe("confirmed");
  });

  it("creates one record under concurrency and persists transitions", async () => {
    const store = await tempStore();
    const hash = createCasperPaymentAuthorizationHash(authorization);
    const records = await Promise.all(
      Array.from({ length: 20 }, () =>
        store.prepare(hash, new Date("2030-01-01")),
      ),
    );
    expect(new Set(records.map((record) => record.createdAt)).size).toBe(1);
    await store.transition(hash, "submitted", {
      transactionHash: "aa".repeat(32),
    });
    expect((await store.get(hash))?.state).toBe("submitted");
  });

  it("fails closed for corrupt data", async () => {
    const store = await tempStore();
    await writeFile(store.filePath, "not-json");
    await expect(store.get("aa".repeat(32))).rejects.toThrow(
      "IDEMPOTENCY_STORE_CORRUPT",
    );
  });
});

describe("local signer", () => {
  it("fails closed for a missing key path", async () => {
    const signer = new LocalTestnetCasperSigner({
      secretKeyPath: "/definitely/missing/agentpay.pem",
      expectedPublicKey: authorization.destination,
    });
    await expect(signer.getPublicKey()).rejects.toThrow(
      "CASPER_SIGNER_KEY_UNAVAILABLE",
    );
  });

  it("builds and signs TransactionV1 without submitting", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agentpay-key-"));
    directories.push(directory);
    const key = PrivateKey.generate(KeyAlgorithm.ED25519);
    const keyPath = join(directory, "secret.pem");
    await writeFile(keyPath, key.toPem(), { mode: 0o600 });
    const signer = new LocalTestnetCasperSigner({
      secretKeyPath: keyPath,
      expectedPublicKey: key.publicKey.toHex(),
      now: () => new Date("2030-01-01T00:01:00Z"),
    });
    const signed = await signer.buildTransaction({
      ...authorization,
      destination: key.publicKey.toHex(),
    });
    expect(signed.transaction.getTransactionV1()).toBeDefined();
    expect(signed.transaction.approvals).toHaveLength(1);
    expect(JSON.stringify(signed)).not.toContain(key.toPem());
  });

  it("does not leak a malformed key", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agentpay-key-"));
    directories.push(directory);
    const secret = "VERY_SECRET_INVALID_KEY";
    const keyPath = join(directory, "secret.pem");
    await writeFile(keyPath, secret);
    const signer = new LocalTestnetCasperSigner({
      secretKeyPath: keyPath,
      expectedPublicKey: authorization.destination,
    });
    await expect(signer.getPublicKey()).rejects.not.toThrow(secret);
  });

  it("rejects a public/secret key mismatch", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agentpay-key-"));
    directories.push(directory);
    const key = PrivateKey.generate(KeyAlgorithm.ED25519);
    const keyPath = join(directory, "secret.pem");
    await writeFile(keyPath, key.toPem());
    const signer = new LocalTestnetCasperSigner({
      secretKeyPath: keyPath,
      expectedPublicKey: authorization.destination,
    });
    await expect(signer.getPublicKey()).rejects.toThrow(
      "CASPER_SIGNER_KEY_MISMATCH",
    );
  });
});

describe("authorization signatures", () => {
  it.each([
    ["ED25519", KeyAlgorithm.ED25519],
    ["SECP256K1", KeyAlgorithm.SECP256K1],
  ])("verifies raw hash bytes with %s", (_name, algorithm) => {
    const key = PrivateKey.generate(algorithm);
    const authorizationHash = createCasperPaymentAuthorizationHash({
      ...authorization,
      destination: key.publicKey.toHex(),
    });
    const signature = Buffer.from(
      key.sign(Buffer.from(authorizationHash, "hex")),
    ).toString("hex");
    expect(
      verifyCasperAuthorizationSignature({
        publicKey: key.publicKey.toHex(),
        authorizationHash,
        signature,
      }),
    ).toBe(true);
    const utf8Signature = Buffer.from(
      key.sign(Buffer.from(authorizationHash, "utf8")),
    ).toString("hex");
    expect(
      verifyCasperAuthorizationSignature({
        publicKey: key.publicKey.toHex(),
        authorizationHash,
        signature: utf8Signature,
      }),
    ).toBe(false);
  });

  it("rejects malformed algorithms, signatures, and signatures from another key", () => {
    const key = PrivateKey.generate(KeyAlgorithm.ED25519);
    const other = PrivateKey.generate(KeyAlgorithm.ED25519);
    const authorizationHash = "ab".repeat(32);
    const signature = Buffer.from(
      other.sign(Buffer.from(authorizationHash, "hex")),
    ).toString("hex");
    expect(
      verifyCasperAuthorizationSignature({
        publicKey: key.publicKey.toHex(),
        authorizationHash,
        signature,
      }),
    ).toBe(false);
    expect(
      verifyCasperAuthorizationSignature({
        publicKey: key.publicKey.toHex(),
        authorizationHash,
        signature: "not-a-signature",
      }),
    ).toBe(false);
    expect(
      verifyCasperAuthorizationSignature({
        publicKey: `03${"00".repeat(32)}`,
        authorizationHash,
        signature,
      }),
    ).toBe(false);
  });
});

describe("durable consumed transaction store", () => {
  it("survives re-instantiation and permits idempotent same-authorization reuse", async () => {
    const store = await tempConsumedStore();
    const transactionHash = "aa".repeat(32);
    const authorizationHash = "bb".repeat(32);
    await store.consume(transactionHash, authorizationHash);
    await expect(
      new FileConsumedTransactionStore(
        store.filePath,
        "real",
      ).getAuthorizationHash(transactionHash),
    ).resolves.toBe(authorizationHash);
    await expect(
      store.consume(transactionHash, authorizationHash),
    ).resolves.toBeUndefined();
    await expect(
      store.consume(transactionHash, "cc".repeat(32)),
    ).rejects.toThrow("TRANSACTION_ALREADY_CONSUMED");
  });

  it("fails closed when persisted state is corrupt", async () => {
    const store = await tempConsumedStore();
    await writeFile(store.filePath, "not-json");
    await expect(store.getAuthorizationHash("aa".repeat(32))).rejects.toThrow(
      "CONSUMED_TRANSACTION_STORE_CORRUPT",
    );
  });
});

describe("submission and verification", () => {
  it("handles pending then success and bounded timeout", async () => {
    const statuses = [
      { status: "pending" as const },
      { status: "succeeded" as const, raw: {} },
    ];
    const submitter = {
      submit: vi.fn(),
      getStatus: vi.fn(
        async () => statuses.shift() ?? { status: "pending" as const },
      ),
    };
    await expect(
      pollTransaction(submitter, "aa".repeat(32), {
        timeoutMs: 100,
        intervalMs: 1,
      }),
    ).resolves.toMatchObject({ status: "succeeded" });
    await expect(
      pollTransaction(
        {
          ...submitter,
          getStatus: async () => ({ status: "pending" as const }),
        },
        "aa".repeat(32),
        { timeoutMs: 2, intervalMs: 1 },
      ),
    ).rejects.toThrow("CASPER_EXECUTION_TIMEOUT");
  });

  it.each([
    ["signer", { signer: `01${"99".repeat(32)}` }],
    ["destination", { destination: `01${"98".repeat(32)}` }],
    ["amountMotes", { amountMotes: "1" }],
    ["transferId", { transferId: "43" }],
  ])("rejects wrong %s", async (_name, change) => {
    const observed: ObservedCasperTransfer = {
      transactionHash: "aa".repeat(32),
      executionStatus: "succeeded",
      network: "casper-test",
      signer: authorization.destination,
      destination: authorization.destination,
      amountMotes: authorization.amountMotes,
      transferId: authorization.transferId,
    };
    const verifier = new CasperSettlementVerifier(
      { readTransfer: async () => ({ ...observed, ...change }) },
      new MemoryConsumedTransactionStore(),
    );
    await expect(
      verifier.verify({
        transactionHash: observed.transactionHash,
        authorizationHash: "bb".repeat(32),
        authorization,
        expectedSigner: authorization.destination,
      }),
    ).rejects.toThrow("SETTLEMENT_MISMATCH");
  });

  it("accepts the exact settlement and rejects cross-authorization consumption", async () => {
    const observed: ObservedCasperTransfer = {
      transactionHash: "aa".repeat(32),
      executionStatus: "succeeded",
      network: "casper-test",
      signer: authorization.destination,
      destination: authorization.destination,
      amountMotes: authorization.amountMotes,
      transferId: authorization.transferId,
    };
    const consumed = new MemoryConsumedTransactionStore();
    const verifier = new CasperSettlementVerifier(
      { readTransfer: async () => observed },
      consumed,
    );
    await expect(
      verifier.verify({
        transactionHash: observed.transactionHash,
        authorizationHash: "bb".repeat(32),
        authorization,
        expectedSigner: authorization.destination,
      }),
    ).resolves.toMatchObject({ executionStatus: "succeeded" });
    await expect(
      verifier.verify({
        transactionHash: observed.transactionHash,
        authorizationHash: "cc".repeat(32),
        authorization,
        expectedSigner: authorization.destination,
      }),
    ).rejects.toThrow("TRANSACTION_ALREADY_CONSUMED");
  });

  it("rejects missing and failed transactions", async () => {
    const verifier = new CasperSettlementVerifier(
      { readTransfer: async () => null },
      new MemoryConsumedTransactionStore(),
    );
    await expect(
      verifier.verify({
        transactionHash: "aa".repeat(32),
        authorizationHash: "bb".repeat(32),
        authorization,
        expectedSigner: authorization.destination,
      }),
    ).rejects.toThrow("TRANSACTION_NOT_FOUND");
    const failed: ObservedCasperTransfer = {
      transactionHash: "aa".repeat(32),
      executionStatus: "failed",
      failureReason: "revert",
      network: "casper-test",
      signer: authorization.destination,
      destination: authorization.destination,
      amountMotes: authorization.amountMotes,
      transferId: authorization.transferId,
    };
    const failedVerifier = new CasperSettlementVerifier(
      { readTransfer: async () => failed },
      new MemoryConsumedTransactionStore(),
    );
    await expect(
      failedVerifier.verify({
        transactionHash: failed.transactionHash,
        authorizationHash: "bb".repeat(32),
        authorization,
        expectedSigner: authorization.destination,
      }),
    ).rejects.toThrow("TRANSACTION_EXECUTION_FAILED");
  });
});

describe("real flow", () => {
  it("submits a concurrent duplicate exactly once", async () => {
    const key = PrivateKey.generate(KeyAlgorithm.ED25519);
    const tx = new NativeTransferBuilder()
      .from(key.publicKey)
      .target(key.publicKey)
      .amount("2500000000")
      .id(42)
      .chainName("casper-test")
      .payment(100_000_000)
      .build();
    const signed: SignedCasperPayment = {
      authorization: { ...authorization, destination: key.publicKey.toHex() },
      authorizationHash: createCasperPaymentAuthorizationHash({
        ...authorization,
        destination: key.publicKey.toHex(),
      }),
      authorizationSignature: "sig",
      signer: key.publicKey.toHex(),
      transactionHash: tx.hash.toHex(),
      transaction: tx,
      transactionJson: tx.toJSON(),
    };
    const signer = {
      getPublicKey: async () => signed.signer,
      buildTransaction: async () => signed,
    };
    const submitter: CasperTransactionSubmitter = {
      submit: vi.fn(async () => ({ transactionHash: signed.transactionHash })),
      getStatus: async () => ({ status: "succeeded", raw: {} }),
    };
    const observed: ObservedCasperTransfer = {
      transactionHash: signed.transactionHash,
      executionStatus: "succeeded",
      network: "casper-test",
      signer: signed.signer,
      destination: signed.authorization.destination,
      amountMotes: signed.authorization.amountMotes,
      transferId: signed.authorization.transferId,
    };
    const flow = new RealGuardedCasperPaymentFlow(
      signer,
      submitter,
      new CasperSettlementVerifier(
        { readTransfer: async () => observed },
        new MemoryConsumedTransactionStore(),
      ),
      await tempStore(),
    );
    await Promise.all([
      flow.execute({ authorization: signed.authorization }),
      flow.execute({ authorization: signed.authorization }),
    ]);
    expect(submitter.submit).toHaveBeenCalledTimes(1);
  });

  it("does not resubmit after an uncertain RPC response", async () => {
    const key = PrivateKey.generate(KeyAlgorithm.ED25519);
    const auth = { ...authorization, destination: key.publicKey.toHex() };
    const tx = new NativeTransferBuilder()
      .from(key.publicKey)
      .target(key.publicKey)
      .amount(auth.amountMotes)
      .id(Number(auth.transferId))
      .chainName(auth.network)
      .payment(100_000_000)
      .build();
    const signed: SignedCasperPayment = {
      authorization: auth,
      authorizationHash: createCasperPaymentAuthorizationHash(auth),
      authorizationSignature: "sig",
      signer: key.publicKey.toHex(),
      transactionHash: tx.hash.toHex(),
      transaction: tx,
      transactionJson: tx.toJSON(),
    };
    const submit = vi.fn().mockRejectedValueOnce(new Error("socket closed"));
    const observed: ObservedCasperTransfer = {
      transactionHash: signed.transactionHash,
      executionStatus: "succeeded",
      network: auth.network,
      signer: signed.signer,
      destination: auth.destination,
      amountMotes: auth.amountMotes,
      transferId: auth.transferId,
    };
    const flow = new RealGuardedCasperPaymentFlow(
      {
        getPublicKey: async () => signed.signer,
        buildTransaction: async () => signed,
      },
      { submit, getStatus: async () => ({ status: "succeeded", raw: {} }) },
      new CasperSettlementVerifier(
        { readTransfer: async () => observed },
        new MemoryConsumedTransactionStore(),
      ),
      await tempStore(),
    );
    await expect(flow.execute({ authorization: auth })).rejects.toThrow(
      "CASPER_SUBMISSION_UNCERTAIN",
    );
    await expect(flow.execute({ authorization: auth })).resolves.toMatchObject({
      submitted: true,
    });
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
