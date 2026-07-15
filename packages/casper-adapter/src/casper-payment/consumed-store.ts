import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { ConsumedTransactionStore } from "./verifier";

interface ConsumedDocument {
  version: 1;
  records: Record<string, string>;
}

const storeLocks = new Map<string, Promise<unknown>>();
const hashPattern = /^[a-fA-F0-9]{64}$/;

/** Atomic, process-restart durable transaction-consumption store for local demo use. */
export class FileConsumedTransactionStore implements ConsumedTransactionStore {
  constructor(
    readonly filePath: string,
    readonly mode: "real" | "mock",
  ) {
    if (!filePath.endsWith(`.${mode}.json`)) {
      throw new Error(`Consumed transaction path must end in .${mode}.json`);
    }
  }

  async getAuthorizationHash(
    transactionHash: string,
  ): Promise<string | undefined> {
    const hash = normalizeHash(transactionHash, "transactionHash");
    return this.#locked(async () => (await this.#read()).records[hash]);
  }

  async consume(
    transactionHash: string,
    authorizationHash: string,
  ): Promise<void> {
    const transaction = normalizeHash(transactionHash, "transactionHash");
    const authorization = normalizeHash(authorizationHash, "authorizationHash");
    await this.#locked(async () => {
      const document = await this.#read();
      const existing = document.records[transaction];
      if (existing && existing !== authorization) {
        throw new Error("TRANSACTION_ALREADY_CONSUMED");
      }
      if (existing === authorization) return;
      document.records[transaction] = authorization;
      await this.#write(document);
    });
  }

  async #read(): Promise<ConsumedDocument> {
    try {
      const parsed = JSON.parse(
        await readFile(this.filePath, "utf8"),
      ) as ConsumedDocument;
      if (
        parsed.version !== 1 ||
        !parsed.records ||
        typeof parsed.records !== "object" ||
        Object.entries(parsed.records).some(
          ([transaction, authorization]) =>
            !hashPattern.test(transaction) ||
            typeof authorization !== "string" ||
            !hashPattern.test(authorization),
        )
      ) {
        throw new Error("invalid shape");
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { version: 1, records: {} };
      }
      throw new Error("CONSUMED_TRANSACTION_STORE_CORRUPT");
    }
  }

  async #write(document: ConsumedDocument): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, {
      mode: 0o600,
    });
    await rename(temporary, this.filePath);
  }

  async #locked<T>(operation: () => Promise<T>): Promise<T> {
    const previous = storeLocks.get(this.filePath) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    storeLocks.set(this.filePath, current);
    try {
      return await current;
    } finally {
      if (storeLocks.get(this.filePath) === current) {
        storeLocks.delete(this.filePath);
      }
    }
  }
}

function normalizeHash(value: string, field: string): string {
  if (!hashPattern.test(value))
    throw new Error(`${field.toUpperCase()}_INVALID`);
  return value.toLowerCase();
}
