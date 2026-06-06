pub mod emit;
pub mod state;
pub mod error;
pub mod constants;
pub mod instructions;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;
pub use emit::*;

declare_id!("2mYCSzV1J6XKZmd8n1NWcr2NuRYqVtP6tFC7YWPj6ZXU");

#[program]
pub mod dispatcher {
    use super::*;

    /// Initializes the adapter registry account.
    ///
    /// Can only be called by the `creator_key` stored in `Dispatcher`.
    /// The registry governs which adapters are approved for use
    /// and controls who can register new adapters.
    pub fn registry_init(
        ctx: Context<RegistryInit>,
        args: RegistryInitArgs,
    ) -> Result<()> {
        RegistryInit::registry_init(ctx, args)
    }

    /// Registers a new adapter in the dispatcher registry.
    pub fn adapter_info_init(
        ctx: Context<AdapterInit>,
        args: AdapterInitArgs,
    ) -> Result<()> {
        AdapterInit::adapter_info_init(ctx, args)
    }
    
    // Routes a USDC deposit to the specified adapter via CPI.
    ///
    /// Validates that the adapter is active, then forwards the call
    /// to the adapter program using the standardized `adapter_deposit`
    /// discriminator. All protocol-specific accounts are passed
    /// through `remaining_accounts`.
    pub fn deposit(
        ctx: Context<Deposit>,
        args: DepositArgs,
    ) -> Result<()> {
        Deposit::deposit(ctx, args)
    }
    
    /// Routes a USDC withdrawal from the specified adapter via CPI.
    ///
    /// Validates that the adapter is active, then forwards the call
    /// to the adapter program using the standardized `adapter_withdraw`
    /// discriminator. All protocol-specific accounts are passed
    /// through `remaining_accounts`.
    pub fn withdraw(
        ctx: Context<Withdraw>,
        args: WithdrawArgs,
    ) -> Result<()> {
        Withdraw::withdraw(ctx, args)
    }

    /// Queries the current value of a user's position in the specified adapter.
    ///
    /// Returns the total USDC value including accrued interest via `msg!`.
    /// This instruction can be simulated off-chain at no cost using
    /// `simulateTransaction` to read the current position without paying fees.
    pub fn current_value(
        ctx: Context<CurrentValue>,
        args: CurrentValueArgs,
    ) -> Result<()> {
        CurrentValue::current_value(ctx, args)
    }
}
