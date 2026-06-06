use anchor_lang::prelude::*;

#[event]
pub struct AdapterDepositEmit {
    pub authority: Pubkey,
    pub program_id: Pubkey,
    pub amount: u64,
}

#[event]
pub struct AdapterWithdrawEmit {
    pub authority: Pubkey,
    pub program_id: Pubkey,
    pub amount: u64,
}