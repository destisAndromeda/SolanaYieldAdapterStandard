pub mod constants;
pub mod error;
pub mod event;
pub mod instructions;

use anchor_lang::prelude::*;

pub use constants::*;
pub use event::*;
pub use instructions::*;

declare_id!("43vGkNHfLML24Df9xCJddmwsx1mbje34yVsH13bqnbny");

#[program]
pub mod marginfi_adapter {
    use super::*;

    /// Routes a USDC deposit to the appropriate MarginFi instruction via CPI.
    ///
    /// The first byte of `extra_data` selects the target instruction:
    /// - `0` — `lending_account_deposit` (remaining `extra_data` bytes = Option<bool> deposit_up_to_limit)
    ///
    /// All protocol accounts are passed through `remaining_accounts`.
    pub fn adapter_deposit(ctx: Context<AdapterDeposit>, args: AdapterDepositArgs) -> Result<()> {
        AdapterDeposit::adapter_deposit(ctx, args)
    }

    /// Routes a USDC withdrawal from the appropriate MarginFi instruction via CPI.
    ///
    /// The first byte of `extra_data` selects the target instruction:
    /// - `0` — `lending_account_withdraw`
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
