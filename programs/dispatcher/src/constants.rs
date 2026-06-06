use anchor_lang::prelude::*;

// Integer values
pub const EXTRA_DATA_MAX_LEN: usize = 64;

// PDA seeds
pub const SEED_PREFIX: &[u8] = b"dispatcher";
pub const SEED_REGISTRY: &[u8] = b"registry";
pub const SEED_ADAPTER_INFO: &[u8] = b"adapter_info";

// Hard-code discriminators
pub const ADAPTER_DEPOSIT_DISCRIMINATOR: [u8; 8] = {
    // sha256("global:adapter_deposit")[..8]
    [190, 207, 72, 186, 232, 106, 46, 72]
};

pub const ADAPTER_WITHDRAW_DISCRIMINATOR: [u8; 8] = {
    // sha256("global:adapter_withdraw")[..8]
    [121,  55,  72,  46, 185, 100, 173, 236]
};

pub const ADAPTER_CURRENT_VALUE_DISCRIMINATOR: [u8; 8] = {
    // sha256("global:adapter_current_value")[..8]
    [67, 200,  59, 238, 163, 138, 170, 179]
};