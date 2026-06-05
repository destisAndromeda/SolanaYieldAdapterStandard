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

    pub fn adapter_config_init(
        ctx: Context<AdapterConfigInit>,
        args: AdapterConfigInitArgs,
    ) -> Result<()> {
        AdapterConfigInit::
            adapter_config_init(ctx, args)
    }

    pub fn kamino_adapter_init(
        ctx: Context<KaminoAdapterInit>,
        args: KaminoAdapterInitArgs,
    ) -> Result<()> {
        KaminoAdapterInit::
            kamino_adapter_init(ctx, args)
    }
}
