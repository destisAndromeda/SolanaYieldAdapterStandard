use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::*;
use crate::constants::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct WithdrawInstructionConfigInitArgs {
    pub lending_market: Pubkey,
    pub lending_market_authority: Pubkey,
    pub withdraw_reserve: Pubkey,
    pub reserve_liquidity_mint: Pubkey,
    pub reserve_source_collateral: Pubkey,
    pub reserve_collateral_mint: Pubkey,
    pub reserve_liquidity_supply: Pubkey,
    pub kamino_program_id: Pubkey,
}

#[derive(Accounts)]
pub struct WithdrawInstructionConfigInit<'info> {
    #[account(mut)]
    pub creator_key: Signer<'info>,

    #[account(
        init,
        payer = creator_key,
        space = 8 + WithdrawInstructionConfig::INIT_SPACE,
        seeds = [
            SEED_PREFIX,
            kamino_adapter.key().as_ref(),
            SEED_INSTRUCTION_CONFIG,
            creator_key.key().as_ref(),
        ],
        bump,
    )]
    pub withdraw_instruction_config: Account<'info, WithdrawInstructionConfig>,

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

impl WithdrawInstructionConfigInit<'_> {
    pub fn withdraw_instruction_config_init(
        ctx: Context<Self>,
        args: WithdrawInstructionConfigInitArgs,
    ) -> Result<()> {
        let authority = ctx.accounts.creator_key.key();

        let lending_market = args.lending_market;
        let lending_market_authority = args.lending_market_authority;
        let withdraw_reserve = args.withdraw_reserve;
        let reserve_liquidity_mint = args.reserve_liquidity_mint;
        let reserve_source_collateral = args.reserve_source_collateral;
        let reserve_collateral_mint = args.reserve_collateral_mint;
        let reserve_liquidity_supply = args.reserve_liquidity_supply;
        let kamino_program_id = args.kamino_program_id;

        let bump = ctx.bumps.withdraw_instruction_config;

        ctx.accounts.withdraw_instruction_config.set_inner(WithdrawInstructionConfig {
            authority,
            lending_market,
            lending_market_authority,
            withdraw_reserve,
            reserve_liquidity_mint,
            reserve_source_collateral,
            reserve_collateral_mint,
            reserve_liquidity_supply,
            kamino_program_id,
            bump,
        });

        Ok(())
    }
}
