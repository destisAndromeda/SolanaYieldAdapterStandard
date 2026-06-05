use anchor_lang::prelude::*;
use crate::error::*;

#[account]
#[derive(InitSpace)]
pub struct Registry {
    /// Authority that can update account state
    pub authority: Pubkey,

    /// For subsidiary PDA seeds
    pub creator_key: Pubkey,

    /// Index for adapters PDA seeds
    pub adapter_index: u64,

    /// Bump for ProgramConfig PDA seeds
    pub bump: u8,
}

impl Registry {
    pub fn invariant(&self) -> Result<()> {
        require_keys_neq!(
            self.authority,
            Pubkey::default(),
            DispatcherError::InvalidAccount,
        );

        require_keys_neq!(
            self.creator_key,
            Pubkey::default(),
            DispatcherError::InvalidAccount,
        );

        require_keys_neq!(
            self.authority,
            self.creator_key,
            DispatcherError::InvalidAccount,
        );
        
        Ok(())
    }
}