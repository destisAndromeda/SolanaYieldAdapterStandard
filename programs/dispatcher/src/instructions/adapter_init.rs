use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::*;
use crate::state::*;
use yield_adapter_interface::AdapterStatus;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AdapterInitArgs {
    /// Authority that can update account state
    pub authority: Pubkey,

    /// Adapter program id that will receive CPI requests.
    pub program_id: Pubkey,

    /// Mint supported by this adapter entry.
    pub supported_mint: Pubkey,

    /// Initial adapter status encoded as AdapterStatus.
    pub status: u8,
}

#[derive(Accounts)]
#[instruction(args: AdapterInitArgs)]
pub struct AdapterInit<'info> {
    /// Registry authority allowed to register adapters.
    #[account(mut)]
    pub initializer: Signer<'info>,

    #[account(
        init,
        payer = initializer,
        space = 8 + Adapter::INIT_SPACE,
        seeds = [
            SEED_PREFIX,
            args.program_id.as_ref(),
            SEED_ADAPTER,
            args.authority.as_ref(),
        ],
        bump,
    )]
    pub adapter: Account<'info, Adapter>,

    #[account(
        has_one = initializer
            @ DispatcherError::Unauthorized,
        seeds = [
            SEED_PREFIX,
            SEED_REGISTRY,
        ],
        bump  = registry.bump,
    )]
    pub registry: Account<'info, Registry>,

    pub system_program: Program<'info, System>,
}

impl AdapterInit<'_> {
    pub fn validate(args: &AdapterInitArgs) -> Result<()> {
        let status = args.status;

        require!(
            AdapterStatus::from_u8(status).is_some(),
            DispatcherError::InvalidStatus,
        );

        Ok(())
    }

    #[access_control(Self::validate(&args))]
    pub fn adapter_init(ctx: Context<Self>, args: AdapterInitArgs) -> Result<()> {
        let authority = args.authority;
        let program_id = args.program_id;
        let supported_mint = args.supported_mint;
        let status = args.status;
        let registered_at = Clock::get()?.unix_timestamp;
        let bump = ctx.bumps.adapter;

        ctx.accounts.adapter.set_inner(Adapter {
            authority,
            program_id,
            supported_mint,
            status,
            registered_at,
            bump,
        });

        ctx.accounts.adapter.invariant()?;

        Ok(())
    }
}
