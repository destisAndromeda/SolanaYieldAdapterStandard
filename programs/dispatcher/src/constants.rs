pub use yield_adapter_interface::{
    ADAPTER_CURRENT_VALUE_DISCRIMINATOR, ADAPTER_DEPOSIT_DISCRIMINATOR,
    ADAPTER_WITHDRAW_DISCRIMINATOR, EXTRA_DATA_MAX_LEN,
};

// PDA seeds
pub const SEED_PREFIX: &[u8] = b"dispatcher";
pub const SEED_REGISTRY: &[u8] = b"registry";
pub const SEED_ADAPTER: &[u8] = b"adapter_info";
