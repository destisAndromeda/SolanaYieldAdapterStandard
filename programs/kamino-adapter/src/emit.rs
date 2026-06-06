use anchor_lang::prelude::*;

#[event]
pub struct AdapterDepositEmit {
    pub authority: Pubkey,
    pub program_id: Pubkey,
    pub amount: u64,
}