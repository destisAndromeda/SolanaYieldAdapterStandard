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
    ///
    /// All protocol accounts are passed through `remaining_accounts`.
    pub fn adapter_deposit(ctx: Context<AdapterDeposit>, args: AdapterDepositArgs) -> Result<()> {
        AdapterDeposit::adapter_deposit(ctx, args)
    }

    /// Routes a USDC withdrawal from Jupiter LP via CPI.
    ///
    /// The first byte of `extra_data` selects the target instruction:
    /// - `0` — `withdrawCollateralForBorrows`
    ///
    /// All protocol accounts are passed through `remaining_accounts`.
    pub fn adapter_withdraw(
        ctx: Context<AdapterWithdraw>,
        args: AdapterWithdrawArgs,
    ) -> Result<()> {
        AdapterWithdraw::adapter_withdraw(ctx, args)
    }

    /// Returns the current asset shares of the user's MarginFi position.
    ///
    /// Reads `MarginfiAccount` directly via zero-copy deserialization and logs
    /// raw `asset_shares`. For exact USDC amount, multiply by the exchange rate
    /// from the `Bank` account. Can be simulated off-chain at no cost.
    ///
    /// `remaining_accounts[0]` — MarginFi MarginfiAccount.
    pub fn adapter_current_value(ctx: Context<AdapterCurrentValue>) -> Result<()> {
        AdapterCurrentValue::adapter_current_value(ctx)
    }
}
