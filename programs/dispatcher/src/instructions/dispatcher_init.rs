use anchor_lang::prelude::*;

use crate::state::*;
use crate::error::*;
use crate::constants::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DispatcherInitArgs {
    /// Authority that can update Duspatcher state
    pub authority: Pubkey,

    /// Key that can init subsidiary accounts
    pub creator_key: Pubkey,
}

#[derive(Accounts)]
pub struct DispatcherInit<'info> {
    /// Key from ProgramConfig
    #[account(mut)]
    pub creator_key: Signer<'info>,

    #[account(
        init,
        payer = creator_key,
        space = 8 + Dispatcher::INIT_SPACE,
        seeds = [
            SEED_PREFIX,
            program_config.key().as_ref(),
            SEED_DISPATCHER,
            creator_key.key().as_ref(),
        ],
        bump,
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

impl DispatcherInit<'_> {
    /// A one-time instruction that initializes the global dispatcher.
    pub fn dispatcher_init(
        ctx: Context<Self>,
        args: DispatcherInitArgs,
    ) -> Result<()> {
        let creator_key = args.creator_key;
        let authority   = args.authority;
        let bump = ctx.bumps.dispatcher;
        
        ctx.accounts.dispatcher.set_inner( Dispatcher {
            authority,
            creator_key,
            bump,
        });

        ctx.accounts.dispatcher.invariant()?;

        Ok(())
    }
}