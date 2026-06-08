use crate::constants::*;
use crate::event::*;
use anchor_lang::prelude::*;
use yield_adapter_interface::{define_account_offsets, layout::read_u64_le, set_return_u64};

define_account_offsets! {
    jupiter_borrow_position {
        LOCKED_COLLATERAL: yield_adapter_interface::account_offset!(8, 32, 32, 32, 8, 8, 16, 16),
    }
}

#[derive(Accounts)]
pub struct AdapterCurrentValue<'info> {
    pub authority: Signer<'info>,
}

impl AdapterCurrentValue<'_> {
    pub fn adapter_current_value(ctx: Context<AdapterCurrentValue>) -> Result<()> {
        let account_info = &ctx.remaining_accounts[0];
        let data = account_info.try_borrow_data()?;

        // remaining_accounts[0] is a BorrowPosition account.
        // Reading locked_collateral from raw account data.
        // The returned value is raw collateral amount, not a supported-mint valuation.
        let locked_collateral = read_u64_le(&data, jupiter_borrow_position::LOCKED_COLLATERAL)?;

        set_return_u64(locked_collateral);

        emit!(AdapterCurrentValueEvent {
            authority: ctx.accounts.authority.key(),
            program_id: PROGRAM_ID,
            current_value: locked_collateral,
        });

        Ok(())
    }
}
