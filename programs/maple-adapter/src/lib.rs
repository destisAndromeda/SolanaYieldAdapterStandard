pub mod constants;
pub mod error;
pub mod event;
pub mod instructions;

use anchor_lang::prelude::*;

pub use constants::*;
pub use event::*;
pub use instructions::*;

declare_id!("7A1CFrXTEw96vdtsYPG1h5vhXbFCszaipfavL1XhgQKL");

#[program]
pub mod marginfi_adapter {
    use super::*;

    pub fn adapter_deposit(ctx: Context<AdapterDeposit>, args: AdapterDepositArgs) -> Result<()> {
        AdapterDeposit::adapter_deposit(ctx, args)
    }

    pub fn adapter_withdraw(
        ctx: Context<AdapterWithdraw>,
        args: AdapterWithdrawArgs,
    ) -> Result<()> {
        AdapterWithdraw::adapter_withdraw(ctx, args)
    }

    pub fn adapter_current_value(ctx: Context<AdapterCurrentValue>) -> Result<()> {
        AdapterCurrentValue::adapter_current_value(ctx)
    }
}
