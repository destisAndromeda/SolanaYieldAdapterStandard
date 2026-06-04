use anchor_lang::prelude::*;

#[error_code]
pub enum AdapterError {
    #[msg("InvalidAccount")] // 6000
    InvalidAccount,
}
