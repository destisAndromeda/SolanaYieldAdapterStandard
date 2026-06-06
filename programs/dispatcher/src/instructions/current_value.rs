use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::instruction::{ Instruction, AccountMeta };

use crate::state::*;
use crate::error::*;
use crate::constants::*;

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

impl CurrentValue<'_> {
    fn validate(&self) -> Result<()> {
        let Self {
            adapter,
            ..
        } = self;

        require!(
            adapter.is_active,
            DispatcherError::Inactive,
        );

        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn current_value(ctx: Context<Self>) -> Result<()> {
        let program_id = ctx.accounts.adapter.program_id;

        // 8 bytes for discriminator and amount
        let mut data = Vec::with_capacity(8);
        data.extend_from_slice(&ADAPTER_CURRENT_VALUE_DISCRIMINATOR);

        let accounts: Vec<AccountMeta> = ctx.remaining_accounts
            .iter()
            .map(|incoming| AccountMeta {
                pubkey: incoming.key(),
                is_signer: incoming.is_signer,
                is_writable: incoming.is_writable,
            })
            .collect();

        let instruction = Instruction {
            program_id,
            accounts,
            data,
        };

        invoke(&instruction, ctx.remaining_accounts)?;

        Ok(())
    }
}