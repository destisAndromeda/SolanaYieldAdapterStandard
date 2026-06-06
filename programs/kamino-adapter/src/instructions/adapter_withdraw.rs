use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::instruction::{ Instruction, AccountMeta };
use klend_interface::KLEND_PROGRAM_ID;

use crate::emit::*;
use crate::error::*;
use crate::constants::*;

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
    pub fn adapter_withdraw(
        ctx: Context<Self>,
        args: AdapterWithdrawArgs,
    ) -> Result<()> {
        // Zero index contain function id for matching
        match args.extra_data[0] {
            0 => {
                // The name must match the name of the actual instruction being called 
                Self::withdraw_obligation_collateral_and_redeem_reserve_collateral_v2(ctx, args)?;
            },
            1 => Self::redeem_reserve_collateral(ctx, args)?,
            2 => Self::deposit_and_withdraw(ctx, args)?,

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

        let program_id = Pubkey::from(KLEND_PROGRAM_ID.to_bytes());

        let instruction = Instruction {
            program_id,
            accounts,
            data,
        };

        invoke(&instruction, ctx.remaining_accounts)?;

        emit!( AdapterWithdrawEmit {
            authority: ctx.accounts.authority.key(),
            program_id,
            amount,
        });

        Ok(())
    }

    fn withdraw_obligation_collateral_and_redeem_reserve_collateral_v2(
        ctx: Context<Self>,
        args: AdapterWithdrawArgs,
    ) -> Result<()> {
        Self::build_and_invoke(
            ctx,
            &WITHDRAW_OBLIGATION_COLLATERAL_AND_REDEEM_RESERVE_COLLATERAL_V2,
            args.amount, 
            &[]
        )
    }

    fn redeem_reserve_collateral(
        ctx: Context<Self>,
        args: AdapterWithdrawArgs,
    ) -> Result<()> {
        Self::build_and_invoke(
            ctx,
            &REDEEM_RESERVE_COLLATERAL,
            args.amount,
            &args.extra_data[1..]
        )
    }

    fn deposit_and_withdraw(
        ctx: Context<Self>,
        args: AdapterWithdrawArgs,
    ) -> Result<()> {
        Self::build_and_invoke(
            ctx,
            &DEPOSIT_AND_WITHDRAW,
            args.amount,
            &args.extra_data[1..]
        )
    }
}