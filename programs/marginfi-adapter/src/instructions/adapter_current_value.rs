use crate::constants::*;
use crate::event::*;
use anchor_lang::prelude::*;
use yield_adapter_interface::set_return_u64;

#[derive(Accounts)]
pub struct AdapterCurrentValue<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
}

impl AdapterCurrentValue<'_> {
    pub fn adapter_current_value(ctx: Context<AdapterCurrentValue>) -> Result<()> {
        let account_info = &ctx.remaining_accounts[0];
        let data = account_info.try_borrow_data()?;

        // MarginfiAccount: 8 discriminator + skip to balances array
        // Balance struct starts with bank_pk (32 bytes), then asset_shares (16 bytes I80F48)
        // This returns raw asset_shares — actual token amount requires Bank exchange rate
        let offset = 8 + 32; // discriminator + bank_pk
        let asset_shares = u128::from_le_bytes(data[offset..offset + 16].try_into().unwrap());

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
