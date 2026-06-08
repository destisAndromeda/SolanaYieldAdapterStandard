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
    fn validate(&self, ctx: &Context<Self>, args: &AdapterWithdrawArgs) -> Result<()> {
        require!(!args.extra_data.is_empty(), AdapterError::InvalidArgs);

        // CCIP ccip_send has 18 base accounts.
        require!(
            ctx.remaining_accounts.len() >= 18,
            AdapterError::InvalidAccount,
        );

        // CCIP account #3 is authority signer.
        require_keys_eq!(
            ctx.remaining_accounts[3].key(),
            ctx.accounts.authority.key(),
            AdapterError::Unauthorized,
        );

        require!(
            ctx.remaining_accounts[3].is_signer,
            AdapterError::Unauthorized,
        );

        Ok(())
    }

    #[access_control(ctx.accounts.validate(&ctx, &args))]
    pub fn adapter_withdraw(ctx: Context<Self>, args: AdapterWithdrawArgs) -> Result<()> {
        // extra_data[0] is local adapter selector.
        // 0 = ccip_send
        match args.extra_data[0] {
            0 => Self::ccip_send(ctx, args)?,
            _ => return err!(AdapterError::UnknownFunction),
        }

        Ok(())
    }

    fn build_and_invoke_ccip(
        ctx: Context<Self>,
        discriminator: &[u8],
        amount: u64,
        extra_data: &[u8],
    ) -> Result<()> {
        // CCIP data format:
        // 8-byte ccip_send discriminator + Borsh-serialized CcipSendInstructionArgs.
        //
        // Do NOT append adapter amount here.
        // CCIP amount is already inside message.token_amounts in extra_data.
        let mut data = Vec::with_capacity(8 + extra_data.len());
        data.extend_from_slice(discriminator);
        data.extend_from_slice(extra_data);

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

    fn ccip_send(ctx: Context<Self>, args: AdapterWithdrawArgs) -> Result<()> {
        Self::build_and_invoke_ccip(
            ctx,
            &CCIP_SEND,
            args.amount,
            &args.extra_data[1..],
        )
    }
}
