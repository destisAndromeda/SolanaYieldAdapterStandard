use anchor_lang::prelude::*;

pub const DEPOSIT: [u8; 8] = [242, 35, 198, 137, 82, 225, 242, 182];
pub const WITHDRAW: [u8; 8] = [183, 18, 70, 156, 148, 109, 161, 34];
pub const ADD_INSURANCE_FUND_STAKE: [u8; 8] = [251, 144, 115, 11, 222, 47, 62, 236];
pub const REQUEST_REMOVE_INSURANCE_FUND_STAKE: [u8; 8] = [142, 70, 204, 92, 73, 106, 180, 52];
pub const REMOVE_INSURANCE_FUND_STAKE: [u8; 8] = [128, 166, 142, 9, 254, 187, 143, 174];
pub const INITIALIZE_INSURANCE_FUND_STAKE: [u8; 8] = [187, 179, 243, 70, 248, 90, 92, 147];

pub const PROGRAM_ID: Pubkey = pubkey!("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");
