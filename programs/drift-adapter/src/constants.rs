use anchor_lang::prelude::*;

pub const DEPOSIT_DISCRIMINATOR: [u8; 8] = {
    [242,  35, 198, 137, 82, 225, 242, 182]
};

pub const WITHDRAW_DISCRIMINATOR: [u8; 8] = {
    [183,  18,  70, 156, 148, 109, 161,  34]
};

pub const PROGRAM_ID: Pubkey = pubkey!("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");