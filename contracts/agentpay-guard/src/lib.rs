#![cfg_attr(not(test), no_std)]
#![cfg_attr(target_arch = "wasm32", no_main)]
#![allow(unexpected_cfgs)]

use odra::prelude::*;

/// An AgentPay proof record anchored on Casper.
#[odra::module]
pub struct AgentPayProofRecorder {
    proofs: Mapping<String, ProofRecord>,
    count: Var<u64>,
}

#[odra::odra_type]
pub struct ProofRecord {
    payment_id: String,
    request_hash: String,
    policy_id: String,
    merchant_id: String,
    status: String,
    receipt_hash: Option<String>,
    recorded_by: Address,
    recorded_at: u64,
}

/// Emitted when a new proof is recorded.
#[odra::event]
pub struct AgentPayProofRecorded {
    pub payment_id: String,
    pub request_hash: String,
    pub policy_id: String,
    pub merchant_id: String,
    pub status: String,
    pub receipt_hash: Option<String>,
    pub actor: Address,
    pub recorded_at: u64,
}

#[odra::module]
impl AgentPayProofRecorder {
    /// Initialize the proof recorder.
    pub fn init(&mut self) {
        self.count.set(0);
    }

    /// Record an AgentPay proof. Rejects duplicates, empty IDs, and invalid statuses.
    pub fn record_proof(
        &mut self,
        payment_id: String,
        request_hash: String,
        policy_id: String,
        merchant_id: String,
        status: String,
        receipt_hash: Option<String>,
    ) {
        assert!(!payment_id.trim().is_empty(), "paymentId must not be empty.");
        assert!(!request_hash.trim().is_empty(), "requestHash must not be empty.");

        match status.as_str() {
            "authorized" | "escrowed" | "fulfilled" | "settled" => {}
            _ => panic!("Invalid status. Must be one of: authorized, escrowed, fulfilled, settled."),
        }

        assert!(
            self.proofs.get(&payment_id).is_none(),
            "Duplicate paymentId — proof already recorded."
        );

        let actor = self.env().caller();
        let recorded_at = self.env().get_block_time();

        let proof = ProofRecord {
            payment_id: payment_id.clone(),
            request_hash: request_hash.clone(),
            policy_id: policy_id.clone(),
            merchant_id: merchant_id.clone(),
            status: status.clone(),
            receipt_hash: receipt_hash.clone(),
            recorded_by: actor,
            recorded_at,
        };

        self.proofs.set(&payment_id, proof);
        let c = self.count.get_or_default();
        self.count.set(c + 1);

        self.env().emit_event(AgentPayProofRecorded {
            payment_id,
            request_hash,
            policy_id,
            merchant_id,
            status,
            receipt_hash,
            actor,
            recorded_at,
        });
    }

    /// Retrieve a stored proof by paymentId.
    pub fn get_proof(&self, payment_id: String) -> Option<ProofRecord> {
        self.proofs.get(&payment_id)
    }

    /// Return the total number of recorded proofs.
    pub fn proof_count(&self) -> u64 {
        self.count.get_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use odra::host::Deployer;
    use odra::host::NoArgs;

    fn setup() -> AgentPayProofRecorderHostRef {
        let env = odra_test::env();
        let mut recorder = AgentPayProofRecorder::deploy(&env, NoArgs);
        recorder.init();
        recorder
    }

    fn record(recorder: &mut AgentPayProofRecorderHostRef, pid: &str, status: &str) {
        recorder.record_proof(
            pid.to_string(),
            format!("hash-{pid}"),
            "policy-001".to_string(),
            "merchant-001".to_string(),
            status.to_string(),
            None,
        );
    }

    #[test]
    fn init_works() {
        let recorder = setup();
        assert_eq!(recorder.proof_count(), 0);
    }

    #[test]
    fn record_proof_works() {
        let mut recorder = setup();
        record(&mut recorder, "pay-001", "escrowed");
        assert_eq!(recorder.proof_count(), 1);

        let proof = recorder.get_proof("pay-001".to_string());
        assert!(proof.is_some());
        let p = proof.unwrap();
        assert_eq!(p.payment_id, "pay-001");
        assert_eq!(p.status, "escrowed");
    }

    #[test]
    fn get_proof_returns_stored_data() {
        let mut recorder = setup();
        recorder.record_proof(
            "pay-002".to_string(),
            "hash-002".to_string(),
            "pol-2".to_string(),
            "mer-2".to_string(),
            "fulfilled".to_string(),
            Some("receipt-hash".to_string()),
        );

        let proof = recorder.get_proof("pay-002".to_string());
        let p = proof.unwrap();
        assert_eq!(p.status, "fulfilled");
        assert_eq!(p.receipt_hash, Some("receipt-hash".to_string()));
    }

    #[test]
    #[should_panic(expected = "Duplicate")]
    fn duplicate_payment_id_is_rejected() {
        let mut recorder = setup();
        record(&mut recorder, "pay-003", "authorized");
        record(&mut recorder, "pay-003", "escrowed");
    }

    #[test]
    #[should_panic(expected = "Invalid status")]
    fn invalid_status_is_rejected() {
        let mut recorder = setup();
        record(&mut recorder, "pay-004", "not-a-status");
    }

    #[test]
    #[should_panic(expected = "must not be empty")]
    fn empty_payment_id_is_rejected() {
        let mut recorder = setup();
        recorder.record_proof(
            "".to_string(),
            "hash".to_string(),
            "pol".to_string(),
            "mer".to_string(),
            "escrowed".to_string(),
            None,
        );
    }

    #[test]
    #[should_panic(expected = "must not be empty")]
    fn empty_request_hash_is_rejected() {
        let mut recorder = setup();
        recorder.record_proof(
            "pay-006".to_string(),
            "".to_string(),
            "pol".to_string(),
            "mer".to_string(),
            "escrowed".to_string(),
            None,
        );
    }

    #[test]
    fn proof_count_increments() {
        let mut recorder = setup();
        assert_eq!(recorder.proof_count(), 0);
        record(&mut recorder, "pay-007", "authorized");
        assert_eq!(recorder.proof_count(), 1);
        record(&mut recorder, "pay-008", "settled");
        assert_eq!(recorder.proof_count(), 2);
    }
}
