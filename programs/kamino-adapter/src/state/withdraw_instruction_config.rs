use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct WithdrawInstructionConfig {
    pub authority: Pubkey,

    pub lending_market: Pubkey,
    pub lending_market_authority: Pubkey,
    pub withdraw_reserve: Pubkey,
    pub reserve_liquidity_mint: Pubkey,
    pub reserve_source_collateral: Pubkey,
    pub reserve_collateral_mint: Pubkey,
    pub reserve_liquidity_supply: Pubkey,

    /// Program id for the Kamino program to CPI into
    pub kamino_program_id: Pubkey,

    pub bump: u8,
}
