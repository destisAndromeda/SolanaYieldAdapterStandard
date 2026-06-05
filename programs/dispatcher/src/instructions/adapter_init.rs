use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AdapterInitArgs {
    /// Adapter program id that will receive CPI requests.
    pub program_id: Pubkey,

    /// Enable to use Adapter account if true
    pub is_active: bool,
}

#[derive(Accounts)]
pub struct AdapterInit<'info> {
    /// Registry authority allowed to register adapters.
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Adapter::INIT_SPACE,
        seeds = [
            SEED_PREFIX,
            registry.creator_key.as_ref(),
            SEED_ADAPTER_INFO,
            &registry.adapter_index.to_le_bytes(),
        ],
        bump,
    )]
    pub adapter_info: Account<'info, Adapter>,

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

impl AdapterInit<'_> {
    pub fn adapter_info_init(
        ctx: Context<Self>,
        args: AdapterInitArgs,
    ) -> Result<()> {
        let authority = ctx.accounts.authority.key();
        let program_id = args.program_id;
        let is_active = args.is_active;
        let bump = ctx.bumps.adapter_info;

        ctx.accounts.adapter_info.set_inner(Adapter {
            authority,
            program_id,
            is_active,
            bump,
        });

        ctx.accounts.registry.adapter_index =
            ctx.accounts.registry.adapter_index.checked_add(1)
                .ok_or(error!(DispatcherError::Overflow))?;

        ctx.accounts.adapter_info.invariant()?;

        Ok(())
    }
}
