import {
  PROTOCOL_VERSION,
  createBodyHash,
  createRequestHash,
} from "@cspr-agentpay/protocol";
import { mockId } from "@cspr-agentpay/casper-adapter";

const mode = process.env.NEXT_PUBLIC_AGENTPAY_MODE ?? "mock";
const requestHash = createRequestHash({
  method: "GET",
  url: "https://api.example.test/premium/report?symbol=CSPR",
  bodyHash: createBodyHash({}),
  endpointId: "premium-report-cspr",
  merchantId: "merchant_market_data_001",
  agentId: "agent_research_001",
  nonce: "dashboard-request-nonce",
  expiresAt: "2030-01-01T00:00:00.000Z",
});

export default function DashboardPage() {
  return (
    <main className="shell">
      <section className="toolbar">
        <div>
          <p className="eyebrow">CSPR AgentPay Guard</p>
          <h1>Payment Firewall Dashboard</h1>
        </div>
        <span className="mode">mode: {mode}</span>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>Agent Policy</h2>
          <dl>
            <div>
              <dt>Agent</dt>
              <dd>agent_research_001</dd>
            </div>
            <div>
              <dt>Merchant</dt>
              <dd>merchant_market_data_001</dd>
            </div>
            <div>
              <dt>Limit</dt>
              <dd>1 CSPR per payment</dd>
            </div>
          </dl>
        </article>

        <article className="panel">
          <h2>Mock Audit Trail</h2>
          <ol>
            <li>Paid API returns 402 Payment Required</li>
            <li>Agent authorizes request-bound payment</li>
            <li>Mock Casper adapter escrows payment</li>
            <li>Receipt unlocks premium data</li>
          </ol>
        </article>
      </section>

      <section className="panel wide">
        <h2>Protocol Proof</h2>
        <div className="proof-row">
          <span>version</span>
          <code>{PROTOCOL_VERSION}</code>
        </div>
        <div className="proof-row">
          <span>requestHash</span>
          <code>{requestHash}</code>
        </div>
        <div className="proof-row">
          <span>mock event</span>
          <code>{mockId("event", requestHash)}</code>
        </div>
      </section>
    </main>
  );
}
