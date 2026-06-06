use anchor_lang::prelude::*;

pub const DEPOSIT_RESERVE_LIQUIDITY_AND_OBLIGATION_COLLATERAL_V2_DISCRIMINATOR: [u8; 8] = {
    [216, 224, 191, 27, 204, 151, 102, 175]
};

pub const DEPOSIT_RESERVE_LIQUIDITY: [u8; 8] = {
    [169, 201, 30, 126, 6, 205, 102, 68]
};

pub const DEPOSIT_OBLIGATION_COLLATERLA_V2: [u8; 8] = {
    [108, 209, 4, 72, 21, 22, 118, 133]
};

pub const DEPOSIT_AND_WITHDRAW: [u8; 8] = {
    [141, 153, 39, 15, 64, 61, 88, 84]
};

pub const WITHDRAW_OBLIGATION_COLLATERAL_AND_REDEEM_RESERVE_COLLATERAL_V2: [u8; 8] = {
    [235, 52, 119, 152, 149, 197, 20, 7]
};

pub const REDEEM_RESERVE_COLLATERAL: [u8; 8] = {
    [234, 117, 181, 125, 185, 142, 220, 29]
};

/// Kamino program id for CPI
pub const KAMINO_PROGRAM_ID: Pubkey = pubkey!("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
