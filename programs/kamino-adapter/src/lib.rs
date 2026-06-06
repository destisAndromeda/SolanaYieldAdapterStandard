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
}
