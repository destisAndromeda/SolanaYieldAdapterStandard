use anchor_lang::prelude::*;
use crate::error::*;

#[account]
#[derive(InitSpace)]
pub struct Adapter {
    /// Authority that can manage this adapter entry
    pub authority: Pubkey,

    /// Program id for the adapter
    pub program_id: Pubkey,

    /// Enable to use Adapter account if true
    pub is_active: bool,

    /// PDA bump
    pub bump: u8,
}

impl Adapter {
    pub fn invariant(&self) -> Result<()> {
        require_keys_neq!(
            self.authority,
            Pubkey::default(),
            DispatcherError::InvalidAccount,
        );

        require_keys_neq!(
            self.program_id,
            Pubkey::default(),
            DispatcherError::InvalidAccount,
        );

        Ok(())
    }
}
