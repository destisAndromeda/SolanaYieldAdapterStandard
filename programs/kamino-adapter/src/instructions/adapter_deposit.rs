use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::instruction::Instruction;

use crate::state::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AdapterDepositArgs {
    pub amount: u64,
}

#[derive(Accounts)]
pub struct AdapterDeposit<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    /// Fixed deposit configuration accounts
    pub deposit_instruction_config: Account<'info, DepositInstructionConfig>,
}

impl AdapterDeposit<'_> {
    pub fn adapter_deposit(
        ctx: Context<Self>,
        args: AdapterDepositArgs,
    ) -> Result<()> {
        let amount = args.amount;
        // Extract fixed pubkeys and kamino program id from config
        let cfg = &ctx.accounts.deposit_instruction_config;
        let lending_market_pk = cfg.lending_market;
        let lending_market_authority_pk = cfg.lending_market_authority;
        let reserve_pk = cfg.reserve;
        let reserve_liquidity_mint_pk = cfg.reserve_liquidity_mint;
        let reserve_liquidity_supply_pk = cfg.reserve_liquidity_supply;
        let reserve_collateral_mint_pk = cfg.reserve_collateral_mint;
        let reserve_destination_deposit_collateral_pk = cfg.reserve_destination_deposit_collateral;
        let kamino_program_id = cfg.kamino_program_id;

        // quick sanity: ensure config is initialized
        require_keys_neq!(cfg.authority, Pubkey::default(), AdapterError::InvalidAccount);

        // remaining_accounts expected layout (indexes):
        // [0] lending_market
        // [1] lending_market_authority
        // [2] reserve
        // [3] reserve_liquidity_mint
        // [4] reserve_liquidity_supply
        // [5] reserve_collateral_mint
        // [6] reserve_destination_deposit_collateral
        // [7] obligation
        // [8] owner (AccountInfo) - must match signer
        // [9] user_source_liquidity
        // [10] user_destination_collateral (placeholder)
        // [11] collateral_token_program
        // [12] liquidity_token_program
        // [13] instruction_sysvar_account
        if ctx.remaining_accounts.len() < 14 {
            return Err(error!(AdapterError::InvalidAccount));
        }

        // Validate fixed account pubkeys match config
        if ctx.remaining_accounts[0].key() != lending_market_pk {
            return Err(error!(AdapterError::InvalidAccount));
        }
        if ctx.remaining_accounts[1].key() != lending_market_authority_pk {
            return Err(error!(AdapterError::InvalidAccount));
        }
        if ctx.remaining_accounts[2].key() != reserve_pk {
            return Err(error!(AdapterError::InvalidAccount));
        }
        if ctx.remaining_accounts[3].key() != reserve_liquidity_mint_pk {
            return Err(error!(AdapterError::InvalidAccount));
        }
        if ctx.remaining_accounts[4].key() != reserve_liquidity_supply_pk {
            return Err(error!(AdapterError::InvalidAccount));
        }
        if ctx.remaining_accounts[5].key() != reserve_collateral_mint_pk {
            return Err(error!(AdapterError::InvalidAccount));
        }
        if ctx.remaining_accounts[6].key() != reserve_destination_deposit_collateral_pk {
            return Err(error!(AdapterError::InvalidAccount));
        }

        let obligation_info = ctx.remaining_accounts[7].clone();
        let owner_info = ctx.remaining_accounts[8].clone();
        let user_source_liquidity_info = ctx.remaining_accounts[9].clone();
        let user_destination_collateral_info = ctx.remaining_accounts[10].clone();
        let collateral_token_program_info = ctx.remaining_accounts[11].clone();
        let liquidity_token_program_info = ctx.remaining_accounts[12].clone();
        let instruction_sysvar_info = ctx.remaining_accounts[13].clone();

        // Build AccountMeta list in the exact order Kamino expects
        let accounts = vec![
            AccountMeta::new(owner_info.key(), true),                      // owner (signer, writable)
            AccountMeta::new(obligation_info.key(), false),                 // obligation (writable)
            AccountMeta::new_readonly(lending_market_pk, false),           // lending_market
            AccountMeta::new_readonly(lending_market_authority_pk, false), // lending_market_authority
            AccountMeta::new(reserve_pk, false),                            // reserve (writable)
            AccountMeta::new_readonly(reserve_liquidity_mint_pk, false),   // reserve_liquidity_mint
            AccountMeta::new(reserve_liquidity_supply_pk, false),           // reserve_liquidity_supply (writable)
            AccountMeta::new(reserve_collateral_mint_pk, false),            // reserve_collateral_mint (writable for mint)
            AccountMeta::new(reserve_destination_deposit_collateral_pk, false), // reserve_destination_deposit_collateral (writable)
            AccountMeta::new(user_source_liquidity_info.key(), false),      // user_source_liquidity (writable)
            AccountMeta::new_readonly(user_destination_collateral_info.key(), false),// placeholder_user_destination_collateral (writable)
            AccountMeta::new_readonly(collateral_token_program_info.key(), false),
            AccountMeta::new_readonly(liquidity_token_program_info.key(), false),
            AccountMeta::new_readonly(instruction_sysvar_info.key(), false),
        ];

        // Build instruction data: Anchor discriminator + args
        let mut data: Vec<u8> = Vec::with_capacity(8 + 8);
        // Compute Anchor discriminator for "global:deposit_reserve_liquidity_and_obligation_collateral"
        let disc_bytes: [u8; 8] = [0x81, 0xc7, 0x04, 0x02, 0xde, 0x27, 0x1a, 0x2e];
        data.extend_from_slice(&disc_bytes);
        data.extend_from_slice(&amount.to_le_bytes());

        let instruction = Instruction {
            program_id: kamino_program_id,
            accounts,
            data,
        };

        // Verify owner matches signer and is a signer
        if owner_info.key() != ctx.accounts.owner.key() {
            return Err(error!(AdapterError::InvalidAccount));
        }
        if !owner_info.is_signer {
            return Err(error!(AdapterError::InvalidAccount));
        }

        // Build AccountInfo vector in the same order as metas
        let mut account_infos: Vec<AccountInfo> = Vec::new();
        account_infos.push(owner_info);
        account_infos.push(obligation_info);
        account_infos.push(ctx.remaining_accounts[0].clone());
        account_infos.push(ctx.remaining_accounts[1].clone());
        account_infos.push(ctx.remaining_accounts[2].clone());
        account_infos.push(ctx.remaining_accounts[3].clone());
        account_infos.push(ctx.remaining_accounts[4].clone());
        account_infos.push(ctx.remaining_accounts[5].clone());
        account_infos.push(ctx.remaining_accounts[6].clone());
        account_infos.push(user_source_liquidity_info);
        account_infos.push(user_destination_collateral_info);
        account_infos.push(collateral_token_program_info);
        account_infos.push(liquidity_token_program_info);
        account_infos.push(instruction_sysvar_info);

        // Append any extra remaining accounts (start from index 14)
        if ctx.remaining_accounts.len() > 14 {
            account_infos.extend_from_slice(&ctx.remaining_accounts[14..]);
        }

        invoke(&instruction, &account_infos)?;

        Ok(())
    }
}
