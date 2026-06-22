"use client";

import { useEffect, useState } from "react";

import { NavBar } from "@/components/NavBar";
import { StatusBadge } from "@/components/StatusBadge";

interface AuditEvent {
  eventId: string;
  type: string;
  createdAt: string;
  policyId?: string;
  merchantId?: string;
  paymentId?: string;
  status?: string;
  message: string;
}

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agentpay/audit")
      .then(async (res) => {
        if (!res.ok) throw new Error("Audit fetch failed");
        const body = (await res.json()) as { auditEvents?: AuditEvent[] };
        setEvents(body.auditEvents ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"));
  }, []);

  const filtered = filter
    ? events.filter((e) => e.paymentId?.includes(filter))
    : events;

  return (
    <div className="shell">
      <NavBar />

      <div className="panel">
        <div className="panel-header">
          <h2>Audit Trail</h2>
          <span style={{ color: "var(--ink-dim)", fontSize: 13 }}>
            {filtered.length} events
          </span>
        </div>

        <div className="filter-bar">
          <input
            className="filter-input"
            placeholder="Filter by paymentId..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        {error && <div className="badge badge-error">{error}</div>}

        {filtered.length === 0 && !error && (
          <p style={{ color: "var(--ink-dim)" }}>
            No audit events. Run the demo to generate activity.
          </p>
        )}

        {filtered.length > 0 && (
          <>
            <div style={{ marginTop: 12, marginBottom: 12 }}>
              <strong>Timeline</strong>
              <div className="timeline" style={{ marginTop: 8 }}>
                {filtered.map((e) => (
                  <div key={e.eventId} className="timeline-step done">
                    <div>
                      <div className="timeline-label">
                        [{new Date(e.createdAt).toLocaleTimeString()}] {e.type}
                      </div>
                      <div className="timeline-detail">{e.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <h3 style={{ marginTop: 24 }}>Raw Events</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event</th>
                  <th>Payment ID</th>
                  <th>Policy</th>
                  <th>Merchant</th>
                  <th>Status</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.eventId}>
                    <td style={{ whiteSpace: "nowrap", fontSize: 11 }}>
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td>{e.type}</td>
                    <td>
                      {e.paymentId ? (
                        <code>{e.paymentId.slice(0, 16)}...</code>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{e.policyId ?? "—"}</td>
                    <td>{e.merchantId ?? "—"}</td>
                    <td>
                      {e.status ? <StatusBadge status={e.status} /> : "—"}
                    </td>
                    <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {e.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
