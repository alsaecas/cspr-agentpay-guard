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

export default function PaymentsPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchAudit = async () => {
    try {
      const res = await fetch("/api/agentpay/audit");
      if (!res.ok) {
        const err = await res.json();
        setError((err as { message?: string }).message ?? "Audit fetch failed");
        return;
      }
      const body = (await res.json()) as { auditEvents?: AuditEvent[] };
      setEvents(body.auditEvents ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    }
  };

  useEffect(() => {
    fetchAudit();
  }, []);

  const paymentEvents = events.filter((e) => e.paymentId);

  return (
    <div className="shell">
      <NavBar />

      <div className="panel">
        <div className="panel-header">
          <h2>Payments</h2>
          <button className="btn btn-ghost" onClick={fetchAudit}>
            Refresh
          </button>
        </div>

        {error && <div className="badge badge-error">{error}</div>}

        {paymentEvents.length === 0 && !error && (
          <p style={{ color: "var(--ink-dim)" }}>
            No payments yet. Run the demo to create payment activity.
          </p>
        )}

        {paymentEvents.length > 0 && (
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
              {paymentEvents.map((e) => (
                <tr key={e.eventId}>
                  <td style={{ whiteSpace: "nowrap", fontSize: 11 }}>
                    {new Date(e.createdAt).toLocaleTimeString()}
                  </td>
                  <td>{e.type}</td>
                  <td>
                    <code>{e.paymentId?.slice(0, 16)}...</code>
                  </td>
                  <td>{e.policyId ?? "—"}</td>
                  <td>{e.merchantId ?? "—"}</td>
                  <td>
                    {e.status ? <StatusBadge status={e.status} /> : "—"}
                  </td>
                  <td style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {e.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
