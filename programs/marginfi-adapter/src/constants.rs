use anchor_lang::prelude::*;

pub const LENDING_ACCOUNT_DEPOSIT_DISCRIMINATOR: [u8; 8] =
    [171, 94, 235, 103, 82, 64, 212, 140];

pub const LENDING_ACCOUNT_WITHDRAW_DISCRIMINATOR: [u8; 8] =
    [36, 72, 74, 19, 210, 210, 192, 192];

pub const PROGRAM_ID: Pubkey = pubkey!("MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA");
