"use client";

import { useEffect, useState } from "react";

import { NavBar } from "@/components/NavBar";

export default function PoliciesPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSetup = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agentpay/setup", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        setError((err as { message?: string }).message ?? "Setup failed");
        return;
      }
      setData((await res.json()) as Record<string, unknown>);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSetup();
  }, []);

  const policy = data?.policy as Record<string, unknown> | undefined;

  return (
    <div className="shell">
      <NavBar />

      <div className="panel">
        <div className="panel-header">
          <h2>Policies</h2>
          <button className="btn btn-primary" onClick={fetchSetup} disabled={loading}>
            {loading ? "Loading..." : "Reload"}
          </button>
        </div>

        {error && (
          <div className="badge badge-error" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        {policy ? (
          <div className="kv">
            {Object.entries(policy).map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <span className="kv-key">{k}</span>
                <span className="kv-value">
                  {typeof v === "string" ? v : JSON.stringify(v)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          !loading && !error && (
            <p style={{ color: "var(--ink-dim)" }}>
              No policy loaded. Click Reload or run the demo first.
            </p>
          )
        )}
      </div>
    </div>
  );
}
