use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;

use crate::constants::*;
use crate::error::*;
use crate::event::*;
use crate::state::*;
pub use yield_adapter_interface::DepositArgs;

#[derive(Accounts)]
pub struct Deposit<'info> {
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

impl<'info> Deposit<'info> {
    fn validate(&self, args: &DepositArgs) -> Result<()> {
        let Self { adapter, .. } = self;

        require!(adapter.is_active()?, DispatcherError::Inactive);

        let len = args.extra_data.len();
        // Total 65 bytes
        require!(len <= EXTRA_DATA_MAX_LEN, DispatcherError::Overflow,);

        Ok(())
    }

    #[access_control(ctx.accounts.validate(&args))]
    pub fn deposit(ctx: Context<'info, Self>, args: DepositArgs) -> Result<()> {
        let program_id = ctx.accounts.adapter.program_id;

        // Borsh-serialize the args: 8 bytes for u64 amount + 4 bytes length prefix + data for Vec
        let serialized_args = borsh::to_vec(&args)?;
        let mut data = Vec::with_capacity(8 + serialized_args.len());
        data.extend_from_slice(&ADAPTER_DEPOSIT_DISCRIMINATOR);
        data.extend_from_slice(&serialized_args);

        let mut accounts: Vec<AccountMeta> = Vec::with_capacity(1 + ctx.remaining_accounts.len());
        accounts.push(AccountMeta::new_readonly(ctx.accounts.signer.key(), true));
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
        account_infos.push(ctx.accounts.signer.to_account_info());
        account_infos.extend(ctx.remaining_accounts.iter().cloned());

        invoke(&instruction, &account_infos)?;

        emit!(DepositEvent {
            authority: ctx.accounts.signer.key(),
            program_id,
            amount: args.amount,
        });

        Ok(())
    }
}
