export function ProofCard({ proof }: { proof: Record<string, unknown> }) {
  const kind = (proof.kind as string) ?? "mock";
  const hash =
    (proof.hash as string) ??
    (proof.transactionHash as string) ??
    (proof.deployHash as string) ??
    "—";
  const eventId = (proof.eventId as string) ?? "—";

  return (
    <div className="card">
      <div className="card-label">Proof</div>
      <div className="kv">
        <span className="kv-key">Kind</span>
        <span className="kv-value">{kind}</span>
        <span className="kv-key">Hash</span>
        <code>{hash}</code>
        <span className="kv-key">Event ID</span>
        <code>{eventId}</code>
      </div>
      {kind === "mock" && (
        <div className="badge badge-mock" style={{ marginTop: 10 }}>
          MOCK MODE — no real Casper funds moved
        </div>
      )}
    </div>
  );
}
