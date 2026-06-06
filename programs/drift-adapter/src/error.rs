use anchor_lang::prelude::*;

#[error_code]
pub enum AdapterError {
    #[msg("Unknown Function")] // 6000
    UnknownFunction,

    #[msg("Invalid Account")]  // 6001
    InvalidAccount,

    #[msg("Invalid Args")]     // 6002
    InvalidArgs
}
