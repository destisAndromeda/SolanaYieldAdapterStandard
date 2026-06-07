use crate::error::*;
use anchor_lang::prelude::*;
use yield_adapter_interface::AdapterStatus;

#[account]
#[derive(InitSpace)]
pub struct Adapter {
    /// Authority that can manage this adapter entry
    pub authority: Pubkey,

    /// Program id for the adapter
    pub program_id: Pubkey,

    /// Mint supported by this adapter entry
    pub supported_mint: Pubkey,

    /// Adapter status encoded as AdapterStatus
    pub status: u8,

    /// Unix timestamp when the adapter was registered
    pub registered_at: i64,

    /// PDA bump
    pub bump: u8,
}

impl Adapter {
    pub fn status(&self) -> Result<AdapterStatus> {
        AdapterStatus::from_u8(self.status).ok_or(error!(DispatcherError::InvalidStatus))
    }

    pub fn is_active(&self) -> Result<bool> {
        Ok(self.status()?.is_active())
    }

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

        require_keys_neq!(
            self.supported_mint,
            Pubkey::default(),
            DispatcherError::InvalidAccount,
        );

        require!(
            AdapterStatus::from_u8(self.status).is_some(),
            DispatcherError::InvalidStatus,
        );

        Ok(())
    }
}
