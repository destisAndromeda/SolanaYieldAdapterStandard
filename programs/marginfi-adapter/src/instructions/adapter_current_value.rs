use crate::constants::*;
use crate::event::*;
use anchor_lang::prelude::*;
use yield_adapter_interface::{define_account_offsets, layout::read_u128_le, set_return_u64};

define_account_offsets! {
    marginfi_account {
        ASSET_SHARES: yield_adapter_interface::account_offset!(8, 32),
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

        // remaining_accounts[0] is a Marginfi account.
        // Reading raw asset_shares from the balance struct.
        // This value is protocol-native I80F48 asset_shares, not a supported-mint amount.
        let asset_shares = read_u128_le(&data, marginfi_account::ASSET_SHARES)?;

        let current_value = asset_shares as u64;
        set_return_u64(current_value);

        emit!(AdapterCurrentValueEvent {
            authority: ctx.accounts.authority.key(),
            program_id: PROGRAM_ID,
            current_value,
        });

        Ok(())
    }
}
