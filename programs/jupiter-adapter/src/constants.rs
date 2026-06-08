use anchor_lang::prelude::*;

pub const DEPOSIT_COLLATERAL_FOR_BORROWS_DISCRIMINATOR: [u8; 8] = [17, 2, 195, 190, 76, 16, 238, 74];

pub const WITHDRAW_COLLATERAL_FOR_BORROWS_DISCRIMINATOR: [u8; 8] = [117, 160, 60, 82, 237, 233, 46, 182];

pub const ADD_LIQUIDITY2: [u8; 8] = [228, 162, 78, 28, 70, 219, 116, 115];

pub const REMOVE_LIQUIDITY: [u8; 8] = [230, 215, 82, 127, 241, 101, 227, 146];

pub const PROGRAM_ID: Pubkey = pubkey!("PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu");
