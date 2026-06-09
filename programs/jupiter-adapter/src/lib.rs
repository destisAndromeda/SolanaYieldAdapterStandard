pub mod constants;
pub mod error;
pub mod event;
pub mod instructions;

use anchor_lang::prelude::*;

pub use constants::*;
pub use event::*;
pub use instructions::*;

declare_id!("CqNUZykVkiQsGTW8rQRSm4cm2DtXgMCmNRvWfgHV9nB2");

#[program]
pub mod jupiter_adapter {
    use super::*;

    /// Routes a USDC deposit into Jupiter LP via CPI.
    ///
    /// The first byte of `extra_data` selects the target instruction:
    /// - `0` — `depositCollateralForBorrows`
    /// - `1` — `addLiquidity2` (remaining bytes are forwarded as CPI args)
    ///
    /// All protocol accounts are passed through `remaining_accounts`.
    pub fn adapter_deposit(ctx: Context<AdapterDeposit>, args: AdapterDepositArgs) -> Result<()> {
        AdapterDeposit::adapter_deposit(ctx, args)
    }

    /// Routes a USDC withdrawal from Jupiter LP via CPI.
    ///
    /// The first byte of `extra_data` selects the target instruction:
    /// - `0` — `withdrawCollateralForBorrows`
    /// - `1` — `removeLiquidity` (remaining bytes are forwarded as CPI args)
    ///
    /// All protocol accounts are passed through `remaining_accounts`.
    pub fn adapter_withdraw(
        ctx: Context<AdapterWithdraw>,
        args: AdapterWithdrawArgs,
    ) -> Result<()> {
        AdapterWithdraw::adapter_withdraw(ctx, args)
    }

    /// Returns the raw locked collateral amount from a Jupiter BorrowPosition account.
    ///
    /// Reads the `BorrowPosition` account data directly and returns the
    /// `locked_collateral` field as a raw `u64`.
    /// This value is protocol-native and may not be denominated in supported-mint units.
    ///
    /// `remaining_accounts[0]` — Jupiter BorrowPosition account.
    pub fn adapter_current_value(ctx: Context<AdapterCurrentValue>) -> Result<()> {
        AdapterCurrentValue::adapter_current_value(ctx)
    }
}
