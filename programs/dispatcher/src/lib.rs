pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("2mYCSzV1J6XKZmd8n1NWcr2NuRYqVtP6tFC7YWPj6ZXU");

#[program]
pub mod dispatcher {
    use super::*;

    /// Initializes the program configuration account.
    /// 
    /// This is the root of the program hierarchy and can only be called
    /// by the hardcoded initializer address.
    pub fn program_config_init(
        ctx: Context<ProgramConfigInit>,
        args: ProgramConfigInitArgs,
    ) -> Result<()> {
        ProgramConfigInit::
            program_config_init(ctx, args)
    }

    /// Initializes the dispatcher account.
    ///
    /// Can only be called by the `creator_key` stored in `ProgramConfig`.
    /// The dispatcher acts as the routing layer between the standard interface
    /// and the underlying yield protocol adapters.
    pub fn dispatcher_init(
        ctx: Context<DispatcherInit>,
        args: DispatcherInitArgs,
    ) -> Result<()> {
        DispatcherInit::
            dispatcher_init(ctx, args)
    }

    /// Initializes the adapter registry account.
    ///
    /// Can only be called by the `creator_key` stored in `Dispatcher`.
    /// The registry governs which adapters are approved for use
    /// and controls who can register new adapters.
    pub fn registry_init(
        ctx: Context<RegistryInit>,
        args: RegistryInitArgs,
    ) -> Result<()> {
        RegistryInit::
            registry_init(ctx, args)
    }

    /// Registers a new adapter in the dispatcher registry.
    pub fn adapter_info_init(
        ctx: Context<AdapterInfoInit>,
        args: AdapterInfoInitArgs,
    ) -> Result<()> {
        AdapterInfoInit::
            adapter_info_init(ctx, args)
    }

    /// Deposits through the selected adapter.
    pub fn dispatcher_deposit(
        ctx: Context<DispatcherDeposit>,
        args: DispatcherDepositArgs,
    ) -> Result<()> {
        DispatcherDeposit::
            dispatcher_deposit(ctx, args)
    }
}
