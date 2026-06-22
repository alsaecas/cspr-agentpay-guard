"use client";

import { useEffect, useState } from "react";

import { NavBar } from "@/components/NavBar";

export default function MerchantsPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agentpay/setup", { method: "POST" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Setup failed");
        setData((await res.json()) as Record<string, unknown>);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"));
  }, []);

  const merchant = data?.merchant as Record<string, unknown> | undefined;

  return (
    <div className="shell">
      <NavBar />

      <div className="panel">
        <h2>Merchants</h2>

        {error && <div className="badge badge-error">{error}</div>}

        {merchant ? (
          <div className="kv" style={{ marginTop: 12 }}>
            {Object.entries(merchant).map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <span className="kv-key">{k}</span>
                <span className="kv-value">
                  {typeof v === "string" ? v : JSON.stringify(v)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          !error && (
            <p style={{ color: "var(--ink-dim)", marginTop: 12 }}>
              No merchant loaded. Run the demo first.
            </p>
          )
        )}
      </div>
    </div>
  );
}
