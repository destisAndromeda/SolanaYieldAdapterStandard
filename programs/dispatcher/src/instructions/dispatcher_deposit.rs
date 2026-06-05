use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::system_instruction;

use crate::constants::*;
use crate::error::*;
use crate::state::*;

use spl_associated_token_account::instruction::create_associated_token_account;
use spl_associated_token_account::id as associated_token_program_id;
use spl_token::instruction::{close_account, sync_native};
use spl_token::native_mint;
use spl_token::id as token_program_id;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DispatcherDepositArgs {
    pub amount: u64,
    pub adapter_index: u64,
    pub source: DepositSource,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub enum DepositSource {
    Token,
    Native,
}

#[derive(Accounts)]
pub struct DispatcherDeposit<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [SEED_PREFIX, SEED_PROGRAM_CONFIG],
        bump = dispatcher.bump,
    )]
    pub dispatcher: Account<'info, Dispatcher>,

    #[account(
        seeds = [
            SEED_PREFIX,
            dispatcher.key().as_ref(),
            SEED_REGISTRY,
            registry.creator_key.as_ref(),
        ],
        bump = registry.bump,
    )]
    pub registry: Account<'info, Registry>,

    #[account(
        seeds = [
            SEED_PREFIX,
            registry.key().as_ref(),
            SEED_ADAPTER_INFO,
            &args.adapter_index.to_le_bytes(),
        ],
        bump = adapter_info.bump,
    )]
    pub adapter_info: Account<'info, AdapterInfo>,

    /// Adapter-specific deposit configuration account.
    pub deposit_instruction_config: AccountInfo<'info>,

    /// Source token account for Token deposits.
    #[account(mut)]
    pub user_source_liquidity: Option<AccountInfo<'info>>,

    /// WSOL account for Native deposits.
    #[account(mut)]
    pub wsol_account: Option<AccountInfo<'info>>,

    pub token_program: AccountInfo<'info>,
    pub associated_token_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl DispatcherDeposit<'_> {
    pub fn dispatcher_deposit(
        ctx: Context<Self>,
        args: DispatcherDepositArgs,
    ) -> Result<()> {
        let amount = args.amount;

        require_keys_neq!(
            ctx.accounts.adapter_info.adapter_program_id,
            Pubkey::default(),
            DispatcherError::InvalidAccount,
        );

        require_keys_eq!(
            ctx.accounts.deposit_instruction_config.owner,
            &ctx.accounts.adapter_info.adapter_program_id,
            DispatcherError::InvalidAccount,
        );

        require_eq!(
            ctx.accounts.token_program.key,
            &token_program_id(),
            DispatcherError::InvalidAccount,
        );

        require_eq!(
            ctx.accounts.associated_token_program.key,
            &associated_token_program_id(),
            DispatcherError::InvalidAccount,
        );

        let mut created_wsol_account = false;
        let user_source_liquidity_info = match args.source {
            DepositSource::Token => {
                let token_account = ctx
                    .accounts
                    .user_source_liquidity
                    .as_ref()
                    .ok_or(error!(DispatcherError::InvalidAccount))?;

                require_eq!(
                    token_account.owner,
                    &token_program_id(),
                    DispatcherError::InvalidAccount,
                );

                token_account.clone()
            }
            DepositSource::Native => {
                let wsol_info = ctx
                    .accounts
                    .wsol_account
                    .as_ref()
                    .ok_or(error!(DispatcherError::InvalidAccount))?;

                let expected_wsol_address = Pubkey::find_program_address(
                    &[
                        ctx.accounts.owner.key.as_ref(),
                        token_program_id().as_ref(),
                        native_mint::id().as_ref(),
                    ],
                    &associated_token_program_id(),
                )
                .0;

                require_eq!(
                    wsol_info.key,
                    expected_wsol_address,
                    DispatcherError::InvalidAccount,
                );

                if !wsol_info.data_is_empty() {
                    require_eq!(
                        wsol_info.owner,
                        &token_program_id(),
                        DispatcherError::InvalidAccount,
                    );
                }

                let mut wsol_account_info = wsol_info.clone();

                if wsol_account_info.data_is_empty() {
                    let create_ix = create_associated_token_account(
                        &ctx.accounts.owner.key(),
                        &ctx.accounts.owner.key(),
                        &native_mint::id(),
                    );

                    invoke(
                        &create_ix,
                        &[
                            ctx.accounts.owner.to_account_info(),
                            wsol_account_info.clone(),
                            ctx.accounts.owner.to_account_info(),
                            ctx.accounts.token_program.clone(),
                            ctx.accounts.system_program.to_account_info(),
                            ctx.accounts.rent.to_account_info(),
                            ctx.accounts.associated_token_program.clone(),
                        ],
                    )?;

                    created_wsol_account = true;
                }

                invoke(
                    &system_instruction::transfer(
                        &ctx.accounts.owner.key(),
                        &wsol_account_info.key(),
                        amount,
                    ),
                    &[
                        ctx.accounts.owner.to_account_info(),
                        wsol_account_info.clone(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                )?;

                invoke(
                    &sync_native(
                        &token_program_id(),
                        &wsol_account_info.key(),
                    )?,
                    &[
                        wsol_account_info.clone(),
                        ctx.accounts.token_program.clone(),
                    ],
                )?;

                wsol_account_info
            }
        };

        let mut account_metas = vec![
            AccountMeta::new(ctx.accounts.owner.key(), true),
            AccountMeta::new_readonly(
                ctx.accounts.deposit_instruction_config.key(),
                false,
            ),
            AccountMeta::new(user_source_liquidity_info.key(), false),
        ];

        let mut account_infos = vec![
            ctx.accounts.owner.to_account_info().clone(),
            ctx.accounts.deposit_instruction_config.clone(),
            user_source_liquidity_info.clone(),
        ];

        for account_info in ctx.remaining_accounts.iter() {
            if account_info.is_writable {
                account_metas.push(AccountMeta::new(
                    account_info.key(),
                    account_info.is_signer,
                ));
            } else {
                account_metas.push(AccountMeta::new_readonly(
                    account_info.key(),
                    account_info.is_signer,
                ));
            }
            account_infos.push(account_info.clone());
        }

        let mut data = Vec::with_capacity(8 + 8);
        data.extend_from_slice(&hash(b"global:adapter_deposit").to_bytes()[..8]);
        data.extend_from_slice(&amount.to_le_bytes());

        let instruction = Instruction {
            program_id: ctx.accounts.adapter_info.adapter_program_id,
            accounts: account_metas,
            data,
        };

        invoke(&instruction, &account_infos)?;

        if let DepositSource::Native = args.source {
            if created_wsol_account {
                let wsol_info = ctx.accounts.wsol_account.as_ref().unwrap().clone();
                let close_ix = close_account(
                    &token_program_id(),
                    &wsol_info.key(),
                    &ctx.accounts.owner.key(),
                    &ctx.accounts.owner.key(),
                    &[],
                )?;

                invoke(
                    &close_ix,
                    &[
                        wsol_info,
                        ctx.accounts.owner.to_account_info().clone(),
                        ctx.accounts.owner.to_account_info().clone(),
                        ctx.accounts.token_program.clone(),
                    ],
                )?;
            }
        }

        Ok(())
    }
}
