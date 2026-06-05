use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct DepositInstructionConfig {
    pub authority: Pubkey,

    pub lending_market: Pubkey,
    pub lending_market_authority: Pubkey,
    pub reserve: Pubkey,
    pub reserve_liquidity_mint: Pubkey,
    pub reserve_liquidity_supply: Pubkey,
    pub reserve_collateral_mint: Pubkey,
    pub reserve_destination_deposit_collateral: Pubkey,
    
    pub bump: u8,
}