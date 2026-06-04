use anchor_lang::prelude::*;

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
