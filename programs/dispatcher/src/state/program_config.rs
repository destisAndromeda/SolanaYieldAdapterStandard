use anchor_lang::prelude::*;
use crate::error::*;

#[account]
#[derive(InitSpace)]
pub struct ProgramConfig {
    /// Owner of the platform; May be multisig wallet
    pub owner: Pubkey,

    /// For subsidiary PDA seeds
    pub creator_key: Pubkey,

    /// Transaction fee in lamports
    /// pub transaction_fee: u64,
    
    /// Treasury for transactions fee
    /// pub treasury: Pubkey

    /// For future fields
    pub _reserved: [u8; 64],

    /// Bump for ProgramConfig PDA seeds
    pub bump: u8,
}

impl ProgramConfig {
    pub fn invariant(&self) -> Result<()> {
        require_keys_neq!(
            self.owner,
            Pubkey::default(),
            DispatcherError::InvalidAccount,
        );

        require_keys_neq!(
            self.creator_key,
            Pubkey::default(),
            DispatcherError::InvalidAccount,
        );
        
        require_keys_neq!(
            self.owner,
            self.creator_key,
            DispatcherError::InvalidAccount,
        );

        Ok(())
    }
}