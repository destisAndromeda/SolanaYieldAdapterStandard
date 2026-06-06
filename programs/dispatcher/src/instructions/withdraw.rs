use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::instruction::{ Instruction, AccountMeta };

use crate::event::*;
use crate::state::*;
use crate::error::*;
use crate::constants::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct WithdrawArgs {
    pub amount: u64,
    pub adapter_index: u64,

    pub extra_data: Vec<u8>,
}

#[derive(Accounts)]
#[instruction(args: WithdrawArgs)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [
            SEED_PREFIX,
            registry.creator_key.as_ref(),
            SEED_ADAPTER_INFO,
            &args.adapter_index.to_be_bytes(),
        ],
        bump  = adapter.bump,
    )]
    pub adapter: Account<'info, Adapter>,

    #[account(
        seeds = [
            SEED_PREFIX,
            SEED_REGISTRY,
        ],
        bump  = registry.bump,
    )]
    pub registry: Account<'info, Registry>,
}

impl Withdraw<'_> {
    fn validate(&self, args: &WithdrawArgs) -> Result<()> {
        let Self {
            adapter,
            ..
        } = self;

        require!(
            adapter.is_active,
            DispatcherError::Inactive,
        );

        let len = args.extra_data.len();
        require!(
            len <= EXTRA_DATA_MAX_LEN,
            DispatcherError::Overflow,
        );

        Ok(())
    }

    #[access_control(ctx.accounts.validate(&args))]
    pub fn withdraw(
        ctx: Context<Self>,
        args: WithdrawArgs,
    ) -> Result<()> {
        let program_id = ctx.accounts.adapter.program_id;
        let amount = args.amount.to_le_bytes();

        let len = args.extra_data.len();

        // 16 bytes for discriminator and amount
        let mut data = Vec::with_capacity(16 + len);
        data.extend_from_slice(&ADAPTER_WITHDRAW_DISCRIMINATOR);
        data.extend_from_slice(&amount);
        data.extend_from_slice(&args.extra_data);

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

        emit!( WithdrawEmit {
            authority: ctx.accounts.authority.key(),
            program_id,
            adapter_index: args.adapter_index,
            amount: args.amount,
        });

        Ok(())
    }
}