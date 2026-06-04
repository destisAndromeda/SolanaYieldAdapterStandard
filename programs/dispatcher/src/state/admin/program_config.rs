use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ProgramConfig {
    /// Owner of the platform; May be multisig wallet
    pub owner: Pubkey,

    /// For subsidiary PDA seeds
    pub creator_key: Pubkey,

    /// Transaction fee in lamports
    /// pub transaction_fee: u64,

    /// For future fields
    pub _reserved: [u8; 64],

    /// Bump for ProgramConfig PDA seeds
    pub bump: u8,
}