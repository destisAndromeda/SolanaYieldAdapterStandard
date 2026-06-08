use crate::constants::*;
use crate::error::*;
use crate::state::*;
use anchor_lang::prelude::*;

#[cfg(not(feature = "testing"))]
pub const INITIALIZER: Pubkey = pubkey!("GAe1b8H1eUQhGuwAEJKstXLFdpaoHp9voszu1uw46Htm");

#[cfg(feature = "testing")]
pub const INITIALIZER: Pubkey = pubkey!("GAe1b8H1eUQhGuwAEJKstXLFdpaoHp9voszu1uw46Htm");

#[derive(Accounts)]
pub struct RegistryInit<'info> {
    /// Key from Dispatcher
    #[account(
        mut,
        address = INITIALIZER @
            DispatcherError::Unauthorized,
    )]
    pub initializer: Signer<'info>,

    #[account(
        init,
        payer = initializer,
        space = 8 + Registry::INIT_SPACE,
        seeds = [
            SEED_PREFIX,
            SEED_REGISTRY,
        ],
        bump,
    )]
    pub registry: Account<'info, Registry>,

    pub system_program: Program<'info, System>,
}

impl RegistryInit<'_> {
    /// A one-time instruction that initializes the global registry
    pub fn registry_init(ctx: Context<Self>) -> Result<()> {
        let initializer = ctx.accounts.initializer.key();
        let bump = ctx.bumps.registry;

        ctx.accounts
            .registry
            .set_inner(Registry { initializer, bump });

        ctx.accounts.registry.invariant()?;

        Ok(())
    }
}
