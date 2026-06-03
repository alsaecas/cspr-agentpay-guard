use odra::prelude::*;

#[odra::module]
pub struct AgentPayGuard {
    initialized: Var<bool>,
}

#[odra::module]
impl AgentPayGuard {
    pub fn init(&mut self) {
        self.initialized.set(true);
    }

    pub fn is_initialized(&self) -> bool {
        self.initialized.get_or_default()
    }
}

