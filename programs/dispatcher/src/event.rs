use anchor_lang::prelude::*;

#[event]
pub struct DepositEmit {
    pub authority: Pubkey,
    pub program_id: Pubkey,
    pub adapter_index: u64,
    pub amount: u64,
}

#[event]
pub struct WithdrawEmit {
    pub authority: Pubkey,
    pub program_id: Pubkey,
    pub adapter_index: u64,
    pub amount: u64,
}