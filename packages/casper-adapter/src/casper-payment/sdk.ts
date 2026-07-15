import * as CasperSdkNamespace from "casper-js-sdk";

type CasperSdkApi = typeof import("casper-js-sdk");

// casper-js-sdk 5 is CommonJS. Native Node ESM exposes its API on `default`,
// while test/bundler runtimes may synthesize named namespace exports.
const defaultExport = (
  CasperSdkNamespace as unknown as { default?: CasperSdkApi }
).default;

export const CasperSdk =
  defaultExport ?? (CasperSdkNamespace as unknown as CasperSdkApi);
