import * as CasperSdkNamespace from "casper-js-sdk";

type CasperSdkApi = typeof import("casper-js-sdk");

// casper-js-sdk 5 is CommonJS. Native Node ESM exposes its API on `default`,
// while test/bundler runtimes may synthesize named namespace exports.
const defaultExport = (
  CasperSdkNamespace as unknown as { default?: CasperSdkApi }
).default;

const normalizedSdk =
  defaultExport ?? (CasperSdkNamespace as unknown as CasperSdkApi);

const requiredExports = [
  "AccountHash",
  "HttpHandler",
  "KeyAlgorithm",
  "NativeTransferBuilder",
  "PrivateKey",
  "PublicKey",
  "RpcClient",
  "Timestamp",
  "TransactionEntryPointEnum",
] as const;

for (const name of requiredExports) {
  if (normalizedSdk[name] == null) {
    throw new Error(`CASPER_SDK_EXPORT_MISSING:${name}`);
  }
}

export const CasperSdk = normalizedSdk;
