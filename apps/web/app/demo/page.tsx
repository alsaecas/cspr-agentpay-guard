"use client";

import { useEffect, useState } from "react";

import { NavBar } from "@/components/NavBar";
import { ProofCard } from "@/components/ProofCard";
import { TestnetProofCard } from "@/components/TestnetProofCard";
import { Timeline } from "@/components/Timeline";
import type { DemoRunResult } from "@/lib/demoFlow";
import { saveDemoRunResult } from "@/lib/demoRunCache";

export default function DemoPage() {
  const [testnetStatus, setTestnetStatus] = useState<{
    readyForLocalDryRun: boolean;
    payee: string | null;
    amountMotes: string | null;
    network: string;
    resource: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DemoRunResult | null>(null);
  const [scenario, setScenario] = useState<
    | "legacy-demo"
    | "allowed-payment"
    | "prompt-injection-attack"
    | "replay-attack"
  >("allowed-payment");

  useEffect(() => {
    fetch("/api/agentpay/testnet-status")
      .then((response) => response.json())
      .then(setTestnetStatus)
      .catch(() => setTestnetStatus(null));
  }, []);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/agentpay/run-demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(scenario === "legacy-demo" ? {} : { scenario }),
      });
      const data = (await res.json()) as DemoRunResult;
      setResult(data);
      saveDemoRunResult(data);
      if (!res.ok) setError(data.error ?? "Unknown error");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="shell">
      <NavBar />

      <div className="panel">
        <div className="panel-header">
          <h2>AgentPay Demo</h2>
          <button className="btn btn-primary" onClick={run} disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            {loading ? "Running..." : "Run AgentPay Demo"}
          </button>
        </div>
        <p style={{ color: "var(--ink-dim)", margin: "0 0 12px" }}>
          Simulates an autonomous agent paying for a protected parking report
          through the HTTP 402 flow. All mock mode — no real funds.
        </p>
        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={{ color: "var(--ink-dim)", marginRight: 8 }}>
            Scenario
          </span>
          <select
            value={scenario}
            onChange={(event) =>
              setScenario(event.target.value as typeof scenario)
            }
          >
            <option value="allowed-payment">Allowed payment</option>
            <option value="prompt-injection-attack">
              Prompt injection attack
            </option>
            <option value="replay-attack">Replay attack</option>
            <option value="legacy-demo">Legacy receipt demo</option>
          </select>
        </label>

        {error && !result?.success && (
          <div
            className="panel"
            style={{ borderColor: "var(--error)", marginTop: 12 }}
          >
            <p style={{ color: "var(--error)", margin: 0 }}>{error}</p>
          </div>
        )}

        {!result && !error && !loading && (
          <div className="panel" style={{ textAlign: "center", marginTop: 12 }}>
            <p style={{ color: "var(--ink-dim)" }}>
              Click <strong>Run AgentPay Demo</strong> to start the automated
              payment flow.
            </p>
            <p style={{ color: "var(--ink-dim)", fontSize: 13 }}>
              Alternatively, run the terminal demo: <code>pnpm demo:mock</code>
            </p>
          </div>
        )}
      </div>

      {result?.steps && result.steps.length > 0 && (
        <div className="gap panel">
          <h3>Timeline</h3>
          <Timeline steps={result.steps} />
        </div>
      )}

      {result?.decision && (
        <div className="gap panel">
          <h3>Guard Decision: {result.decision}</h3>
          <div className="kv">
            <span className="kv-key">scenario</span>
            <span className="kv-value">{result.scenario}</span>
            <span className="kv-key">agent intent</span>
            <span className="kv-value">{result.agentIntent}</span>
            <span className="kv-key">denial reason</span>
            <span className="kv-value">{result.denialReason ?? "none"}</span>
            <span className="kv-key">settlement adapter called</span>
            <span className="kv-value">
              {String(result.settlementAdapterCalled)}
            </span>
            <span className="kv-key">budget</span>
            <span className="kv-value">
              {result.budgetBefore} → {result.budgetAfter}
            </span>
            <span className="kv-key">mode</span>
            <span className="kv-value">
              {result.mode} — no real Casper funds moved
            </span>
          </div>
          {result.guardChecks && (
            <pre className="code-block">
              {JSON.stringify(result.guardChecks, null, 2)}
            </pre>
          )}
        </div>
      )}

      {result && (
        <div className="gap grid-2">
          {result.policy && (
            <div className="panel">
              <h3>Policy</h3>
              <div className="kv">
                {Object.entries(result.policy).map(([k, v]) => (
                  <div key={k} style={{ display: "contents" }}>
                    <span className="kv-key">{k}</span>
                    <span className="kv-value">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.merchant && (
            <div className="panel">
              <h3>Merchant</h3>
              <div className="kv">
                {Object.entries(result.merchant).map(([k, v]) => (
                  <div key={k} style={{ display: "contents" }}>
                    <span className="kv-key">{k}</span>
                    <span className="kv-value">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {result?.receipt && (
        <div className="gap panel">
          <h3>Payment Receipt</h3>
          <div className="kv">
            {Object.entries(result.receipt).map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <span className="kv-key">{k}</span>
                <span className="kv-value">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result?.proof && (
        <div className="gap">
          <ProofCard proof={result.proof} />
        </div>
      )}

      <div className="gap">
        <TestnetProofCard />
      </div>

      <div className="gap panel" style={{ borderColor: "var(--warning)" }}>
        <div className="panel-header">
          <h3>Real Testnet Payment</h3>
          <span className="badge">CASPER TESTNET · LOCAL ONLY</span>
        </div>
        <p style={{ color: "var(--ink-dim)" }}>
          Hosted signing is disabled. No payment runs on page load and this
          panel has no live-spend button.
        </p>
        <div className="kv">
          <span className="kv-key">configuration</span>
          <span className="kv-value">
            {testnetStatus?.readyForLocalDryRun
              ? "ready for local dry-run"
              : "missing local configuration"}
          </span>
          <span className="kv-key">network</span>
          <span className="kv-value">
            {testnetStatus?.network ?? "casper-test"}
          </span>
          <span className="kv-key">payee</span>
          <span className="kv-value">
            {testnetStatus?.payee ?? "not configured"}
          </span>
          <span className="kv-key">amount</span>
          <span className="kv-value">
            {testnetStatus?.amountMotes
              ? `${testnetStatus.amountMotes} motes`
              : "not configured"}
          </span>
          <span className="kv-key">resource</span>
          <span className="kv-value">
            {testnetStatus?.resource ?? "local paid API"}
          </span>
          <span className="kv-key">execution</span>
          <span className="kv-value">
            <code>pnpm demo:testnet:guarded:dry-run</code>
          </span>
        </div>
      </div>

      {result?.premiumReport && (
        <div className="gap panel">
          <h3>Premium Report</h3>
          <div className="kv">
            {Object.entries(result.premiumReport).map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <span className="kv-key">{k}</span>
                <span className="kv-value">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result?.settlement && (
        <div className="gap panel">
          <h3>Settlement</h3>
          <div className="kv">
            {Object.entries(result.settlement).map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <span className="kv-key">{k}</span>
                <span className="kv-value">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
