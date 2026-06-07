use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_error::ProgramError;
use yield_adapter_interface::{
    set_return_u64, ADAPTER_DEPOSIT_DISCRIMINATOR, ADAPTER_WITHDRAW_DISCRIMINATOR,
};

declare_id!("3ChHEmV3NhvmtzLXPDY62aJizN4tiBGapzpmUKwxj6cV");

#[program]
pub mod mock_adapter {
    use super::*;

    pub fn adapter_current_value(_ctx: Context<AdapterCurrentValue>) -> Result<()> {
        set_return_u64(0);
        Ok(())
    }

    /// Handles raw `invoke()` calls from dispatcher for deposit/withdraw.
    pub fn fallback(_program_id: &Pubkey, _accounts: &[AccountInfo], data: &[u8]) -> Result<()> {
        if data.len() < 16 {
            return Err(ProgramError::InvalidInstructionData.into());
        }

        let disc = &data[..8];
        if disc == ADAPTER_DEPOSIT_DISCRIMINATOR || disc == ADAPTER_WITHDRAW_DISCRIMINATOR {
            return Ok(());
        }

        Err(ProgramError::InvalidInstructionData.into())
    }
}

#[derive(Accounts)]
pub struct AdapterCurrentValue {}
