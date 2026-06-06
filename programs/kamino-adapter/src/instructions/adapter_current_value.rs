use anchor_lang::prelude::*;
use bytemuck::from_bytes;
use klend_interface::state::Reserve;

use crate::event::*;
use crate::constants::*;

#[derive(Accounts)]
pub struct AdapterCurrentValue<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
}

impl AdapterCurrentValue<'_> { 
    pub fn adapter_current_value(ctx: Context<AdapterCurrentValue>) -> Result<()> {
        let reserve_info = &ctx.remaining_accounts[0];
        let data = reserve_info.try_borrow_data()?;

        // Skip 8-byte Anchor discriminator
        let reserve: &Reserve = from_bytes(&data[8..]);

        emit!( AdapterCurrentValueEvent {
            authority: ctx.accounts.authority.key(),
            program_id: PROGRAM_ID,
            current_value: reserve.available_liquidity(),
        });

        Ok(())
    }
}