use crate::error::*;
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Registry {
    /// Key that can update creator_key
    pub initializer: Pubkey,

    /// Bump for Registry PDA seeds
    pub bump: u8,
}

impl Registry {
    pub fn invariant(&self) -> Result<()> {
        require_keys_neq!(
            self.initializer,
            Pubkey::default(),
            DispatcherError::InvalidAccount,
        );

        Ok(())
    }
}
