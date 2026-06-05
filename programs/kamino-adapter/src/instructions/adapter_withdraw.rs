use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};

use crate::state::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AdapterWithdrawArgs {
    pub collateral_amount: u64,
}

#[derive(Accounts)]
pub struct AdapterWithdraw<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    /// Fixed withdraw configuration accounts
    pub withdraw_instruction_config: Account<'info, WithdrawInstructionConfig>,
}

impl AdapterWithdraw<'_> {
    pub fn adapter_withdraw(
        ctx: Context<Self>,
        args: AdapterWithdrawArgs,
    ) -> Result<()> {
        let collateral_amount = args.collateral_amount;

        let cfg = &ctx.accounts.withdraw_instruction_config;
        let lending_market_pk = cfg.lending_market;
        let lending_market_authority_pk = cfg.lending_market_authority;
        let withdraw_reserve_pk = cfg.withdraw_reserve;
        let reserve_liquidity_mint_pk = cfg.reserve_liquidity_mint;
        let reserve_source_collateral_pk = cfg.reserve_source_collateral;
        let reserve_collateral_mint_pk = cfg.reserve_collateral_mint;
        let reserve_liquidity_supply_pk = cfg.reserve_liquidity_supply;
        let kamino_program_id = cfg.kamino_program_id;

        require_keys_neq!(cfg.authority, Pubkey::default(), AdapterError::InvalidAccount);

        if ctx.remaining_accounts.len() < 14 {
            return Err(error!(AdapterError::InvalidAccount));
        }

        if ctx.remaining_accounts[2].key() != lending_market_pk {
            return Err(error!(AdapterError::InvalidAccount));
        }
        if ctx.remaining_accounts[3].key() != lending_market_authority_pk {
            return Err(error!(AdapterError::InvalidAccount));
        }
        if ctx.remaining_accounts[4].key() != withdraw_reserve_pk {
            return Err(error!(AdapterError::InvalidAccount));
        }
        if ctx.remaining_accounts[5].key() != reserve_liquidity_mint_pk {
            return Err(error!(AdapterError::InvalidAccount));
        }
        if ctx.remaining_accounts[6].key() != reserve_source_collateral_pk {
            return Err(error!(AdapterError::InvalidAccount));
        }
        if ctx.remaining_accounts[7].key() != reserve_collateral_mint_pk {
            return Err(error!(AdapterError::InvalidAccount));
        }
        if ctx.remaining_accounts[8].key() != reserve_liquidity_supply_pk {
            return Err(error!(AdapterError::InvalidAccount));
        }

        let owner_info = ctx.remaining_accounts[0].clone();
        let obligation_info = ctx.remaining_accounts[1].clone();
        let user_destination_liquidity_info = ctx.remaining_accounts[9].clone();
        let placeholder_user_destination_collateral_info = ctx.remaining_accounts[10].clone();
        let collateral_token_program_info = ctx.remaining_accounts[11].clone();
        let liquidity_token_program_info = ctx.remaining_accounts[12].clone();
        let instruction_sysvar_info = ctx.remaining_accounts[13].clone();

        let accounts = vec![
            AccountMeta::new(owner_info.key(), true),
            AccountMeta::new(obligation_info.key(), false),
            AccountMeta::new_readonly(lending_market_pk, false),
            AccountMeta::new_readonly(lending_market_authority_pk, false),
            AccountMeta::new(withdraw_reserve_pk, false),
            AccountMeta::new_readonly(reserve_liquidity_mint_pk, false),
            AccountMeta::new(reserve_source_collateral_pk, false),
            AccountMeta::new(reserve_collateral_mint_pk, false),
            AccountMeta::new(reserve_liquidity_supply_pk, false),
            AccountMeta::new(user_destination_liquidity_info.key(), false),
            AccountMeta::new_readonly(placeholder_user_destination_collateral_info.key(), false),
            AccountMeta::new_readonly(collateral_token_program_info.key(), false),
            AccountMeta::new_readonly(liquidity_token_program_info.key(), false),
            AccountMeta::new_readonly(instruction_sysvar_info.key(), false),
        ];

        let mut data: Vec<u8> = Vec::with_capacity(8 + 8);
        let disc_bytes: [u8; 8] = [0xeb, 0x34, 0x77, 0x98, 0x95, 0xc5, 0x14, 0x07];
        data.extend_from_slice(&disc_bytes);
        data.extend_from_slice(&collateral_amount.to_le_bytes());

        let instruction = Instruction {
            program_id: kamino_program_id,
            accounts,
            data,
        };

        if owner_info.key() != ctx.accounts.owner.key() {
            return Err(error!(AdapterError::InvalidAccount));
        }
        if !owner_info.is_signer {
            return Err(error!(AdapterError::InvalidAccount));
        }

        let mut account_infos: Vec<AccountInfo> = Vec::new();
        account_infos.push(owner_info);
        account_infos.push(obligation_info);
        account_infos.push(ctx.remaining_accounts[2].clone());
        account_infos.push(ctx.remaining_accounts[3].clone());
        account_infos.push(ctx.remaining_accounts[4].clone());
        account_infos.push(ctx.remaining_accounts[5].clone());
        account_infos.push(ctx.remaining_accounts[6].clone());
        account_infos.push(ctx.remaining_accounts[7].clone());
        account_infos.push(ctx.remaining_accounts[8].clone());
        account_infos.push(user_destination_liquidity_info);
        account_infos.push(placeholder_user_destination_collateral_info);
        account_infos.push(collateral_token_program_info);
        account_infos.push(liquidity_token_program_info);
        account_infos.push(instruction_sysvar_info);

        if ctx.remaining_accounts.len() > 14 {
            account_infos.extend_from_slice(&ctx.remaining_accounts[14..]);
        }

        invoke(&instruction, &account_infos)?;

        Ok(())
    }
}
