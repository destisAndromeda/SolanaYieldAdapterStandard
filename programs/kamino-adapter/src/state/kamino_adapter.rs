use anchor_lang::prelude::*;

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