use anchor_lang::prelude::*;
use crate::error::*;

#[account]
#[derive(InitSpace)]
pub struct AdapterConfig {
    /// Authority that can update creator_key
    pub authority: Pubkey,

    /// Creator key for Adapter PDA seeds
    pub creator_key: Pubkey,

    /// Bump for AdapterConfig PDA seeds
    pub bump: u8,
}

impl AdapterConfig {
    pub fn invariant(&self) -> Result<()> {
        require_keys_neq!(
            self.authority,
            Pubkey::default(),
            AdapterError::InvalidAccount,
        );

        require_keys_neq!(
            self.creator_key,
            Pubkey::default(),
            AdapterError::InvalidAccount,
        );
        
        require_keys_neq!(
            self.authority,
            self.creator_key,
            AdapterError::InvalidAccount,
        );

        Ok(())
    }
}