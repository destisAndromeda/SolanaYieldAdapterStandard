use anchor_lang::prelude::*;
use crate::event::*;
use crate::constants::*;

#[derive(Accounts)]
pub struct AdapterCurrentValue<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
}

impl AdapterCurrentValue<'_> { 
pub fn adapter_current_value(ctx: Context<AdapterCurrentValue>) -> Result<()> {
    let account_info = &ctx.remaining_accounts[0];
    let data = account_info.try_borrow_data()?;

    // User.spot_positions[0].scaled_balance
    // offset: 8 (disc) + 32 + 32 + 32 (name) = 104
    let scaled_balance = u64::from_le_bytes(
        data[104..112].try_into().unwrap()
    );

    emit!( AdapterCurrentValueEvent {
        authority: ctx.accounts.authority.key(),
        program_id: PROGRAM_ID,
        current_value: scaled_balance,
    });

    Ok(())
}
}