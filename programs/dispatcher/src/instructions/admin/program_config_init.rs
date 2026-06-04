use anchor_lang::prelude::*;
use crate::state::admin::*;
use crate::constants::*;
use crate::error::*;

/// This key is intended to use for the single transaction that initializes the global program config
/// It is not used for anything else.
#[cfg(not(feature = "testing"))]
const INITIALIZER: Pubkey = pubkey!("GtmrJehR49tXwFh7W4x2kGy61czbEboYSkHQDJw7Ggeb");

#[cfg(feature = "testing")]
const INITIALIZER: Pubkey = pubkey!("GAe1b8H1eUQhGuwAEJKstXLFdpaoHp9voszu1uw46Htm");

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ProgramConfigInitArgs {
    /// Key that can init subsidiary accounts
    pub creator_key: Pubkey,
}

#[derive(Accounts)]
pub struct ProgramConfigInit<'info> {
    /// The hard-coded account that is used to initialize the program config once
    #[account(
        mut,
        address = INITIALIZER @
            DispatcherError::InvalidAccount,
    )]
    pub initializer: Signer<'info>,

    #[account(
        init,
        payer = initializer,
        space = 8 + ProgramConfig::INIT_SPACE,
        seeds = [
            SEED_PREFIX,
            SEED_PROGRAM_CONFIG,
        ],
        bump,
    )]
    pub program_config: Account<'info, ProgramConfig>,

    pub system_program: Program<'info, System>,
}
impl ProgramConfigInit<'_> {
    /// A one-time instruction that initializes the global program config.
    pub fn program_config_init(
        ctx: Context<Self>,
        args: ProgramConfigInitArgs,
    ) -> Result<()> {
        let owner = ctx.accounts.initializer.key();
        let creator_key = args.creator_key;
        let _reserved: [u8;64] = [0u8; 64];
        let bump = ctx.bumps.program_config;

        ctx.accounts.program_config.set_inner( ProgramConfig {
            owner,
            creator_key,
            _reserved,
            bump,
        });

        ctx.accounts.program_config.invariant()?;

        Ok(())
    }
}