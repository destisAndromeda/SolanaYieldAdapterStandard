use anchor_lang::prelude::*;

use crate::state::*;
use crate::error::*;
use crate::constants::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AdapterConfigInitArgs {
    /// Public key for updating account content
    pub authority: Pubkey,

    /// Public key for subidiary PDA seeds
    pub creator_key: Pubkey,
}

#[derive(Accounts)]
pub struct AdapterConfigInit<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + AdapterConfig::INIT_SPACE,
        seeds = [
            SEED_PREFIX,
            SEED_ADAPTER_CONFIG,
        ],
        bump,
    )]
    pub adapter_config: Account<'info, AdapterConfig>,

    pub system_program: Program<'info, System>,
}

impl AdapterConfigInit<'_> {
    pub fn adapter_config_init(
        ctx: Context<Self>,
        args: AdapterConfigInitArgs,
    ) -> Result<()> {

        Ok(())
    }
}