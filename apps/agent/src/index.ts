import { loadAgentDemoConfig, runAgentDemo } from "./demo";

const config = loadAgentDemoConfig();

try {
  const result = await runAgentDemo(config);
  for (const line of result.lines) {
    console.log(line);
  }
  if (!result.success) {
    process.exit(1);
  }
} catch (err) {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
}
