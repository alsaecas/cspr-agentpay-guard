import evidence from "../../../docs/evidence/first-guarded-testnet-payment.json";

export function VerifiedTestnetPaymentCard({
  commit,
}: {
  commit?: string | null;
}) {
  return (
    <div className="panel" style={{ borderColor: "var(--accent)" }}>
      <div className="panel-header">
        <h2>Verified Testnet Payment</h2>
        <span className="badge badge-real">VERIFIED</span>
      </div>
      <p style={{ color: "var(--ink-dim)" }}>
        One real policy-authorized native-CSPR payment. Premium data was
        released only after independent Casper RPC verification.
      </p>
      <div className="kv">
        <span className="kv-key">transaction</span>
        <span className="kv-value hash-value">
          <a href={evidence.explorerUrl} target="_blank" rel="noreferrer">
            {evidence.transactionHash}
          </a>
        </span>
        <span className="kv-key">network</span>
        <span className="kv-value">{evidence.network}</span>
        <span className="kv-key">amount</span>
        <span className="kv-value">2.5 CSPR</span>
        <span className="kv-key">payer</span>
        <span className="kv-value">{evidence.signerAccountHash}</span>
        <span className="kv-key">payee</span>
        <span className="kv-value">{evidence.payeeAccountHash}</span>
        <span className="kv-key">block height</span>
        <span className="kv-value">{evidence.blockHeight}</span>
        <span className="kv-key">execution</span>
        <span className="kv-value">{evidence.executionStatus}</span>
        <span className="kv-key">payment response</span>
        <span className="kv-value">verified</span>
        <span className="kv-key">verified</span>
        <span className="kv-value">{evidence.verifiedAt}</span>
        <span className="kv-key">premium resource</span>
        <span className="kv-value">released after verification</span>
        <span className="kv-key">Git commit</span>
        <span className="kv-value">{commit ?? "local evidence branch"}</span>
      </div>
      <p style={{ color: "var(--ink-dim)", fontSize: 13, marginBottom: 0 }}>
        Signing ran locally with a dedicated Testnet key. The hosted Vercel app
        never loads private keys or initiates spending. The Odra proof recorder
        is a separate existing on-chain proof path.
      </p>
    </div>
  );
}
