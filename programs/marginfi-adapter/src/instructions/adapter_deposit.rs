use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::instruction::{ Instruction, AccountMeta };

use crate::event::*;
use crate::error::*;
use crate::constants::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AdapterDepositArgs {
    pub amount: u64,
    pub extra_data: Vec<u8>,
}

#[derive(Accounts)]
pub struct AdapterDeposit<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
}

impl AdapterDeposit<'_> {
    fn validate(&self, args: &AdapterDepositArgs) -> Result<()> {
        let Self {
            authority,            
        } = self;

        require_keys_neq!(
            authority.key(),
            Pubkey::default(),
            AdapterError::InvalidAccount,
        );

        require!(
            !args.extra_data.is_empty(),
            AdapterError::InvalidArgs,
        );

        Ok(())
    }

    #[access_control(ctx.accounts.validate(&args))]
    pub fn adapter_deposit(
        ctx: Context<Self>,
        args: AdapterDepositArgs,
    ) -> Result<()> {
        // Zero index contain function id for matching
        match args.extra_data[0] {
            0 => {
                // The name must match the name of the actual instruction being called 
                Self::lending_account_deposit(ctx, args)?;
            },
            _ => return err!(AdapterError::UnknownFunction),
        }

        Ok(())
    }

    fn build_and_invoke(
        ctx: Context<Self>,
        discriminator: &[u8],
        amount: u64,
        extra_data: &[u8],
    ) -> Result<()> {
        let mut data = Vec::with_capacity(16);
        data.extend_from_slice(discriminator);
        data.extend_from_slice(&amount.to_le_bytes());
        data.extend_from_slice(extra_data);

        let accounts: Vec<AccountMeta> = ctx.remaining_accounts
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

        emit!( AdapterDepositEvent {
            authority: ctx.accounts.authority.key(),
            program_id,
            amount,
        });

        Ok(())
    }

    fn lending_account_deposit(
        ctx: Context<Self>,
        args: AdapterDepositArgs,
    ) -> Result<()> {
        Self::build_and_invoke(
            ctx,
            &LENDING_ACCOUNT_DEPOSIT_DISCRIMINATOR,
            args.amount, 
            &args.extra_data[1..],
        )
    }
}