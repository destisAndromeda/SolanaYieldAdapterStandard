use anchor_lang::prelude::*;
use crate::error::*;

#[account]
#[derive(InitSpace)]
pub struct Dispatcher {
    pub authority: Pubkey,

    pub creator_key: Pubkey,

    pub bump: u8,
}

impl Dispatcher {
    pub fn invariant(&self) -> Result<()> {
        require_keys_neq!(
            self.authority,
            self.creator_key,
            DispatcherError::InvalidAccount,
        );

        Ok(())
    }
}