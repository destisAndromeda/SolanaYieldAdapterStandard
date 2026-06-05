use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AdapterInfoInitArgs {
    /// Authority that can manage this adapter entry.
    pub authority: Pubkey,

    /// Adapter program id that will receive CPI requests.
    pub adapter_program_id: Pubkey,
}

#[derive(Accounts)]
pub struct AdapterInfoInit<'info> {
    /// Registry authority allowed to register adapters.
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority @ DispatcherError::Unauthorized,
    )]
    pub registry: Account<'info, Registry>,

    #[account(
        init,
        payer = authority,
        space = 8 + AdapterInfo::INIT_SPACE,
        seeds = [
            SEED_PREFIX,
            registry.key().as_ref(),
            SEED_ADAPTER_INFO,
            &registry.adapters_index.to_le_bytes(),
        ],
        bump,
    )]
    pub adapter_info: Account<'info, AdapterInfo>,

    #[account(
        seeds = [
            SEED_PREFIX,
            dispatcher.key().as_ref(),
            SEED_REGISTRY,
            registry.creator_key.as_ref(),
        ],
        bump = registry.bump,
    )]
    pub dispatcher: Account<'info, Dispatcher>,

    pub system_program: Program<'info, System>,
}

impl AdapterInfoInit<'_> {
    pub fn adapter_info_init(
        ctx: Context<Self>,
        args: AdapterInfoInitArgs,
    ) -> Result<()> {
        require_keys_neq!(
            args.authority,
            Pubkey::default(),
            DispatcherError::InvalidAccount,
        );

        require_keys_neq!(
            args.adapter_program_id,
            Pubkey::default(),
            DispatcherError::InvalidAccount,
        );

        let bump = ctx.bumps.adapter_info;

        ctx.accounts.adapter_info.set_inner(AdapterInfo {
            authority: args.authority,
            adapter_program_id: args.adapter_program_id,
            bump,
        });

        ctx.accounts.adapter_info.invariant()?;

        ctx.accounts.registry.adapters_index = ctx
            .accounts
            .registry
            .adapters_index
            .checked_add(1)
            .ok_or(error!(DispatcherError::InvalidAccount))?;

        Ok(())
    }
}
