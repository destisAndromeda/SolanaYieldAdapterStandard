pub mod event;
pub mod state;
pub mod error;
pub mod constants;
pub mod instructions;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;
pub use event::*;

declare_id!("2mYCSzV1J6XKZmd8n1NWcr2NuRYqVtP6tFC7YWPj6ZXU");

#[program]
pub mod dispatcher {
    use super::*;

    /// Initializes the global adapter registry.
    ///
    /// This is a one-time setup instruction that creates the `Registry`
    /// PDA and records the single authorized registry initializer.
    /// Only the pre-configured `INITIALIZER` key can execute this call.
    pub fn registry_init(ctx: Context<RegistryInit>) -> Result<()> {
        RegistryInit::registry_init(ctx)
    }

    /// Registers a new adapter in the dispatcher registry.
    pub fn adapter_init(
        ctx: Context<AdapterInit>,
        args: AdapterInitArgs,
    ) -> Result<()> {
        AdapterInit::adapter_init(ctx, args)
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
    pub fn current_value(ctx: Context<CurrentValue>) -> Result<()> {
        CurrentValue::current_value(ctx)
    }

    pub fn toggle_adapter(ctx: Context<ToggleAdapter>) -> Result<()> {
        ToggleAdapter::toggle_adapter(ctx)
    }
}
