use anchor_lang::prelude::*;

use crate::state::*;
use crate::error::*;
use crate::constants::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RegistryInitArgs {
    /// Key that can init subsidiary accounts
    pub creator_key: Pubkey,
}

#[derive(Accounts)]
pub struct RegistryInit<'info> {
    /// Key from Dispatcher
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Registry account should may constant seeds
    #[account(
        init,
        payer = authority,
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
    pub fn registry_init(
        ctx: Context<Self>,
        args: RegistryInitArgs,
    ) -> Result<()> {
        let authority   = ctx.accounts.authority.key();
        let creator_key = args.creator_key;
        let adapter_index = 0;
        let bump = ctx.bumps.registry;

        ctx.accounts.registry.set_inner( Registry {
            authority,
            creator_key,
            adapter_index,
            bump,
        });

        ctx.accounts.registry.invariant()?;

        Ok(())
    }
}