"use client";

import { useState } from "react";

import { NavBar } from "@/components/NavBar";
import { ProofCard } from "@/components/ProofCard";
import { Timeline } from "@/components/Timeline";
import type { DemoRunResult } from "@/lib/demoFlow";

export default function DemoPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DemoRunResult | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/agentpay/run-demo", { method: "POST" });
      const data = (await res.json()) as DemoRunResult;
      setResult(data);
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

        {error && !result?.success && (
          <div className="panel" style={{ borderColor: "var(--error)", marginTop: 12 }}>
            <p style={{ color: "var(--error)", margin: 0 }}>
              {error}
              {error.toLowerCase().includes("unreachable") && (
                <>
                  <br />
                  Start it with: <code>pnpm --filter @cspr-agentpay/paid-api dev</code>
                </>
              )}
            </p>
          </div>
        )}

        {!result && !error && !loading && (
          <div className="panel" style={{ textAlign: "center", marginTop: 12 }}>
            <p style={{ color: "var(--ink-dim)" }}>
              Click <strong>Run AgentPay Demo</strong> to start the automated payment flow.
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

      {result && (
        <div className="gap grid-2">
          {result.policy && (
            <div className="panel">
              <h3>Policy</h3>
              <div className="kv">
              {Object.entries(result.policy).map(([k, v]) => (
                  <div key={k} style={{ display: "contents" }}>
                    <span className="kv-key">{k}</span>
                    <span className="kv-value">
                      {String(v)}
                    </span>
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
                    <span className="kv-value">
                      {String(v)}
                    </span>
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
                <span className="kv-value">
                  {String(v)}
                </span>
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

      {result?.premiumReport && (
        <div className="gap panel">
          <h3>Premium Report</h3>
          <div className="kv">
            {Object.entries(result.premiumReport).map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <span className="kv-key">{k}</span>
                <span className="kv-value">
                  {String(v)}
                </span>
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
                <span className="kv-value">
                  {String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
