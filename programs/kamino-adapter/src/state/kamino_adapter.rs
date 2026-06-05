use anchor_lang::prelude::*;
use crate::error::*;

#[account]
#[derive(InitSpace)]
pub struct KaminoAdapter {
    /// Authority that can update creator_key
    pub authority: Pubkey,

    /// Key for InstructionConfig PDA seeds
    pub creator_key: Pubkey,

    /// Index for InstructionConfig PDA seeds
    pub instruction_index: u64,

    /// Bump for KaminoAdapter PDA seeds
    pub bump: u8,
}

impl KaminoAdapter {
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