import {
  formatMockPaymentFlow,
  runMockPaymentFlow,
} from "@cspr-agentpay/casper-adapter";

const result = await runMockPaymentFlow();
console.log(formatMockPaymentFlow(result));
