pub mod constants;
pub mod error;
pub mod event;
pub mod instructions;

use anchor_lang::prelude::*;

pub use constants::*;
pub use event::*;
pub use instructions::*;

declare_id!("7A1CFrXTEw96vdtsYPG1h5vhXbFCszaipfavL1XhgQKL");

#[program]
pub mod maple_adapter {
    use super::*;

    /// Submits a Maple Syrup deposit request through Chainlink CCIP.
    ///
    /// In the Maple adapter, `deposit` is implemented as a CCIP `ccip_send` call.
    /// The user sends USDC through the CCIP Router to the Maple receiver, where it
    /// is treated as a native mint/deposit request.
    ///
    /// `args.amount` is used for adapter-level accounting/events only.
    /// The actual CCIP token amount must be encoded inside `args.extra_data` as part
    /// of the serialized `CcipSendInstructionArgs.message.token_amounts`.
    ///
    /// `args.extra_data` format:
    /// - byte 0: adapter-local function selector, currently `0 = ccip_send`
    /// - bytes 1..: Borsh-serialized `CcipSendInstructionArgs` without the
    ///   8-byte `ccip_send` discriminator
    ///
    /// All CCIP Router accounts must be passed through `remaining_accounts` in the
    /// exact order required by the Chainlink CCIP Router program.
    pub fn adapter_deposit(
        ctx: Context<AdapterDeposit>,
        args: AdapterDepositArgs
    ) -> Result<()> {
        AdapterDeposit::adapter_deposit(ctx, args)
    }

    /// Submits a Maple Syrup withdrawal/redeem request through Chainlink CCIP.
    ///
    /// Withdraw uses the same CCIP Router `ccip_send` instruction as deposit.
    /// The difference is defined off-chain by the encoded CCIP message:
    /// - deposit flow sends USDC
    /// - withdraw/redeem flow sends syrupUSDC
    ///
    /// The adapter does not parse the full CCIP message on-chain. It validates the
    /// basic account layout and forwards the serialized CCIP args from
    /// `args.extra_data` to the CCIP Router.
    ///
    /// Like deposit, this instruction is asynchronous: it submits a cross-chain
    /// message and does not synchronously receive redeemed funds in the same
    /// transaction.
    pub fn adapter_withdraw(
        ctx: Context<AdapterWithdraw>,
        args: AdapterWithdrawArgs,
    ) -> Result<()> {
        AdapterWithdraw::adapter_withdraw(ctx, args)
    }

    /// Returns the user's current Maple Syrup exposure.
    ///
    /// For this adapter, `current_value` reads the user's syrupUSDC token account
    /// balance and returns it as a `u64` through Solana return data using the
    /// Yield Adapter Standard convention.
    ///
    /// Expected accounts:
    /// - `remaining_accounts[0]`: user's syrupUSDC token account
    ///
    /// This does not perform a CCIP call and does not wait for pending cross-chain
    /// messages. It only reports the currently available syrupUSDC balance on
    /// Solana.
    pub fn adapter_current_value(ctx: Context<AdapterCurrentValue>) -> Result<()> {
        AdapterCurrentValue::adapter_current_value(ctx)
    }
}
