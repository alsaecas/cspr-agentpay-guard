import { NavBar } from "@/components/NavBar";

export default function HomePage() {
  return (
    <div className="shell">
      <NavBar />

      <div className="hero">
        <h1>Secure Payments for Autonomous AI Agents on Casper</h1>
        <p>
          HTTP 402 payments with policy limits, request-bound receipts, escrow,
          and audit trails. All visible through Casper.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <a href="/demo" className="btn btn-primary">
            Run Dashboard Demo
          </a>
          <a href="/audit" className="btn btn-ghost">
            View Audit Trail
          </a>
        </div>
      </div>

      <h2>How It Works</h2>
      <div className="grid-2">
        <div className="panel">
          <h3>1. Agent calls protected API</h3>
          <p style={{ color: "var(--ink-dim)", margin: "8px 0 0" }}>
            An autonomous AI agent requests premium data from a protected
            resource.
          </p>
        </div>
        <div className="panel">
          <h3>2. API returns HTTP 402</h3>
          <p style={{ color: "var(--ink-dim)", margin: "8px 0 0" }}>
            The server responds with a PaymentRequirement — amount, merchant,
            requestHash, and expiry.
          </p>
        </div>
        <div className="panel">
          <h3>3. Agent pays under policy</h3>
          <p style={{ color: "var(--ink-dim)", margin: "8px 0 0" }}>
            The agent checks its spending policy (merchant allowlist, per-payment
            max, total budget) and authorizes exactly one request-bound payment.
          </p>
        </div>
        <div className="panel">
          <h3>4. Receipt unlocks premium data</h3>
          <p style={{ color: "var(--ink-dim)", margin: "8px 0 0" }}>
            Casper records the payment. The receipt is bound to the exact HTTP
            request. The API verifies it and releases premium data.
          </p>
        </div>
      </div>

      <div className="gap panel">
        <div className="panel-header">
          <h2>Quick Links</h2>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <a href="/policies" className="btn btn-ghost">View Policies</a>
          <a href="/payments" className="btn btn-ghost">View Payments</a>
          <a href="/merchants" className="btn btn-ghost">View Merchants</a>
          <a href="/audit" className="btn btn-ghost">Audit Trail</a>
        </div>
      </div>

      <div className="gap" style={{ textAlign: "center", color: "var(--ink-dim)", fontSize: 13 }}>
        All proofs use deterministic <code>mock-*</code> hashes. No real Casper funds are moved.
        <br />
        Terminal demo: <code>pnpm demo:mock</code>
      </div>
    </div>
  );
}
