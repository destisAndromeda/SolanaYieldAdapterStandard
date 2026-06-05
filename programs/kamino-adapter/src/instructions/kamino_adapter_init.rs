use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::*;
use crate::constants::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct KaminoAdapterInitArgs {
    /// Public key for updating account content
    pub authority: Pubkey,

    /// Public key for subidiary PDA seeds
    pub creator_key: Pubkey,
}

#[derive(Accounts)]
pub struct KaminoAdapterInit<'info> {
    #[account(mut)]
    pub creator_key: Signer<'info>,

    #[account(
        init,
        payer = creator_key,
        space = 8 + KaminoAdapter::INIT_SPACE,
        seeds = [
            SEED_PREFIX,
            SEED_ADAPTER_CONFIG,
        ],
        bump,
    )]
    pub kamino_adapter: Account<'info, KaminoAdapter>,

    /// PDA address of config account contains only constant seeds
    #[account(
        has_one = creator_key @
            AdapterError::Unauthorized,
        seeds = [
            SEED_PREFIX,
            SEED_ADAPTER_CONFIG,
        ],
        bump = adapter_config.bump,
    )]
    pub adapter_config: Account<'info, KaminoAdapter>,

    pub system_program: Program<'info, System>,
}

// impl KaminoAdapterInit<'_> {
//     pub fn adapter_config_init(
//         ctx: Context<Self>,
//         args: KaminoAdapterInitArgs,
//     ) -> Result<()> {
//         let authority = args.authority;
//         let creator_key = args.creator_key;
//         let bump = ctx.bumps.adapter_config;

//         ctx.accounts.adapter_config.set_inner( KaminoAdapter {
//             authority,
//             creator_key,
//             bump,
//         });

//         ctx.accounts.adapter_config.invariant()?;

//         Ok(())
//     }
// }