use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;

use crate::constants::*;
use crate::error::*;
use crate::event::*;
use crate::state::*;
pub use yield_adapter_interface::WithdrawArgs;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

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

impl Withdraw<'_> {
    fn validate(&self, args: &WithdrawArgs) -> Result<()> {
        let Self { adapter, .. } = self;

        require!(adapter.is_active()?, DispatcherError::Inactive);

        let len = args.extra_data.len();
        require!(len <= EXTRA_DATA_MAX_LEN, DispatcherError::Overflow,);

        Ok(())
    }

    #[access_control(ctx.accounts.validate(&args))]
    pub fn withdraw(ctx: Context<Self>, args: WithdrawArgs) -> Result<()> {
        let program_id = ctx.accounts.adapter.program_id;
        let amount = args.amount.to_le_bytes();

        let len = args.extra_data.len();

        // 16 bytes for discriminator and amount
        let mut data = Vec::with_capacity(16 + len);
        data.extend_from_slice(&ADAPTER_WITHDRAW_DISCRIMINATOR);
        data.extend_from_slice(&amount);
        data.extend_from_slice(&args.extra_data);

        let accounts: Vec<AccountMeta> = ctx
            .remaining_accounts
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

        emit!(WithdrawEvent {
            authority: ctx.accounts.signer.key(),
            program_id,
            amount: args.amount,
        });

        Ok(())
    }
}
