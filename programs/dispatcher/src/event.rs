use anchor_lang::prelude::*;

#[event]
pub struct DepositEvent {
    pub authority: Pubkey,
    pub program_id: Pubkey,
    pub amount: u64,
}

#[event]
pub struct WithdrawEvent {
    pub authority: Pubkey,
    pub program_id: Pubkey,
    pub amount: u64,
}

#[event]
pub struct ToggleEvent {
    pub authority: Pubkey,
    pub adapter: Pubkey,
    pub program_id: Pubkey,
    pub status: u8,
}
