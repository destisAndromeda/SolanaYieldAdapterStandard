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
}
