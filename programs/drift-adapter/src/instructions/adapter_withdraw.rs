use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;

use crate::constants::*;
use crate::error::*;
use crate::event::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AdapterWithdrawArgs {
    pub amount: u64,
    pub extra_data: Vec<u8>,
}

#[derive(Accounts)]
pub struct AdapterWithdraw<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
}

impl AdapterWithdraw<'_> {
    fn validate(&self, args: &AdapterWithdrawArgs) -> Result<()> {
        let Self { authority } = self;

        require_keys_neq!(
            authority.key(),
            Pubkey::default(),
            AdapterError::InvalidAccount,
        );

        require!(!args.extra_data.is_empty(), AdapterError::InvalidArgs,);

        Ok(())
    }

    #[access_control(ctx.accounts.validate(&args))]
    pub fn adapter_withdraw(ctx: Context<Self>, args: AdapterWithdrawArgs) -> Result<()> {
        // Zero index contain function id for matching
        match args.extra_data[0] {
            // The name must match the name of the actual instruction being called
            0 => Self::withdraw(ctx, args)?,
            1 => Self::request_remove_insurance_fund_stake(ctx, args)?,
            2 => Self::remove_insurance_fund_stake(ctx, args)?,
            _ => return err!(AdapterError::UnknownFunction),
        }

        Ok(())
    }

    fn build_and_invoke(
        ctx: Context<Self>,
        data: Vec<u8>,
        amount: u64,
    ) -> Result<()> {
        let accounts: Vec<AccountMeta> = ctx
            .remaining_accounts
            .iter()
            .map(|incoming| AccountMeta {
                pubkey: incoming.key(),
                is_signer: incoming.is_signer,
                is_writable: incoming.is_writable,
            })
            .collect();

        let program_id = PROGRAM_ID;

        let instruction = Instruction {
            program_id,
            accounts,
            data,
        };

        invoke(&instruction, ctx.remaining_accounts)?;

        emit!(AdapterWithdrawEvent {
            authority: ctx.accounts.authority.key(),
            program_id,
            amount,
        });

        Ok(())
    }

    fn withdraw(ctx: Context<Self>, args: AdapterWithdrawArgs) -> Result<()> {
        let mut data = Vec::with_capacity(16 + args.extra_data.len());
        data.extend_from_slice(&WITHDRAW);
        data.extend_from_slice(&args.extra_data[1..3]);
        data.extend_from_slice(&args.amount.to_le_bytes());
        data.extend_from_slice(&args.extra_data[3..]);
        
        Self::build_and_invoke(ctx, data, args.amount)?;

        Ok(())
    }

    fn request_remove_insurance_fund_stake(ctx: Context<Self>, args: AdapterWithdrawArgs) -> Result<()> {
        let mut data = Vec::with_capacity(16 + args.extra_data.len());
        data.extend_from_slice(&REQUEST_REMOVE_INSURANCE_FUND_STAKE);
        data.extend_from_slice(&args.extra_data[1..3]);
        data.extend_from_slice(&args.amount.to_le_bytes());

        Self::build_and_invoke(ctx, data, args.amount)?;

        Ok(())
    }

    fn remove_insurance_fund_stake(ctx: Context<Self>, args: AdapterWithdrawArgs) -> Result<()> {
        let mut data = Vec::with_capacity(16 + args.extra_data.len());
        data.extend_from_slice(&REMOVE_INSURANCE_FUND_STAKE);
        data.extend_from_slice(&args.extra_data[1..3]);

        Self::build_and_invoke(ctx, data, 0)?;

        Ok(())
    }
}
