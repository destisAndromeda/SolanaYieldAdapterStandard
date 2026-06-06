use anchor_lang::prelude::*;

use crate::constants::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AdapterInitArgs {
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
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + Adapter::INIT_SPACE,
        seeds = [
            SEED_PREFIX,
            args.program_id.as_ref(),
            SEED_ADAPTER,
            owner.key().as_ref(),
        ],
        bump,
    )]
    pub adapter_info: Account<'info, Adapter>,

    pub system_program: Program<'info, System>,
}

impl AdapterInit<'_> {
    pub fn adapter_init(
        ctx: Context<Self>,
        args: AdapterInitArgs,
    ) -> Result<()> {
        let authority = ctx.accounts.owner.key();
        let program_id = args.program_id;
        let is_active = args.is_active;
        let bump = ctx.bumps.adapter_info;

        ctx.accounts.adapter_info.set_inner(Adapter {
            authority,
            program_id,
            is_active,
            bump,
        });

        ctx.accounts.adapter_info.invariant()?;

        Ok(())
    }
}
