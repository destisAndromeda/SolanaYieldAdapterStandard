use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::constants::*;
use crate::error::*;
use crate::event::*;
use yield_adapter_interface::set_return_u64;

#[derive(Accounts)]
pub struct AdapterCurrentValue<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
}

impl AdapterCurrentValue<'_> {
    fn validate(&self, ctx: &Context<Self>) -> Result<()> {
        require!(
            !ctx.remaining_accounts.is_empty(),
            AdapterError::InvalidAccount,
        );

        Ok(())
    }

    #[access_control(ctx.accounts.validate(&ctx))]
    pub fn adapter_current_value(ctx: Context<Self>) -> Result<()> {
        // remaining_accounts[0] must be user's syrupUSDC token account.
        let syrup_usdc_account_info = &ctx.remaining_accounts[0];

        let syrup_usdc_account = Account::<TokenAccount>::try_from(
            syrup_usdc_account_info,
        )?;

        let current_value = syrup_usdc_account.amount;

        set_return_u64(current_value);

        emit!(AdapterCurrentValueEvent {
            authority: ctx.accounts.authority.key(),
            program_id: PROGRAM_ID,
            current_value,
        });

        Ok(())
    }
}