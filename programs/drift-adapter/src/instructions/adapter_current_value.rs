use crate::constants::*;
use crate::event::*;
use anchor_lang::prelude::*;
use yield_adapter_interface::{define_account_offsets, layout::read_u64_le, set_return_u64};

define_account_offsets! {
    drift_user {
        SPOT_0_SCALED_BALANCE: yield_adapter_interface::account_offset!(8, 32, 32, 32),
    }
}

#[derive(Accounts)]
pub struct AdapterCurrentValue<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
}

impl AdapterCurrentValue<'_> {
    pub fn adapter_current_value(ctx: Context<AdapterCurrentValue>) -> Result<()> {
        let account_info = &ctx.remaining_accounts[0];
        let data = account_info.try_borrow_data()?;

        // remaining_accounts[0] is a Drift User account.
        // Reading User.spot_positions[0].scaled_balance from raw account data.
        // This is a protocol-native scaled balance, not a supported-mint amount.
        let scaled_balance = read_u64_le(&data, drift_user::SPOT_0_SCALED_BALANCE)?;

        set_return_u64(scaled_balance);

        emit!(AdapterCurrentValueEvent {
            authority: ctx.accounts.authority.key(),
            program_id: PROGRAM_ID,
            current_value: scaled_balance,
        });

        Ok(())
    }
}
