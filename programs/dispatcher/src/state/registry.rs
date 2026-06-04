use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Registry {
    /// Authority that can update account state
    pub authority: Pubkey,

    /// For subsidiary PDA seeds
    pub creator_key: Pubkey,

    /// Index for adapters PDA seeds
    pub adapters_index: u64,

    /// Bump for ProgramConfig PDA seeds
    pub bump: u8,
}