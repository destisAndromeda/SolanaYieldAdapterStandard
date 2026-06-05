use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::*;
use crate::constants::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DepositInstructionConfigInitArgs {
    pub lending_market: Pubkey,
    pub lending_market_authority: Pubkey,
    pub reserve: Pubkey,
    pub reserve_liquidity_mint: Pubkey,
    pub reserve_liquidity_supply: Pubkey,
    pub reserve_collateral_mint: Pubkey,
    pub reserve_destination_deposit_collateral: Pubkey,
}

#[derive(Accounts)]
pub struct DepositInstructionConfigInit<'info> {
    #[account(mut)]
    pub creator_key: Signer<'info>, 

    #[account(
        init,
        payer = creator_key,
        space = 8 + DepositInstructionConfig::INIT_SPACE,
        seeds = [
            SEED_PREFIX,
            kamino_adapter.key().as_ref(),
            SEED_INSTRUCTION_CONFIG,
            creator_key.key().as_ref(),
        ],
        bump,
    )]
    pub deposit_instruction_config: Account<'info, DepositInstructionConfig>,

    #[account(
        has_one = creator_key @
            AdapterError::Unauthorized,
        seeds = [
            SEED_PREFIX,
            adapter_config.key().as_ref(),
            SEED_KAMINO_ADAPTER,
            adapter_config.creator_key.as_ref(),
        ],
        bump = kamino_adapter.bump,
    )]
    pub kamino_adapter: Account<'info, KaminoAdapter>,

    #[account(
        seeds = [
            SEED_PREFIX,
            SEED_ADAPTER_CONFIG,
        ],
        bump = adapter_config.bump,
    )]
    pub adapter_config: Account<'info, AdapterConfig>,

    pub system_program: Program<'info, System>,
}

impl DepositInstructionConfigInit<'_> {
    pub fn deposit_instruction_config_init(
        ctx: Context<Self>,
        args: DepositInstructionConfigInitArgs,
    ) -> Result<()> {
        let authority = ctx.accounts.creator_key.key();

        let lending_market = args.lending_market;
        let lending_market_authority = args.lending_market_authority;
        let reserve = args.reserve;
        let reserve_liquidity_mint = args.reserve_liquidity_mint;
        let reserve_liquidity_supply = args.reserve_liquidity_supply;
        let reserve_collateral_mint = args.reserve_collateral_mint;
        let reserve_destination_deposit_collateral = args.reserve_destination_deposit_collateral;
        
        let bump = ctx.bumps.deposit_instruction_config;

        ctx.accounts.deposit_instruction_config.set_inner( DepositInstructionConfig {
            authority,
            lending_market,
            lending_market_authority,
            reserve,
            reserve_liquidity_mint,
            reserve_liquidity_supply,
            reserve_collateral_mint,
            reserve_destination_deposit_collateral,
            bump,
        });
        Ok(())
    }
}