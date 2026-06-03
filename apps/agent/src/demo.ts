import {
  formatMockPaymentFlow,
  runMockPaymentFlow,
  type MockPaymentFlowResult,
} from "@cspr-agentpay/casper-adapter";

export type MockDemoResult = MockPaymentFlowResult;

export async function runMockAgentDemo(): Promise<MockDemoResult> {
  return runMockPaymentFlow();
}

export function formatMockDemo(result: MockDemoResult): string {
  return formatMockPaymentFlow(result);
}
