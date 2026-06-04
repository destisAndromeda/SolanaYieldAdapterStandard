use anchor_lang::prelude::*;

use crate::state::*;
use crate::error::*;
use crate::constants::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DispatcherInitArgs {
    pub authority: Pubkey,

    pub creator_key: Pubkey,
}

#[derive(Accounts)]
pub struct DispatcherInit<'info> {
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
