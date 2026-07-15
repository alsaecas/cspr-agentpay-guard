import { open } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import {
  assertAuthorizationMatchesRequest,
  createCasperPaymentAuthorizationHash,
  validateCasperPaymentAuthorization,
  type CasperPaymentAuthorization,
  type GuardedPaymentRequest,
} from "@cspr-agentpay/protocol";
import type { PrivateKey } from "casper-js-sdk";

import { CasperSdk } from "./sdk";
import type { CasperPaymentSigner, SignedCasperPayment } from "./types";

export interface LocalTestnetSignerOptions {
  secretKeyPath: string;
  expectedPublicKey: string;
  paymentGasMotes?: number;
  cwd?: string;
  now?: () => Date;
}

export class LocalTestnetCasperSigner implements CasperPaymentSigner {
  readonly #keyPath: string;
  readonly #expectedPublicKey: string;
  readonly #paymentGasMotes: number;
  readonly #now: () => Date;

  constructor(options: LocalTestnetSignerOptions) {
    this.#keyPath = isAbsolute(options.secretKeyPath)
      ? options.secretKeyPath
      : resolve(options.cwd ?? process.cwd(), options.secretKeyPath);
    this.#expectedPublicKey = options.expectedPublicKey.toLowerCase();
    this.#paymentGasMotes = options.paymentGasMotes ?? 100_000_000;
    this.#now = options.now ?? (() => new Date());
  }

  async getPublicKey(): Promise<string> {
    return (await this.#loadKey()).publicKey.toHex().toLowerCase();
  }

  async buildTransaction(
    input: CasperPaymentAuthorization,
  ): Promise<SignedCasperPayment> {
    const authorization = validateCasperPaymentAuthorization(input, {
      now: this.#now(),
    });
    const key = await this.#loadKey();
    let builder = new CasperSdk.NativeTransferBuilder().from(key.publicKey);
    builder = /^(account-hash-)?[0-9a-fA-F]{64}$/.test(
      authorization.destination,
    )
      ? builder.targetAccountHash(
          CasperSdk.AccountHash.fromString(authorization.destination),
        )
      : builder.target(CasperSdk.PublicKey.fromHex(authorization.destination));
    const ttl = Math.min(
      30 * 60_000,
      Date.parse(authorization.expiresAt) - Date.parse(authorization.issuedAt),
    );
    const transaction = builder
      .amount(authorization.amountMotes)
      .id(Number(authorization.transferId))
      .chainName(authorization.network)
      .timestamp(new CasperSdk.Timestamp(new Date(authorization.issuedAt)))
      .ttl(ttl)
      .payment(this.#paymentGasMotes)
      .build();
    transaction.sign(key);
    if (!transaction.validate()) throw new Error("SIGNED_TRANSACTION_INVALID");

    const authorizationHash =
      createCasperPaymentAuthorizationHash(authorization);
    const authorizationSignature = Buffer.from(
      key.sign(Buffer.from(authorizationHash, "hex")),
    ).toString("hex");
    return {
      authorization,
      authorizationHash,
      authorizationSignature,
      signer: key.publicKey.toHex().toLowerCase(),
      transactionHash: transaction.hash.toHex().toLowerCase(),
      transaction,
      transactionJson: transaction.toJSON(),
    };
  }

  async assertApprovedRequest(
    authorization: CasperPaymentAuthorization,
    request: GuardedPaymentRequest,
  ): Promise<void> {
    assertAuthorizationMatchesRequest(authorization, request);
  }

  async #loadKey(): Promise<PrivateKey> {
    let handle;
    try {
      handle = await open(this.#keyPath, "r");
      const file = await handle.stat();
      if (!file.isFile()) throw new Error("not a file");
      const pem = await handle.readFile("utf8");
      let key: PrivateKey | undefined;
      for (const algorithm of [
        CasperSdk.KeyAlgorithm.ED25519,
        CasperSdk.KeyAlgorithm.SECP256K1,
      ]) {
        try {
          key = CasperSdk.PrivateKey.fromPem(pem, algorithm);
          if (key.publicKey.toHex().toLowerCase() === this.#expectedPublicKey)
            break;
          key = undefined;
        } catch {
          // Try the other supported Casper algorithm without surfacing PEM data.
        }
      }
      if (!key) throw new Error("CASPER_SIGNER_KEY_MISMATCH");
      return key;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "CASPER_SIGNER_KEY_MISMATCH"
      ) {
        throw error;
      }
      throw new Error("CASPER_SIGNER_KEY_UNAVAILABLE");
    } finally {
      await handle?.close();
    }
  }
}

/** Verify the raw 64-byte SDK signature over the raw 32-byte authorization hash. */
export function verifyCasperAuthorizationSignature(input: {
  publicKey: string;
  authorizationHash: string;
  signature: string;
}): boolean {
  if (!/^[a-fA-F0-9]{64}$/.test(input.authorizationHash)) return false;
  if (!/^[a-fA-F0-9]{128}$/.test(input.signature)) return false;
  try {
    const publicKey = CasperSdk.PublicKey.fromHex(input.publicKey);
    if (
      publicKey.cryptoAlg !== CasperSdk.KeyAlgorithm.ED25519 &&
      publicKey.cryptoAlg !== CasperSdk.KeyAlgorithm.SECP256K1
    ) {
      return false;
    }
    const rawSignature = Buffer.from(input.signature, "hex");
    const taggedSignature = Buffer.concat([
      Buffer.from([publicKey.cryptoAlg]),
      rawSignature,
    ]);
    return publicKey.verifySignature(
      Buffer.from(input.authorizationHash, "hex"),
      taggedSignature,
    );
  } catch {
    return false;
  }
}
