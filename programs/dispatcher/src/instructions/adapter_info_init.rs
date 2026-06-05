use anchor_lang::prelude::*;
use spl_token::solana_program::vote::authorized_voters;

use crate::constants::*;
use crate::error::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AdapterInfoInitArgs {
    /// Adapter program id that will receive CPI requests.
    pub program_id: Pubkey,
}

#[derive(Accounts)]
pub struct AdapterInfoInit<'info> {
    /// Registry authority allowed to register adapters.
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + AdapterInfo::INIT_SPACE,
        seeds = [
            SEED_PREFIX,
            registry.creator_key.as_ref(),
            SEED_ADAPTER_INFO,
            &registry.adapter_index.to_le_bytes(),
        ],
        bump,
    )]
    pub adapter_info: Account<'info, AdapterInfo>,

    #[account(
        seeds = [
            SEED_PREFIX,
            SEED_REGISTRY,
        ],
        bump = registry.bump,
    )]
    pub registry: Account<'info, Registry>,

    pub system_program: Program<'info, System>,
}

impl AdapterInfoInit<'_> {
    pub fn adapter_info_init(
        ctx: Context<Self>,
        args: AdapterInfoInitArgs,
    ) -> Result<()> {
        let authority = ctx.accounts.authority.key();
        let program_id = args.program_id;
        let bump = ctx.bumps.adapter_info;

        ctx.accounts.adapter_info.set_inner(AdapterInfo {
            authority,
            program_id,
            bump,
        });


        ctx.accounts.registry.adapter_index =
            ctx.accounts.registry.adapter_index.checked_add(1)
                .ok_or(error!(DispatcherError::Overflow))?;

        ctx.accounts.adapter_info.invariant()?;

        Ok(())
    }
}
