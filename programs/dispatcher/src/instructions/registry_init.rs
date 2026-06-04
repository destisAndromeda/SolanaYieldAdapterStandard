use anchor_lang::prelude::*;

use crate::state::*;
use crate::error::*;
use crate::constants::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RegistryInitArgs {
    /// Authority that can update Registry state
    pub authority: Pubkey,

    /// Key that can init subsidiary accounts
    pub creator_key: Pubkey,
}

#[derive(Accounts)]
pub struct RegistryInit<'info> {
    /// Key from Dispatcher
    #[account(mut)]
    pub creator_key: Signer<'info>,

    #[account(
        init,
        payer = creator_key,
        space = 8 + Registry::INIT_SPACE,
        seeds = [
            SEED_PREFIX,
            dispatcher.key().as_ref(),
            SEED_REGISTRY,
            creator_key.key().as_ref(),
        ],
        bump,
    )]
    pub registry: Account<'info, Registry>,

    /// Need only for Registry PDA seeds; not used for anything else
    #[account(
        seeds = [
            SEED_PREFIX,
            program_config.key().as_ref(),
            SEED_DISPATCHER,
            creator_key.key().as_ref(),
        ],
        bump = dispatcher.bump,
    )]
    pub dispatcher: Account<'info, Dispatcher>,

    /// Need only for Dispatcher PDA seeds; not used for anything else
    #[account(
        has_one = creator_key
            @ DispatcherError::Unauthorized,
        seeds = [
            SEED_PREFIX,
            SEED_PROGRAM_CONFIG,
        ],
        bump = program_config.bump,
    )]
    pub program_config: Account<'info, ProgramConfig>,

    pub system_program: Program<'info, System>,
}

impl RegistryInit<'_> {
    /// A one-time instruction that initializes the global registry
    pub fn registry_init(
        ctx: Context<Self>,
        args: RegistryInitArgs,
    ) -> Result<()> {
        let creator_key = args.creator_key;
        let authority   = args.authority;
        let adapters_index = 0;
        let bump = ctx.bumps.registry;

        ctx.accounts.registry.set_inner( Registry {
            authority,
            creator_key,
            adapters_index,
            bump,
        });

        ctx.accounts.registry.invariant()?;

        Ok(())
    }
}