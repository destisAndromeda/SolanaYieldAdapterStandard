use anchor_lang::prelude::*;
use crate::error::*;

#[account]
#[derive(InitSpace)]
pub struct Dispatcher {
    pub authority: Pubkey,

    pub creator_key: Pubkey,

    pub bump: u8,
}
