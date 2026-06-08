use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;

use crate::constants::*;
use crate::error::*;
use crate::state::*;
use yield_adapter_interface::{read_return_u64, set_return_u64};

#[derive(Accounts)]
pub struct CurrentValue<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [
            SEED_PREFIX,
            adapter.program_id.as_ref(),
            SEED_ADAPTER,
            adapter.authority.as_ref(),
        ],
        bump  = adapter.bump,
    )]
    pub adapter: Account<'info, Adapter>,
}

impl<'info> CurrentValue<'info> {
    fn validate(&self) -> Result<()> {
        let Self { adapter, .. } = self;

        require!(adapter.is_active()?, DispatcherError::Inactive);

        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn current_value(ctx: Context<'info, Self>) -> Result<()> {
        let program_id = ctx.accounts.adapter.program_id;

        // 8 bytes for discriminator and amount
        let mut data = Vec::with_capacity(8);
        data.extend_from_slice(&ADAPTER_CURRENT_VALUE_DISCRIMINATOR);

        let mut accounts: Vec<AccountMeta> = Vec::with_capacity(1 + ctx.remaining_accounts.len());
        accounts.push(AccountMeta::new_readonly(ctx.accounts.authority.key(), true));
        accounts.extend(ctx.remaining_accounts.iter().map(|incoming| AccountMeta {
            pubkey: incoming.key(),
            is_signer: incoming.is_signer,
            is_writable: incoming.is_writable,
        }));

        let instruction = Instruction {
            program_id,
            accounts,
            data,
        };

        let mut account_infos: Vec<AccountInfo<'info>> = Vec::with_capacity(1 + ctx.remaining_accounts.len());
        account_infos.push(ctx.accounts.authority.to_account_info());
        account_infos.extend(ctx.remaining_accounts.iter().cloned());

        invoke(&instruction, &account_infos)?;

        let current_value = read_return_u64()?;
        set_return_u64(current_value);

        Ok(())
    }
}