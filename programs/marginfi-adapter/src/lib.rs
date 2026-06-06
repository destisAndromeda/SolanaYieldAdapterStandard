pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("43vGkNHfLML24Df9xCJddmwsx1mbje34yVsH13bqnbny");

#[program]
pub mod marginfi_adapter {
    use super::*;

}
