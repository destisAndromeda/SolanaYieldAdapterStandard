use anchor_lang::prelude::*;
use crate::event::*;
use crate::error::*;
use crate::state::*;
use crate::constants::*;

#[derive(Accounts)]
pub struct ToggleAdapter<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        has_one = authority @
            DispatcherError::Unauthorized,
        seeds = [
            SEED_PREFIX,
            adapter.program_id.as_ref(),
            SEED_ADAPTER,
            adapter.authority.as_ref(),
        ],
        bump  = adapter.bump,
    )]
    pub adapter: Account<'info, Adapter>,
}

impl ToggleAdapter<'_> {
    pub fn toggle_adapter(ctx: Context<ToggleAdapter>) -> Result<()> {
        ctx.accounts.adapter.is_active =
            !ctx.accounts.adapter.is_active;

        emit!( ToggleEvent {
            authority: ctx.accounts.authority.key(),
            adapter: ctx.accounts.adapter.key(),
            program_id: ctx.accounts.adapter.program_id,
            is_active: ctx.accounts.adapter.is_active,
        });

        Ok(())
    }
}