import { NavBar } from "@/components/NavBar";
import { TestnetProofCard } from "@/components/TestnetProofCard";
import { VerifiedTestnetPaymentCard } from "@/components/VerifiedTestnetPaymentCard";

const tools = [
  ["agentpay_run_rwa_due_diligence", "Runs the safe MAD-001 journey"],
  ["agentpay_evaluate_payment", "Explains ALLOW or stable denial code"],
  ["agentpay_get_verified_testnet_payment", "Reads public Testnet evidence"],
  ["agentpay_security_model", "Returns fail-closed wallet invariants"],
] as const;

const links = [
  ["Repository", "https://github.com/alsaecas/cspr-agentpay-guard"],
  ["Evidence report", "https://github.com/alsaecas/cspr-agentpay-guard/blob/main/docs/evidence/first-guarded-testnet-payment.md"],
  ["Machine-readable evidence", "https://github.com/alsaecas/cspr-agentpay-guard/blob/main/docs/evidence/first-guarded-testnet-payment.json"],
  ["Payment transaction", "https://testnet.cspr.live/transaction/801d558b18be546ebe18ff884541d451428dacc92e17c8a6c6a33df4d8b4440f"],
  ["Contract deployment", "https://testnet.cspr.live/deploy/b03078ffe751d10b01aa761cd2d9cb0032f7ea2f206064a3647521cdd8f3442c"],
  ["Proof transaction", "https://testnet.cspr.live/deploy/9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409"],
  ["Interactive demo", "/demo"],
] as const;

export default function JudgePage() {
  return (
    <div className="shell judge-page">
      <NavBar />

      <header className="hero judge-hero">
        <span className="eyebrow">JUDGE MODE · SAFE BY DEFAULT</span>
        <h1>Firewall for AI Wallets</h1>
        <p className="judge-subtitle">
          x402 is the payment rail. AgentPay Guard is the authorization layer.
        </p>
        <p>
          An autonomous due-diligence agent buys premium data for a tokenized
          parking asset without giving the model unrestricted wallet control.
        </p>
        <div className="cta-row">
          <a className="btn btn-primary" href="/demo">Run Interactive Demo</a>
          <a className="btn btn-ghost" href="#verified-payment">Inspect Real Evidence</a>
        </div>
      </header>

      <section className="gap panel" aria-labelledby="architecture-heading">
        <div className="panel-header">
          <h2 id="architecture-heading">60-second architecture</h2>
          <span className="badge badge-mock">HOSTED: NO SPEND</span>
        </div>
        <div className="architecture-flow" aria-label="Agent payment architecture">
          {["Agent task", "HTTP 402", "Deterministic guard", "Casper payment boundary", "Independent verification", "Premium RWA data"].map((step, index) => (
            <div className="flow-step" key={step}>
              <span>{step}</span>{index < 5 ? <b aria-hidden="true">→</b> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="gap" aria-labelledby="scenarios-heading">
        <h2 id="scenarios-heading">Three decisions a judge can verify</h2>
        <div className="grid-3 gap">
          <article className="panel scenario-card allow-card">
            <span className="badge badge-real">ALLOW</span>
            <h3>1. Allowed request</h3>
            <p>Merchant, payee, resource, amount, budget, integrity, and expiry all match.</p>
            <ul><li>Real path may reach the signer boundary.</li><li>Hosted scenario moves no funds.</li><li>Separate real evidence is below.</li></ul>
          </article>
          <article className="panel scenario-card deny-card">
            <span className="badge badge-error">DENY</span>
            <h3>2. Prompt-injection attack</h3>
            <p>A malicious instruction attempts to substitute the payee or escalate the amount.</p>
            <ul><li>Reason: <code>PAYEE_MISMATCH</code></li><li>Signer called: false</li><li>Transaction: none</li></ul>
          </article>
          <article className="panel scenario-card deny-card">
            <span className="badge badge-error">REJECTED</span>
            <h3>3. Replay attack</h3>
            <p>A consumed transaction cannot authorize a different or repeated request.</p>
            <ul><li>Reason: <code>TRANSACTION_REPLAYED</code></li><li>No premium data</li><li>No submission</li></ul>
          </article>
        </div>
      </section>

      <section id="verified-payment" className="gap" aria-label="Verified Testnet payment">
        <VerifiedTestnetPaymentCard commit={process.env.VERCEL_GIT_COMMIT_SHA ?? null} />
      </section>

      <section className="gap panel" aria-labelledby="mcp-heading">
        <div className="panel-header">
          <h2 id="mcp-heading">MCP Agent Interface</h2>
          <span className="badge badge-mode">REAL MCP PROTOCOL</span>
        </div>
        <p className="section-lede">
          A project-owned MCP server built with the official Model Context Protocol SDK exposes the guard to MCP-compatible agents. The judge workflow is deterministic and no-spend.
        </p>
        <div className="grid-2">
          <div>
            <h3>Available tools</h3>
            <dl className="tool-list">
              {tools.map(([name, description]) => <div key={name}><dt><code>{name}</code></dt><dd>{description}</dd></div>)}
            </dl>
          </div>
          <div className="terminal-card" aria-label="MCP tool sequence example">
            <div className="terminal-label">Agent</div>
            <p>“Get the premium MAD-001 due-diligence report.”</p>
            <pre>{`agentpay_run_rwa_due_diligence
→ agentpay_evaluate_payment
→ policy ALLOW
→ verified evidence`}</pre>
            <code>pnpm demo:mcp:judge</code>
          </div>
        </div>
      </section>

      <section className="gap" aria-labelledby="boundary-heading">
        <h2 id="boundary-heading">Real versus hosted</h2>
        <div className="grid-3 gap boundary-grid">
          <article className="panel"><span className="badge badge-mock">HOSTED</span><h3>Judge scenarios</h3><p>Deterministic, repeatable, no signer, no funds, no private keys.</p></article>
          <article className="panel"><span className="badge badge-real">REAL</span><h3>Guarded payment</h3><p>One independently verified native-CSPR TransactionV1 on Casper Testnet.</p></article>
          <article className="panel"><span className="badge badge-warn">SEPARATE</span><h3>Odra proof recorder</h3><p>A public audit/proof transaction. It is not payment settlement, escrow, or custody.</p></article>
        </div>
      </section>

      <div className="gap"><TestnetProofCard /></div>

      <section className="gap panel" aria-labelledby="links-heading">
        <h2 id="links-heading">Judge links</h2>
        <div className="judge-links">
          {links.map(([label, href]) => <a className="btn btn-ghost" key={label} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined}>{label}</a>)}
          <span className="btn btn-disabled" aria-label="Final video pending upload">Final video · pending upload</span>
        </div>
      </section>
    </div>
  );
}
