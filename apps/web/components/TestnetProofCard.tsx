"use client";

import { useEffect, useState } from "react";

interface TestnetProofState {
  loaded: boolean;
  hasProof: boolean;
  message: string;
}

export function TestnetProofCard() {
  const [state, setState] = useState<TestnetProofState>({
    loaded: false,
    hasProof: false,
    message: "Loading...",
  });

  useEffect(() => {
    fetch("/api/agentpay/config")
      .then((r) => r.json())
      .then((cfg: Record<string, unknown>) => {
        if (cfg.mode === "mock") {
          setState({
            loaded: true,
            hasProof: false,
            message:
              "No Testnet proof recorded yet. Run pnpm proof:testnet with Casper Testnet credentials to anchor a proof on-chain.",
          });
        } else {
          setState({
            loaded: true,
            hasProof: false,
            message: "Testnet proof mode is configured but no proof has been recorded yet.",
          });
        }
      })
      .catch(() => {
        setState({
          loaded: true,
          hasProof: false,
          message: "Could not load config. Run pnpm proof:testnet:dry-run to validate payloads.",
        });
      });
  }, []);

  if (!state.loaded) {
    return (
      <div className="panel">
        <h3>Testnet Proof</h3>
        <p style={{ color: "var(--ink-dim)" }}>
          <span className="spinner" /> Loading proof status...
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Testnet Proof</h3>
        <span className="badge badge-mock">MOCK MODE</span>
      </div>
      <p style={{ color: "var(--ink-dim)", margin: "8px 0" }}>
        {state.hasProof
          ? "A Casper Testnet proof has been recorded."
          : state.message}
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <code>pnpm proof:testnet:dry-run</code>
        <span style={{ color: "var(--ink-dim)" }}>— validate payload</span>
      </div>
    </div>
  );
}
