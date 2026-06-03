import { formatMockDemo, runMockAgentDemo } from "./demo";

const result = await runMockAgentDemo();
console.log(formatMockDemo(result));
