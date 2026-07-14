import {
  runGuardedX402Scenario,
  type GuardedDemoScenario,
} from "@cspr-agentpay/casper-adapter";

const supported = new Set<GuardedDemoScenario>([
  "allowed-payment",
  "prompt-injection-attack",
  "replay-attack",
]);
const requested = process.env.AGENTPAY_SCENARIO ?? "allowed-payment";

if (!supported.has(requested as GuardedDemoScenario)) {
  throw new Error(
    `Unknown AGENTPAY_SCENARIO '${requested}'. Use: ${Array.from(supported).join(", ")}.`,
  );
}

const result = await runGuardedX402Scenario(requested as GuardedDemoScenario);
console.log(JSON.stringify(result, null, 2));
