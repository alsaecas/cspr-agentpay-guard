"use client";

import { useEffect, useState } from "react";

interface TestnetProofState {
  loaded: boolean;
  mode: string;
  message: string;
}

const TESTNET_DEPLOY_HASH =
  "b03078ffe751d10b01aa761cd2d9cb0032f7ea2f206064a3647521cdd8f3442c";
const TESTNET_PROOF_HASH =
  "9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409";
const TESTNET_CONTRACT_HASH =
  "2f3dc02eb40c42701609db6ee1a3557d437a68014deb01f46ab658e0a57e1a01";

export function TestnetProofCard() {
  const [state, setState] = useState<TestnetProofState>({
    loaded: false,
    mode: "mock",
    message: "Loading...",
  });

  useEffect(() => {
    fetch("/api/agentpay/config")
      .then((r) => r.json())
      .then((cfg: Record<string, unknown>) => {
        if (cfg.mode === "mock") {
          setState({
            loaded: true,
            mode: "mock",
            message:
              "Local demo is running in mock mode. The Casper proof-recorder anchor has also been deployed on Testnet.",
          });
        } else {
          setState({
            loaded: true,
            mode: "casper-testnet",
            message:
              "Casper Testnet mode is configured and a proof transaction has been recorded.",
          });
        }
      })
      .catch(() => {
        setState({
          loaded: true,
          mode: "unknown",
          message:
            "Could not load runtime config, but the documented Casper Testnet proof anchor is available.",
        });
      });
  }, []);

  if (!state.loaded) {
    return (
      <div className="panel">
        <h3>Separate Odra Proof Recorder</h3>
        <p style={{ color: "var(--ink-dim)" }}>
          <span className="spinner" /> Loading proof status...
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Separate Odra Proof Recorder</h3>
        <span className="badge badge-real">CASPER TESTNET</span>
      </div>
      <p style={{ color: "var(--ink-dim)", margin: "8px 0" }}>
        {state.message}
      </p>
      {state.mode === "mock" ? (
        <p style={{ color: "var(--ink-dim)", margin: "8px 0" }}>
          The interactive dashboard flow still uses deterministic mock payments.
        </p>
      ) : null}
      <dl className="proof-grid" style={{ marginTop: 12 }}>
        <div>
          <dt>Contract</dt>
          <dd>
            <code>{TESTNET_CONTRACT_HASH.slice(0, 12)}...</code>
          </dd>
        </div>
        <div>
          <dt>Deploy</dt>
          <dd>
            <a
              href={`https://testnet.cspr.live/deploy/${TESTNET_DEPLOY_HASH}`}
              target="_blank"
              rel="noreferrer"
            >
              {TESTNET_DEPLOY_HASH.slice(0, 12)}...
            </a>
          </dd>
        </div>
        <div>
          <dt>Proof</dt>
          <dd>
            <a
              href={`https://testnet.cspr.live/deploy/${TESTNET_PROOF_HASH}`}
              target="_blank"
              rel="noreferrer"
            >
              {TESTNET_PROOF_HASH.slice(0, 12)}...
            </a>
          </dd>
        </div>
      </dl>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <code>pnpm proof:testnet</code>
        <span style={{ color: "var(--ink-dim)" }}>record_proof executed</span>
      </div>
    </div>
  );
}
