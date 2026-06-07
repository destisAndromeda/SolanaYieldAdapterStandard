use anchor_lang::prelude::*;
use yield_adapter_interface::set_return_u64;

pub const MOCK_CURRENT_VALUE: u64 = 123_456_789;

declare_id!("3ChHEmV3NhvmtzLXPDY62aJizN4tiBGapzpmUKwxj6cV");

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AdapterDepositArgs {
    pub amount: u64,
    pub extra_data: Vec<u8>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AdapterWithdrawArgs {
    pub amount: u64,
    pub extra_data: Vec<u8>,
}

#[event]
pub struct MockDepositCalled {
    pub authority: Pubkey,
    pub amount: u64,
    pub extra_data: Vec<u8>,
}

#[event]
pub struct MockWithdrawCalled {
    pub authority: Pubkey,
    pub amount: u64,
    pub extra_data: Vec<u8>,
}

#[event]
pub struct MockCurrentValueCalled {
    pub authority: Pubkey,
    pub value: u64,
}

#[program]
pub mod mock_adapter {
    use super::*;

    pub fn adapter_deposit(ctx: Context<AdapterDeposit>, args: AdapterDepositArgs) -> Result<()> {
        emit!(MockDepositCalled {
            authority: ctx.accounts.authority.key(),
            amount: args.amount,
            extra_data: args.extra_data.clone(),
        });
        Ok(())
    }

    pub fn adapter_withdraw(ctx: Context<AdapterWithdraw>, args: AdapterWithdrawArgs) -> Result<()> {
        emit!(MockWithdrawCalled {
            authority: ctx.accounts.authority.key(),
            amount: args.amount,
            extra_data: args.extra_data.clone(),
        });
        Ok(())
    }

    pub fn adapter_current_value(ctx: Context<AdapterCurrentValue>) -> Result<()> {
        emit!(MockCurrentValueCalled {
            authority: ctx.accounts.authority.key(),
            value: MOCK_CURRENT_VALUE,
        });
        set_return_u64(MOCK_CURRENT_VALUE);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct AdapterDeposit<'info> {
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct AdapterWithdraw<'info> {
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct AdapterCurrentValue<'info> {
    pub authority: Signer<'info>,
}
