use crate::constants::*;
use crate::event::*;
use anchor_lang::prelude::*;
use yield_adapter_interface::set_return_u64;

#[derive(Accounts)]
pub struct AdapterCurrentValue<'info> {
    pub authority: Signer<'info>,
}

impl AdapterCurrentValue<'_> {
    pub fn adapter_current_value(ctx: Context<AdapterCurrentValue>) -> Result<()> {
        let account_info = &ctx.remaining_accounts[0];
        let data = account_info.try_borrow_data()?;

        // BorrowPosition layout (after 8-byte discriminator):
        // owner(32) + pool(32) + custody(32) + open_time(8) + update_time(8)
        // + borrow_size(16) + cumulative_compounded_interest_snapshot(16) = 144
        // locked_collateral starts at offset 152
        let locked_collateral = u64::from_le_bytes(data[152..160].try_into().unwrap());

        set_return_u64(locked_collateral);

        emit!(AdapterCurrentValueEvent {
            authority: ctx.accounts.authority.key(),
            program_id: PROGRAM_ID,
            current_value: locked_collateral,
        });

        Ok(())
    }
}
