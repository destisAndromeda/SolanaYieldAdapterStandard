pub mod emit;
pub mod error;
pub mod state;
pub mod constants;
pub mod instructions;

use anchor_lang::prelude::*;

pub use emit::*;
pub use state::*;
pub use constants::*;
pub use instructions::*;

declare_id!("BaxHrSyiFkoS4on2HmmEBCAL7BwMfXnZarpHNx6V3GrT");

#[program]
pub mod kamino_adapter {
    use super::*;

    /// Routes a deposit to the appropriate Kamino instruction via CPI.
    ///
    /// The first byte of `extra_data` selects the target instruction:
    /// - `0` — `deposit_reserve_liquidity_and_obligation_collateral_v2`
    /// - `1` — `deposit_reserve_liquidity`
    /// - `2` — `deposit_obligation_collateral_v2`
    /// - `3` — `deposit_and_withdraw` (remaining `extra_data` bytes are forwarded as args)
    ///
    /// All protocol accounts are passed through `remaining_accounts`.
    pub fn adapter_deposit(
        ctx: Context<AdapterDeposit>,
        args: AdapterDepositArgs,
    ) -> Result<()> {
        AdapterDeposit::adapter_deposit(ctx, args)
    }

    /// Routes a withdrawal to the appropriate Kamino instruction via CPI.
    ///
    /// The first byte of `extra_data` selects the target instruction:
    /// - `0` — `withdraw_obligation_collateral_and_redeem_reserve_collateral_v2`
    /// - `1` — `redeem_reserve_collateral`
    /// - `2` — `deposit_and_withdraw` (remaining `extra_data` bytes are forwarded as args)
    ///
    /// All protocol accounts are passed through `remaining_accounts`.
    pub fn adapter_withdraw(
        ctx: Context<AdapterWithdraw>,
        args: AdapterWithdrawArgs,
    ) -> Result<()> {
        AdapterWithdraw::adapter_withdraw(ctx, args)
    }

    /// Returns the current available liquidity of the Kamino USDC reserve.
    ///
    /// Reads the `Reserve` account directly via zero-copy deserialization
    /// and logs the result via `msg!`. Can be called via `simulateTransaction`
    /// off-chain at no cost to query the current value without paying fees.
    ///
    /// `remaining_accounts[0]` — Kamino Reserve account.
    pub fn adapter_current_value(ctx: Context<AdapterCurrentValue>) -> Result<()> {
        AdapterCurrentValue::adapter_current_value(ctx)
    }
}
