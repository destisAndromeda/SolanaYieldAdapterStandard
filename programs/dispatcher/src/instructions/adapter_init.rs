use anchor_lang::prelude::*;

use crate::error::*;
use crate::state::*;
use crate::constants::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AdapterInitArgs {
    /// Authority that can update account state
    pub authority: Pubkey,

    /// Adapter program id that will receive CPI requests.
    pub program_id: Pubkey,

    /// Enable to use Adapter account if true
    pub is_active: bool,
}

#[derive(Accounts)]
#[instruction(args: AdapterInitArgs)]
pub struct AdapterInit<'info> {
    /// Registry authority allowed to register adapters.
    #[account(mut)]
    pub initializer: Signer<'info>,

    #[account(
        init,
        payer = initializer,
        space = 8 + Adapter::INIT_SPACE,
        seeds = [
            SEED_PREFIX,
            args.program_id.as_ref(),
            SEED_ADAPTER,
            args.authority.as_ref(),
        ],
        bump,
    )]
    pub adapter: Account<'info, Adapter>,

    #[account(
        has_one = initializer
            @ DispatcherError::Unauthorized,
        seeds = [
            SEED_PREFIX,
            SEED_REGISTRY,
        ],
        bump  = registry.bump,
    )]
    pub registry: Account<'info, Registry>,

    pub system_program: Program<'info, System>,
}

impl AdapterInit<'_> {
    pub fn adapter_init(
        ctx: Context<Self>,
        args: AdapterInitArgs,
    ) -> Result<()> {
        let authority = args.authority;
        let program_id = args.program_id;
        let is_active = args.is_active;
        let bump = ctx.bumps.adapter;

        ctx.accounts.adapter.set_inner(Adapter {
            authority,
            program_id,
            is_active,
            bump,
        });

        ctx.accounts.adapter.invariant()?;

        Ok(())
    }
}
