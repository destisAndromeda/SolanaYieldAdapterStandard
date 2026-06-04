use anchor_lang::prelude::*;

#[error_code]
pub enum DispatcherError {
    #[msg("InvalidAccount")]  // 6000
    InvalidAccount,

    #[msg("Unauthorized")]    // 6001
    Unauthorized,
}
