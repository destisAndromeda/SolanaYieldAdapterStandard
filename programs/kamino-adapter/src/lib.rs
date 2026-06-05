pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("BaxHrSyiFkoS4on2HmmEBCAL7BwMfXnZarpHNx6V3GrT");

#[program]
pub mod kamino_adapter {
    use super::*;

    /// Initializes the adapter configuration account.
    ///
    /// Acts as the root of the adapter hierarchy. Controls who can
    /// register new adapters under this configuration.
    pub fn adapter_config_init(
        ctx: Context<AdapterConfigInit>,
        args: AdapterConfigInitArgs,
    ) -> Result<()> {
        AdapterConfigInit::
            adapter_config_init(ctx, args)
    }

    /// Initializes a Kamino adapter account.
    ///
    /// Registers Kamino Finance as a yield protocol adapter under
    /// the adapter configuration.
    pub fn kamino_adapter_init(
        ctx: Context<KaminoAdapterInit>,
        args: KaminoAdapterInitArgs,
    ) -> Result<()> {
        KaminoAdapterInit::
            kamino_adapter_init(ctx, args)
    }

    /// Initializes the deposit instruction configuration for a Kamino adapter.
    ///
    /// Stores the fixed Kamino accounts required for deposit CPI calls,
    /// so users only need to pass their own accounts at deposit time.
    pub fn deposit_instruction_config_init(
        ctx: Context<DepositInstructionConfigInit>,
        args: DepositInstructionConfigInitArgs,
    ) -> Result<()> {
        DepositInstructionConfigInit::
            deposit_instruction_config_init(ctx, args)
    }
}
