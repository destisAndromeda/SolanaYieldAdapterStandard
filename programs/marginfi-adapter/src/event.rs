use anchor_lang::prelude::*;

#[event]
pub struct AdapterDepositEvent {
    pub authority: Pubkey,
    pub program_id: Pubkey,
    pub amount: u64,
}

#[event]
pub struct AdapterWithdrawEvent {
    pub authority: Pubkey,
    pub program_id: Pubkey,
    pub amount: u64,
}

#[event]
pub struct AdapterCurrentValueEvent {
    pub authority: Pubkey,
    pub program_id: Pubkey,
    pub current_value: u64,
}
