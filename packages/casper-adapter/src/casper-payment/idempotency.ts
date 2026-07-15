import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { SubmissionRecord, SubmissionState } from "./types";

interface StoreDocument {
  version: 1;
  records: Record<string, SubmissionRecord>;
}

const locks = new Map<string, Promise<void>>();

export class FileSubmissionStore {
  constructor(
    readonly filePath: string,
    readonly mode: "real" | "mock",
  ) {
    if (!filePath.endsWith(`.${mode}.json`)) {
      throw new Error(`Idempotency path must end in .${mode}.json`);
    }
  }

  async get(hash: string): Promise<SubmissionRecord | undefined> {
    return this.#locked(async () => (await this.#read()).records[hash]);
  }

  async prepare(hash: string, now = new Date()): Promise<SubmissionRecord> {
    return this.#locked(async () => {
      const doc = await this.#read();
      const existing = doc.records[hash];
      if (existing) return existing;
      const timestamp = now.toISOString();
      const record: SubmissionRecord = {
        authorizationHash: hash,
        state: "prepared",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      doc.records[hash] = record;
      await this.#write(doc);
      return record;
    });
  }

  async transition(
    hash: string,
    state: SubmissionState,
    update: { transactionHash?: string; failureReason?: string } = {},
  ): Promise<SubmissionRecord> {
    return this.#locked(async () => {
      const doc = await this.#read();
      const current = doc.records[hash];
      if (!current) throw new Error("IDEMPOTENCY_RECORD_NOT_PREPARED");
      if (current.state === "confirmed" && state !== "confirmed") {
        throw new Error("IDEMPOTENCY_ALREADY_CONFIRMED");
      }
      if (
        current.transactionHash &&
        update.transactionHash &&
        current.transactionHash.toLowerCase() !==
          update.transactionHash.toLowerCase()
      ) {
        throw new Error("IDEMPOTENCY_TRANSACTION_HASH_CONFLICT");
      }
      if (
        (state === "submitted" || state === "confirmed") &&
        !current.transactionHash &&
        !update.transactionHash
      ) {
        throw new Error("IDEMPOTENCY_TRANSACTION_HASH_MISSING");
      }
      const stable = { ...current };
      if (state === "confirmed") delete stable.failureReason;
      const record: SubmissionRecord = {
        ...stable,
        state,
        updatedAt: new Date().toISOString(),
        ...(update.transactionHash
          ? { transactionHash: update.transactionHash }
          : {}),
        ...(update.failureReason
          ? { failureReason: update.failureReason }
          : {}),
      };
      doc.records[hash] = record;
      await this.#write(doc);
      return record;
    });
  }

  async #read(): Promise<StoreDocument> {
    try {
      const parsed = JSON.parse(
        await readFile(this.filePath, "utf8"),
      ) as StoreDocument;
      if (
        parsed.version !== 1 ||
        !parsed.records ||
        typeof parsed.records !== "object"
      ) {
        throw new Error("invalid shape");
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { version: 1, records: {} };
      }
      throw new Error("IDEMPOTENCY_STORE_CORRUPT");
    }
  }

  async #write(doc: StoreDocument): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temp = `${this.filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await writeFile(temp, `${JSON.stringify(doc, null, 2)}\n`, { mode: 0o600 });
    await rename(temp, this.filePath);
  }

  async #locked<T>(operation: () => Promise<T>): Promise<T> {
    const previous = locks.get(this.filePath) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => (release = resolve));
    const queued = previous.then(() => current);
    locks.set(this.filePath, queued);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (locks.get(this.filePath) === queued) locks.delete(this.filePath);
    }
  }
}
