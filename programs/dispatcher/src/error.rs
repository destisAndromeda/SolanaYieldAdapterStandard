use anchor_lang::prelude::*;

#[error_code]
pub enum DispatcherError {
    #[msg("InvalidAccount")] // 6000
    InvalidAccount,

    #[msg("Unauthorized")] // 6001
    Unauthorized,

    #[msg("Overflow")] // 6002
    Overflow,

    #[msg("Inactive")] // 6003
    Inactive,

    #[msg("InvalidStatus")] // 6004
    InvalidStatus,

    #[msg("InvalidProtocol")] // 6005
    InvalidProtocol,

    #[msg("Deprecated")] // 6006
    Deprecated,
}
