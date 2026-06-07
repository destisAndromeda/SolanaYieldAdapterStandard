use crate::constants::*;
use crate::error::*;
use crate::event::*;
use crate::state::*;
use anchor_lang::prelude::*;
use yield_adapter_interface::AdapterStatus;

#[derive(Accounts)]
pub struct ToggleAdapter<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
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
        let next_status = match ctx.accounts.adapter.status()? {
            AdapterStatus::Active => AdapterStatus::Paused,
            AdapterStatus::Paused => AdapterStatus::Active,
            AdapterStatus::Deprecated => return err!(DispatcherError::Deprecated),
        };

        ctx.accounts.adapter.status = next_status.as_u8();

        emit!(ToggleEvent {
            authority: ctx.accounts.authority.key(),
            adapter: ctx.accounts.adapter.key(),
            program_id: ctx.accounts.adapter.program_id,
            status: ctx.accounts.adapter.status,
        });

        Ok(())
    }
}
