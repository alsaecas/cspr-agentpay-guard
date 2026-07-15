import { NavBar } from "@/components/NavBar";
import { VerifiedTestnetPaymentCard } from "@/components/VerifiedTestnetPaymentCard";

export default function HomePage() {
  return (
    <div className="shell">
      <NavBar />

      <div className="hero">
        <h1>Zero-Trust Payment Firewall for Autonomous AI Agents on Casper</h1>
        <p>
          x402 is the payment rail. AgentPay Guard is the authorization layer.
          Deterministic policy checks run before signing, and protected data is
          released only after independently verified settlement.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <a href="/judge" className="btn btn-primary">
            Open Judge Mode
          </a>
          <a href="/demo" className="btn btn-ghost">
            Run Interactive Demo
          </a>
        </div>
      </div>

      <div className="gap">
        <VerifiedTestnetPaymentCard
          commit={process.env.VERCEL_GIT_COMMIT_SHA ?? null}
        />
      </div>

      <h2 className="gap">Three Judge Scenarios</h2>
      <div className="grid-3 gap">
        <div className="panel">
          <span className="badge badge-real">ALLOW</span>
          <h3 style={{ marginTop: 12 }}>Allowed payment</h3>
          <p style={{ color: "var(--ink-dim)" }}>
            The hosted deterministic scenario shows policy ALLOW. The separate
            card above is public evidence of the real Testnet settlement.
          </p>
        </div>
        <div className="panel">
          <span className="badge badge-error">DENY</span>
          <h3 style={{ marginTop: 12 }}>Prompt-injection attack</h3>
          <p style={{ color: "var(--ink-dim)" }}>
            Policy denial stops the signer. No transaction is constructed or
            submitted.
          </p>
        </div>
        <div className="panel">
          <span className="badge badge-error">REJECTED</span>
          <h3 style={{ marginTop: 12 }}>Replay attack</h3>
          <p style={{ color: "var(--ink-dim)" }}>
            A consumed transaction cannot authorize another request, and no
            premium response is released.
          </p>
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
            The agent checks its spending policy (merchant allowlist,
            per-payment max, total budget) and authorizes exactly one
            request-bound payment.
          </p>
        </div>
        <div className="panel">
          <h3>4. Receipt unlocks premium data</h3>
          <p style={{ color: "var(--ink-dim)", margin: "8px 0 0" }}>
            The real local Testnet path reconstructs authorization, verifies
            its signature, confirms TransactionV1 through RPC, and only then
            returns premium data. Hosted scenarios remain deterministic demos.
          </p>
        </div>
      </div>

      <div className="gap panel">
        <div className="panel-header">
          <h2>Quick Links</h2>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <a href="/policies" className="btn btn-ghost">
            View Policies
          </a>
          <a href="/payments" className="btn btn-ghost">
            View Payments
          </a>
          <a href="/merchants" className="btn btn-ghost">
            View Merchants
          </a>
          <a href="/audit" className="btn btn-ghost">
            Audit Trail
          </a>
        </div>
      </div>

      <div
        className="gap"
        style={{ textAlign: "center", color: "var(--ink-dim)", fontSize: 13 }}
      >
        Hosted interactive scenarios use deterministic demo state. The verified
        payment card above is separate public Casper Testnet evidence.
        <br />
        MCP judge demo: <code>pnpm demo:mcp:judge</code>
      </div>
    </div>
  );
}
