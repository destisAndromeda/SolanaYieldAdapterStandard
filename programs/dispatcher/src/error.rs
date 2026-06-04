use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("InvalidAccount")]  // 6000
    InvalidAccount,
}
