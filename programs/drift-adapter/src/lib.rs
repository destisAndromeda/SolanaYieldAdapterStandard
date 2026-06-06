pub mod event;
pub mod error;
pub mod constants;
pub mod instructions;

use anchor_lang::prelude::*;

pub use event::*;
pub use constants::*;
pub use instructions::*;

declare_id!("EojJcwUUuTuHyTJDyFjUjSxHbZLBuqJt7KPpBR6rVKZb");

#[program]
pub mod marginfi_adapter {
    use super::*;

    /// Routes a USDC deposit to the appropriate Drift instruction via CPI.
    ///
    /// The first byte of `extra_data` selects the target instruction:
    /// - `0` — `deposit` (extra_data[1..3] = market_index: u16, extra_data[3] = reduce_only: bool)
    ///
    /// All protocol accounts are passed through `remaining_accounts`.
    pub fn adapter_deposit(
        ctx: Context<AdapterDeposit>,
        args: AdapterDepositArgs,
    ) -> Result<()> {
        AdapterDeposit::adapter_deposit(ctx, args)
    }

    /// Routes a USDC withdrawal from the appropriate Drift instruction via CPI.
    ///
    /// The first byte of `extra_data` selects the target instruction:
    /// - `0` — `withdraw` (extra_data[1..3] = market_index: u16, extra_data[3] = reduce_only: bool)
    ///
    /// All protocol accounts are passed through `remaining_accounts`.
    pub fn adapter_withdraw(
        ctx: Context<AdapterWithdraw>,
        args: AdapterWithdrawArgs,
    ) -> Result<()> {
        AdapterWithdraw::adapter_withdraw(ctx, args)
    }

    /// Returns the current USDC spot balance from the user's Drift account.
    ///
    /// Reads `User.spot_positions[0].scaled_balance` directly via zero-copy
    /// deserialization and emits an `AdapterCurrentValueEvent`.
    /// Can be simulated off-chain at no cost via `simulateTransaction`.
    ///
    /// `remaining_accounts[0]` — Drift User account.
    pub fn adapter_current_value(
        ctx: Context<AdapterCurrentValue>,
    ) -> Result<()> {
        AdapterCurrentValue::adapter_current_value(ctx)
    }
}
