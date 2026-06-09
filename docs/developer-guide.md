# How to Build Your Own Adapter

<!--
Source task: :contentReference[oaicite:0]{index=0}
Repository facts checked against public files including package.json, Anchor.toml, dispatcher state/instructions, and yield-adapter-interface.
-->

## Overview

An adapter is an Anchor program that implements the Solana Yield Adapter Standard interface:

* `adapter_deposit`
* `adapter_withdraw`
* `adapter_current_value`

The adapter is a thin translation layer between the protocol-agnostic dispatcher and a target protocol.

It receives:

* `amount`
* `extra_data`
* `remaining_accounts`

Then it either:

* builds a protocol-specific CPI instruction, or
* reads protocol-specific account data and returns a `u64` value through Solana return data.

Adapters do **not** custody funds. The dispatcher routes calls, injects the user signer, checks adapter status, and forwards accounts. The target protocol still validates its own accounts, signers, token ownership, markets, vaults, and invariants.

The full development flow is:

1. Choose target protocol and asset.
2. Study protocol docs, SDK, IDL, and real transactions.
3. Identify deposit, withdraw, and value-read semantics.
4. Define adapter account order.
5. Define `extra_data` format.
6. Implement adapter program.
7. Deploy adapter.
8. Register adapter in dispatcher.
9. Build client instructions through dispatcher.
10. Add tests.
11. Document account order and args.

## Prerequisites

Install and verify the required tooling.

The repository uses Yarn as the Anchor package manager and defines the following scripts in `package.json`:

```bash
yarn test:dispatcher
yarn test:fork:kamino
yarn test:fork:marginfi
yarn test:fork:jupiter
yarn test:fork:maple
yarn test:fork:drift
```

Repository versions and tested environment:

| Tool / Package      | Version                    |
| ------------------- | -------------------------- |
| Anchor CLI          | `1.0.2`                    |
| `anchor-lang`       | `1.0.2`                    |
| `anchor-spl`        | `1.0.2`                    |
| Solana CLI / Agave  | `4.0.0`                    |
| Rust toolchain      | `1.89.0`                   |
| Rust / SBPF         | `1.89.0-sbpf-solana-v1.53` |
| Node                | `20.20.2`                  |
| Package manager     | `yarn`                     |
| `@anchor-lang/core` | `^1.0.2`                   |
| `@solana/web3.js`   | `^1.98.4`                  |
| TypeScript          | `^5.7.3`                   |
| `tsx`               | `^4.22.4`                  |

Check your local versions:

```bash
anchor --version
solana --version
node --version
yarn --version
rustc --version
```

Install dependencies:

```bash
yarn install
```

Build the workspace:

```bash
anchor build
```

Run dispatcher tests:

```bash
yarn test:dispatcher
```

## Before You Write Code: Protocol Research Checklist

Do not start coding the adapter until you have collected the protocol information below.

Adapters are simple only after the account model is clear. Most adapter bugs come from wrong accounts, wrong account order, wrong discriminators, or incorrect assumptions about protocol value units.

## 1. Protocol Documentation Links

Create a research note for the new adapter:

```md
Protocol docs:
SDK docs:
IDL / generated SDK:
Program ID:
Main asset mint:
Example deposit transaction:
Example withdraw transaction:
Account layout docs:
Oracle / price docs if needed:
```

Use protocol docs, SDKs, IDLs, generated clients, and real mainnet transactions as the source of truth.

Do not invent account order.

## 2. Deposit Instruction

Identify:

* target program id;
* instruction name;
* 8-byte discriminator or SDK instruction builder;
* exact account order;
* writable accounts;
* signer accounts;
* user token accounts;
* protocol vault accounts;
* mint accounts;
* market / bank / reserve / pool accounts;
* oracle accounts;
* remaining accounts;
* instruction args.

Common protocol-specific args include:

* `amount`
* `market_index`
* `slippage_bps`
* `min_amount_out`
* `reduce_only`
* `pool_id`
* `receiver`
* `destination_chain_selector`
* protocol-specific flags or structs.

Write the deposit instruction down before implementing it.

## 3. Withdraw Instruction

Identify the same information for withdraw:

* target program id;
* instruction name;
* 8-byte discriminator or SDK instruction builder;
* exact account order;
* writable accounts;
* signer accounts;
* source token account;
* destination token account;
* protocol position account;
* market / bank / reserve / pool accounts;
* oracle accounts;
* instruction args.

Also check:

* Is withdraw immediate?
* Is withdraw staged?
* Is there a cooldown?
* Is there a request / claim flow?
* Does the protocol require an initialized position account?
* Does the protocol require a separate destination token account?
* Does the protocol require a different authority than deposit?

If withdraw is a two-step protocol flow, either:

* expose one selector per step, or
* document that the adapter only supports the request step.

## 4. `current_value` Semantics

Decide what account represents the user's position.

Questions:

* Is value stored directly in an SPL token account?
* Is value stored as shares?
* Is value stored as a scaled balance?
* Is value stored as LP amount?
* Is value stored as collateral?
* Are exchange rates needed?
* Are bank, reserve, pool, or oracle accounts needed?
* Can the adapter return exact token amount?
* Or can it only return raw protocol-native value?

The standard returns a single `u64`.

It does **not** require USD-denominated value.

You must document the returned unit honestly.

Examples from existing adapters:

| Adapter  | Returned `current_value` unit      |
| -------- | ---------------------------------- |
| Kamino   | Reserve `available_liquidity()`    |
| MarginFi | Raw protocol-native `asset_shares` |
| Jupiter  | Raw `locked_collateral`            |
| Maple    | syrupUSDC token account amount     |
| Drift    | Raw Drift scaled balance           |

## Adapter Interface

Every adapter must expose the standard entrypoints expected by the dispatcher:

```rust
pub fn adapter_deposit(
    ctx: Context<AdapterDeposit>,
    args: AdapterDepositArgs,
) -> Result<()>;

pub fn adapter_withdraw(
    ctx: Context<AdapterWithdraw>,
    args: AdapterWithdrawArgs>,
) -> Result<()>;

pub fn adapter_current_value(
    ctx: Context<AdapterCurrentValue>,
) -> Result<()>;
```

The common deposit / withdraw arguments are:

```rust
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AdapterDepositArgs {
    pub amount: u64,
    pub extra_data: Vec<u8>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AdapterWithdrawArgs {
    pub amount: u64,
    pub extra_data: Vec<u8>,
}
```

The reusable interface crate also defines dispatcher-facing argument types:

```rust
pub struct DepositArgs {
    pub amount: u64,
    pub extra_data: Vec<u8>,
}

pub struct WithdrawArgs {
    pub amount: u64,
    pub extra_data: Vec<u8>,
}
```

The dispatcher serializes the standard args and calls the adapter using these discriminators:

```rust
pub const ADAPTER_DEPOSIT_DISCRIMINATOR: [u8; 8] =
    [190, 207, 72, 186, 232, 106, 46, 72];

pub const ADAPTER_WITHDRAW_DISCRIMINATOR: [u8; 8] =
    [121, 55, 72, 46, 185, 100, 173, 236];

pub const ADAPTER_CURRENT_VALUE_DISCRIMINATOR: [u8; 8] =
    [67, 200, 59, 238, 163, 138, 170, 179];
```

Important rules:

* `amount` is standard.
* `extra_data` is adapter-specific.
* `extra_data` max length is `64` bytes at the dispatcher level.
* `adapter_current_value` has no standard args.
* `adapter_current_value` returns `u64` through Solana return data.

Return helper from the interface crate:

```rust
use yield_adapter_interface::set_return_u64;

set_return_u64(value);
```

## Recommended Adapter Project Layout

Existing adapters use this pattern:

```text
programs/<your-adapter>/
  Cargo.toml
  src/
    lib.rs
    constants.rs
    error.rs
    event.rs
    instructions/
      mod.rs
      adapter_deposit.rs
      adapter_withdraw.rs
      adapter_current_value.rs
```

File responsibilities:

| File                                    | Purpose                                                            |
| --------------------------------------- | ------------------------------------------------------------------ |
| `lib.rs`                                | Program declaration, `declare_id!`, instruction exports.           |
| `constants.rs`                          | Protocol program id, discriminators, offsets, limits, known mints. |
| `error.rs`                              | Adapter-specific errors.                                           |
| `event.rs`                              | Adapter-specific events.                                           |
| `instructions/adapter_deposit.rs`       | Deposit CPI translation.                                           |
| `instructions/adapter_withdraw.rs`      | Withdraw CPI translation.                                          |
| `instructions/adapter_current_value.rs` | Read-only value query and return data.                             |
| `instructions/mod.rs`                   | Re-exports instruction modules.                                    |

## Step 1: Create the Adapter Program

You can create a fresh Anchor program:

```bash
anchor new my-adapter
```

Inside this repository, the more practical path is usually to copy an existing adapter folder:

```bash
cp -r programs/kamino-adapter programs/my-adapter
```

Then rename:

* package name in `programs/my-adapter/Cargo.toml`;
* module names if needed;
* `declare_id!` in `src/lib.rs`;
* events and errors;
* constants;
* instruction logic.

Add the new program to `Anchor.toml`:

```toml
[programs.localnet]
my-adapter = "<YOUR_ADAPTER_PROGRAM_ID>"
```

The repository workspace already includes:

```toml
[workspace]
members = [
  "programs/*",
  "crates/*"
]
```

So a new folder under `programs/` is automatically included by Cargo if its `Cargo.toml` is valid.

Build after adding the program:

```bash
anchor build
```

## Step 2: Define Program ID and Constants

In `programs/my-adapter/src/lib.rs`:

```rust
use anchor_lang::prelude::*;

declare_id!("<YOUR_ADAPTER_PROGRAM_ID>");
```

In `programs/my-adapter/src/constants.rs`:

```rust
use anchor_lang::prelude::*;

pub const TARGET_PROTOCOL_PROGRAM: Pubkey = pubkey!("...");
pub const MIN_DEPOSIT_ACCOUNTS: usize = ...;
pub const MIN_WITHDRAW_ACCOUNTS: usize = ...;
pub const MIN_CURRENT_VALUE_ACCOUNTS: usize = 1;

pub const PROTOCOL_DEPOSIT_DISCRIMINATOR: [u8; 8] = [...];
pub const PROTOCOL_WITHDRAW_DISCRIMINATOR: [u8; 8] = [...];
```

How to get protocol discriminators:

1. Protocol IDL.
2. Generated SDK.
3. Protocol source code.
4. Protocol documentation.
5. Real transaction decoding.
6. Anchor sighash, only if the protocol is Anchor and the instruction name is confirmed.

Anchor discriminator formula:

```text
sha256("global:<instruction_name>")[0..8]
```

Example:

```text
sha256("global:adapter_deposit")[0..8]
```

Never guess discriminators.

A wrong discriminator may still build a transaction, but it will call the wrong instruction or fail inside the target program.

## Step 3: Define Account Order

Before writing Rust, create account tables.

### Deposit `remaining_accounts`

| Index | Account | Writable | Signer | Source           | Notes |
| ----: | ------- | -------- | ------ | ---------------- | ----- |
|     0 | ...     | yes/no   | yes/no | SDK / IDL / docs | ...   |

### Withdraw `remaining_accounts`

| Index | Account | Writable | Signer | Source           | Notes |
| ----: | ------- | -------- | ------ | ---------------- | ----- |
|     0 | ...     | yes/no   | yes/no | SDK / IDL / docs | ...   |

### Current value `remaining_accounts`

| Index | Account                       | Writable | Signer | Source              | Notes                  |
| ----: | ----------------------------- | -------- | ------ | ------------------- | ---------------------- |
|     0 | user position / token account | no       | no     | account layout docs | read-only value source |

The dispatcher automatically injects the user signer / authority as the first account in the adapter CPI.

That means client-side `remaining_accounts` should generally contain protocol-specific accounts only.

Do not duplicate the signer unless the target protocol instruction requires the signer to appear at a specific downstream account position.

The adapter receives:

```text
adapter account 0 = dispatcher-injected authority signer
adapter remaining_accounts = client-provided protocol accounts
```

The target protocol instruction receives whatever account metas your adapter builds.

Therefore the adapter account order must match your implementation exactly.

## Step 4: Define `extra_data` Format

`extra_data` is opaque to the dispatcher.

Recommended format:

```text
extra_data[0]   = adapter-local selector
extra_data[1..] = protocol-specific serialized args
```

Example documentation table:

| Byte range | Type  | Meaning          |
| ---------- | ----- | ---------------- |
| `0`        | `u8`  | selector         |
| `1..9`     | `u64` | `min_amount_out` |
| `9..11`    | `u16` | `market_index`   |

Use a selector-only format if the protocol only needs `amount`:

```text
extra_data = [0]
```

Use Borsh for complex args:

```rust
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MyExtraArgs {
    pub min_amount_out: u64,
    pub market_index: u16,
}
```

Decode safely:

```rust
let selector = *args
    .extra_data
    .first()
    .ok_or(AdapterError::InvalidExtraData)?;

match selector {
    0 => {
        // deposit path
    }
    1 => {
        // alternate path
    }
    _ => return err!(AdapterError::InvalidSelector),
}
```

Rules:

* Validate length before slicing.
* Reject unknown selectors.
* Document every selector.
* Keep `extra_data` stable once clients depend on it.
* Treat `extra_data` as adapter-versioned.

## Step 5: Implement `adapter_deposit`

A minimal adapter deposit instruction has this shape:

```rust
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke,
};

use crate::constants::*;
use crate::error::*;
use crate::event::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AdapterDepositArgs {
    pub amount: u64,
    pub extra_data: Vec<u8>,
}

#[derive(Accounts)]
pub struct AdapterDeposit<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
}

impl AdapterDeposit<'_> {
    fn validate(&self, args: &AdapterDepositArgs) -> Result<()> {
        require!(args.amount > 0, AdapterError::InvalidAmount);
        require!(
            !args.extra_data.is_empty(),
            AdapterError::InvalidExtraData
        );

        Ok(())
    }

    #[access_control(ctx.accounts.validate(&args))]
    pub fn adapter_deposit(
        ctx: Context<Self>,
        args: AdapterDepositArgs,
    ) -> Result<()> {
        require!(
            ctx.remaining_accounts.len() >= MIN_DEPOSIT_ACCOUNTS,
            AdapterError::NotEnoughAccounts
        );

        let selector = args.extra_data[0];

        let mut data = Vec::new();

        match selector {
            0 => {
                data.extend_from_slice(&PROTOCOL_DEPOSIT_DISCRIMINATOR);
                data.extend_from_slice(&args.amount.to_le_bytes());

                // Optional protocol-specific args after selector.
                data.extend_from_slice(&args.extra_data[1..]);
            }
            _ => return err!(AdapterError::InvalidSelector),
        }

        let accounts: Vec<AccountMeta> = ctx
            .remaining_accounts
            .iter()
            .map(|account| AccountMeta {
                pubkey: account.key(),
                is_signer: account.is_signer,
                is_writable: account.is_writable,
            })
            .collect();

        let ix = Instruction {
            program_id: TARGET_PROTOCOL_PROGRAM,
            accounts,
            data,
        };

        invoke(&ix, ctx.remaining_accounts)?;

        emit!(AdapterDepositEvent {
            authority: ctx.accounts.authority.key(),
            program_id: TARGET_PROTOCOL_PROGRAM,
            amount: args.amount,
        });

        Ok(())
    }
}
```

This follows the style used by existing adapters:

* validate authority and args;
* read selector from `extra_data[0]`;
* build protocol instruction data;
* convert `ctx.remaining_accounts` into `AccountMeta`;
* invoke target protocol;
* emit an adapter event.

Important:

The dispatcher already injected `authority` into the adapter call. If your downstream protocol needs the authority inside its own account list, make sure the adapter passes it in the correct target protocol position.

## Step 6: Implement `adapter_withdraw`

Withdraw is similar to deposit, but often has more protocol-specific behavior.

Watch for:

* destination token account;
* cooldown / request flow;
* claim flow;
* unstake flow;
* `min_amount_out`;
* slippage;
* market index;
* different authority requirements.

Skeleton:

```rust
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke,
};

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
    fn validate(&self, args: &AdapterWithdrawArgs) -> Result<()> {
        require!(args.amount > 0, AdapterError::InvalidAmount);
        require!(
            !args.extra_data.is_empty(),
            AdapterError::InvalidExtraData
        );

        Ok(())
    }

    #[access_control(ctx.accounts.validate(&args))]
    pub fn adapter_withdraw(
        ctx: Context<Self>,
        args: AdapterWithdrawArgs,
    ) -> Result<()> {
        require!(
            ctx.remaining_accounts.len() >= MIN_WITHDRAW_ACCOUNTS,
            AdapterError::NotEnoughAccounts
        );

        let selector = args.extra_data[0];

        let mut data = Vec::new();

        match selector {
            0 => {
                data.extend_from_slice(&PROTOCOL_WITHDRAW_DISCRIMINATOR);
                data.extend_from_slice(&args.amount.to_le_bytes());

                // Optional protocol-specific args after selector.
                data.extend_from_slice(&args.extra_data[1..]);
            }
            _ => return err!(AdapterError::InvalidSelector),
        }

        let accounts: Vec<AccountMeta> = ctx
            .remaining_accounts
            .iter()
            .map(|account| AccountMeta {
                pubkey: account.key(),
                is_signer: account.is_signer,
                is_writable: account.is_writable,
            })
            .collect();

        let ix = Instruction {
            program_id: TARGET_PROTOCOL_PROGRAM,
            accounts,
            data,
        };

        invoke(&ix, ctx.remaining_accounts)?;

        emit!(AdapterWithdrawEvent {
            authority: ctx.accounts.authority.key(),
            program_id: TARGET_PROTOCOL_PROGRAM,
            amount: args.amount,
        });

        Ok(())
    }
}
```

If the target protocol has a staged withdraw flow, expose selectors clearly:

| Selector | Meaning          |
| -------: | ---------------- |
|      `0` | request withdraw |
|      `1` | claim withdraw   |
|      `2` | cancel withdraw  |

Do not pretend a request instruction is a complete withdrawal if protocol settlement happens later.

## Step 7: Implement `adapter_current_value`

`adapter_current_value` is read-only.

It receives no standard args.

It reads protocol-specific account data and returns a `u64` through return data.

```rust
use anchor_lang::prelude::*;
use yield_adapter_interface::set_return_u64;

use crate::constants::*;
use crate::error::*;

#[derive(Accounts)]
pub struct AdapterCurrentValue<'info> {
    pub authority: Signer<'info>,
}

impl AdapterCurrentValue<'_> {
    pub fn adapter_current_value(ctx: Context<Self>) -> Result<()> {
        require!(
            ctx.remaining_accounts.len() >= MIN_CURRENT_VALUE_ACCOUNTS,
            AdapterError::NotEnoughAccounts
        );

        let value_account = &ctx.remaining_accounts[0];

        // Decode account data here.
        let value: u64 = 0;

        set_return_u64(value);

        Ok(())
    }
}
```

There are three common patterns.

## Pattern A: SPL Token Account Balance

Used by Maple-style adapters.

Use this when the position value is simply a token account amount.

```rust
use anchor_spl::token::TokenAccount;
use yield_adapter_interface::set_return_u64;

let token_account_info = &ctx.remaining_accounts[0];
let token_account = Account::<TokenAccount>::try_from(token_account_info)?;

set_return_u64(token_account.amount);
```

Return unit:

```text
base units of the SPL token account mint
```

Example:

```text
syrupUSDC amount in base units
```

## Pattern B: Typed Protocol SDK Account Decoding

Used by Kamino-style adapters when typed decoding is available.

```rust
let account = &ctx.remaining_accounts[0];
let data = account.try_borrow_data()?;

// Example only. Use the target protocol's real decoder.
let decoded = ProtocolAccount::try_from_bytes(&data)?;
let value = decoded.value();

set_return_u64(value);
```

Prefer this pattern when the protocol provides a stable Rust account type or SDK decoder.

## Pattern C: Offset-Based Read

Used when there is no stable typed account decoder or when the adapter intentionally reads a known field directly.

```rust
use yield_adapter_interface::set_return_u64;

fn read_u64_le(data: &[u8], offset: usize) -> Result<u64> {
    require!(
        data.len() >= offset + 8,
        AdapterError::AccountDataTooShort
    );

    let mut bytes = [0u8; 8];
    bytes.copy_from_slice(&data[offset..offset + 8]);

    Ok(u64::from_le_bytes(bytes))
}

let account = &ctx.remaining_accounts[0];
let data = account.try_borrow_data()?;
let value = read_u64_le(&data, VALUE_OFFSET)?;

set_return_u64(value);
```

Warnings:

* Offset-based reads are brittle.
* Account layouts can change.
* Always check account size before reading.
* Prefer protocol SDK decoding where possible.
* Document the exact returned unit.
* Do not label raw shares or scaled balances as token amounts.

The interface crate contains layout helpers/macros such as:

```rust
account_offset!
define_account_offsets!
```

Use them if they make offsets clearer.

## Step 8: Deploy the Adapter

Deployment happens **before** dispatcher registration.

Build all programs:

```bash
anchor build
```

Deploy the adapter:

```bash
anchor deploy --program-name <your-adapter>
```

Confirm the deployed program:

```bash
solana program show <YOUR_ADAPTER_PROGRAM_ID> --url devnet
```

Make sure `declare_id!` matches the deployed program id:

```rust
declare_id!("<YOUR_ADAPTER_PROGRAM_ID>");
```

Make sure `Anchor.toml` contains the same program id:

```toml
[programs.localnet]
my-adapter = "<YOUR_ADAPTER_PROGRAM_ID>"
```

Important:

* The dispatcher registry stores the adapter program id.
* If the adapter program id changes, the old registry entry points to the old program.
* If you reset local validator state, you must initialize registry and register adapters again.
* Do not register an adapter program that is not deployed or does not implement the expected entrypoints.

## Step 9: Register the Adapter in Dispatcher

Registration is separate from deployment.

After deploying the adapter, call dispatcher `adapter_init`.

Required data:

| Field            | Meaning                                             |
| ---------------- | --------------------------------------------------- |
| `authority`      | Adapter authority allowed to toggle adapter status. |
| `program_id`     | Deployed adapter program id.                        |
| `supported_mint` | Mint associated with this adapter entry.            |
| `status`         | Initial adapter status.                             |

Status values:

| Value | Status     |
| ----: | ---------- |
|   `0` | Active     |
|   `1` | Paused     |
|   `2` | Deprecated |

Only active adapters can be routed.

PDA derivation:

```ts
const [registryPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("dispatcher"), Buffer.from("registry")],
  dispatcher.programId,
);

const [adapterPda] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("dispatcher"),
    adapterProgramId.toBuffer(),
    Buffer.from("adapter_info"),
    adapterAuthority.toBuffer(),
  ],
  dispatcher.programId,
);
```

Example script using repository-style imports:

```ts
import * as anchor from "@anchor-lang/core";
import { PublicKey, SystemProgram } from "@solana/web3.js";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const dispatcher = anchor.workspace.Dispatcher;

const adapterProgramId = new PublicKey("<ADAPTER_PROGRAM_ID>");
const adapterAuthority = provider.wallet.publicKey;
const supportedMint = new PublicKey("<SUPPORTED_MINT>");
const status = 0; // Active

const [registryPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("dispatcher"), Buffer.from("registry")],
  dispatcher.programId,
);

const [adapterPda] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("dispatcher"),
    adapterProgramId.toBuffer(),
    Buffer.from("adapter_info"),
    adapterAuthority.toBuffer(),
  ],
  dispatcher.programId,
);

await dispatcher.methods
  .adapterInit({
    authority: adapterAuthority,
    programId: adapterProgramId,
    supportedMint,
    status,
  })
  .accounts({
    initializer: provider.wallet.publicKey,
    registry: registryPda,
    adapter: adapterPda,
    systemProgram: SystemProgram.programId,
  })
  .rpc();

console.log("adapter registered:", adapterPda.toBase58());
```

If the registry has not been initialized yet, initialize it first:

```ts
await dispatcher.methods
  .registryInit()
  .accounts({
    initializer: provider.wallet.publicKey,
    registry: registryPda,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

The dispatcher enforces that `registry_init` can only be called by the configured initializer.

## Step 10: Build Client Calls Through Dispatcher

Clients do not call adapters directly in the standard flow.

They call the dispatcher, and the dispatcher routes to the registered adapter.

## Deposit

```ts
import * as anchor from "@anchor-lang/core";
import { PublicKey } from "@solana/web3.js";

const amount = new anchor.BN(1_000_000); // example: 1 USDC if 6 decimals
const extraData = Buffer.from([0]); // selector 0

await dispatcher.methods
  .deposit({
    amount,
    extraData,
  })
  .accounts({
    signer: provider.wallet.publicKey,
    adapter: adapterPda,
  })
  .remainingAccounts(protocolAccounts)
  .rpc();
```

`protocolAccounts` must match your adapter's documented account order.

## Withdraw

```ts
const amount = new anchor.BN(1_000_000);
const extraData = Buffer.from([0]);

await dispatcher.methods
  .withdraw({
    amount,
    extraData,
  })
  .accounts({
    signer: provider.wallet.publicKey,
    adapter: adapterPda,
  })
  .remainingAccounts(protocolAccounts)
  .rpc();
```

## Current Value

`current_value` should normally be simulated off-chain.

```ts
const ix = await dispatcher.methods
  .currentValue()
  .accounts({
    authority: provider.wallet.publicKey,
    adapter: adapterPda,
  })
  .remainingAccounts(readOnlyValueAccounts)
  .instruction();

const tx = new anchor.web3.Transaction().add(ix);
tx.feePayer = provider.wallet.publicKey;
tx.recentBlockhash = (
  await provider.connection.getLatestBlockhash()
).blockhash;

const sim = await provider.connection.simulateTransaction(tx);
```

Decode return data as little-endian `u64`.

Example helper:

```ts
function decodeReturnU64(returnData: any): bigint {
  if (!returnData?.data?.[0]) {
    throw new Error("missing return data");
  }

  const raw = Buffer.from(returnData.data[0], "base64");

  if (raw.length < 8) {
    throw new Error("invalid return data");
  }

  return raw.readBigUInt64LE(0);
}
```

Use the exact simulation return-data shape used by your Solana web3 version.

## Step 11: Add Tests

A good adapter should have three layers of tests.

## 1. Dispatcher / Mock Tests

The repository already has dispatcher tests using a mock adapter.

These validate the standard dispatcher behavior:

* registry initialization;
* adapter registration;
* adapter status checks;
* signer forwarding;
* `deposit` routing;
* `withdraw` routing;
* `current_value` return data routing.

Run:

```bash
yarn test:dispatcher
```

## 2. Adapter Direct Tests

Optional but useful direct tests:

* invalid selector fails;
* empty `extra_data` fails;
* not enough accounts fails;
* account-size check fails safely;
* `current_value` reads expected test fixture data;
* instruction data is constructed correctly.

Direct tests are especially useful when protocol fork tests are slow.

## 3. Mainnet-Fork Tests

Recommended structure:

```text
tests/mainnet-fork/<adapter>/
  shared.ts
  discover-accounts.ts
  current-value.e2e.test.ts
  deposit.wiring.test.ts
  withdraw.wiring.test.ts

tests/scripts/test-fork-<adapter>.sh
```

### `shared.ts`

Contains shared helpers:

* provider setup;
* PDA derivation;
* adapter registration;
* return-data decoding;
* common public keys;
* account meta builders.

### `discover-accounts.ts`

Discovers or validates accounts required by the fork script.

Rules:

* print clone accounts to stdout;
* print diagnostics to stderr;
* read env vars;
* optionally use protocol SDK config;
* fail clearly when required accounts are missing.

### `test-fork-<adapter>.sh`

Starts local validator:

```bash
solana-test-validator \
  --reset \
  --url mainnet-beta \
  --clone <TARGET_PROGRAM_OR_ACCOUNT> \
  --clone <MARKET_OR_BANK_OR_RESERVE>
```

Then deploys local programs and runs tests.

### `current-value.e2e.test.ts`

Should:

* route through dispatcher;
* use a real cloned protocol account;
* simulate transaction;
* decode `u64` return data;
* assert the value is present and meaningful.

### `deposit.wiring.test.ts`

Should verify:

* dispatcher deposit instruction builds;
* adapter PDA is used;
* required protocol accounts are included;
* selector is preserved;
* protocol-specific args are preserved.

This test does not need to prove full protocol execution unless signer-controlled accounts and full protocol state are available.

### `withdraw.wiring.test.ts`

Same idea as deposit wiring.

Full write execution requires signer-controlled protocol accounts and should only be attempted when the developer has complete required state.

## Step 12: Mainnet-Fork Account Discovery

Mainnet-fork tests need many keys.

Template:

```bash
export TARGET_PROGRAM_ID=...
export TARGET_MARKET=...
export TARGET_USER_POSITION=...
export USER_TOKEN_ACCOUNT=...

yarn test:fork:<adapter>
```

Rules:

* protocol program id is usually fixed;
* markets, banks, reserves, and pools should come from SDK/config/docs;
* user position accounts must be real mainnet accounts for current-value e2e tests;
* signer-controlled token accounts are needed for full execution;
* if optional user account is missing, skip the account-dependent current-value e2e path;
* do not invent account keys.

Use:

* protocol SDK;
* protocol IDL;
* protocol docs;
* Solana Explorer;
* known transactions;
* existing test helpers.

## Existing Adapter Examples

## Kamino

Command:

```bash
yarn test:fork:kamino
```

Useful env:

```bash
export KAMINO_USDC_RESERVE=D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59
```

Known default:

```text
D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59
```

The Kamino fork script resolves market and oracle accounts dynamically from the reserve account.

## MarginFi

Command:

```bash
yarn test:fork:marginfi
```

Common env:

```bash
export MARGINFI_PROGRAM_ID=MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA
export MARGINFI_GROUP=...
export MARGINFI_USDC_BANK=...
export MARGINFI_ACCOUNT=...
export USER_USDC_ATA=...
export USER_USDC_DESTINATION_ATA=...
export BANK_LIQUIDITY_VAULT=...
export BANK_LIQUIDITY_VAULT_AUTHORITY=...
export TOKEN_PROGRAM=...
```

`MARGINFI_ACCOUNT` enables account-dependent current-value e2e coverage.

## Jupiter

Command:

```bash
yarn test:fork:jupiter
```

Common env:

```bash
export JUPITER_PROGRAM_ID=PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu
export JUPITER_POSITION_ACCOUNT=...
export JUPITER_POOL_ACCOUNT=...
export JUPITER_LP_MINT=...
export USER_LP_ATA=...
export USER_USDC_ATA=...
```

`JUPITER_POSITION_ACCOUNT` enables account-dependent current-value e2e coverage.

## Maple

Command:

```bash
yarn test:fork:maple
```

Common env:

```bash
export SYRUP_USDC_MINT=AvZZF1YaZDziPY2RCK4oJrRVrbN3mTD9NL24hPeaZeUj
export USER_SYRUP_USDC_ATA=...
export CCIP_SEND_ARGS_BASE64=...
export CCIP_CONFIG=...
export CCIP_DEST_CHAIN_STATE=...
export CCIP_NONCE=...
export CCIP_FEE_TOKEN_PROGRAM=...
export CCIP_FEE_TOKEN_MINT=...
export CCIP_FEE_TOKEN_USER_ATA=...
export CCIP_FEE_TOKEN_RECEIVER=...
export CCIP_FEE_BILLING_SIGNER=...
export CCIP_FEE_QUOTER=...
export CCIP_FEE_QUOTER_CONFIG=...
export CCIP_FEE_QUOTER_DEST_CHAIN=...
export CCIP_FEE_QUOTER_BILLING_TOKEN_CONFIG=...
export CCIP_FEE_QUOTER_LINK_TOKEN_CONFIG=...
export CCIP_RMN_REMOTE=...
export CCIP_RMN_REMOTE_CURSES=...
export CCIP_RMN_REMOTE_CONFIG=...
```

`USER_SYRUP_USDC_ATA` enables current-value e2e coverage.

`CCIP_SEND_ARGS_BASE64` is serialized CCIP instruction args, not a public key.

Full cross-chain settlement is outside local fork testing.

## Drift

Command:

```bash
yarn test:fork:drift
```

Common env:

```bash
export DRIFT_USER=...
export DRIFT_USER_STATS=...
export DRIFT_STATE=...
export DRIFT_USDC_SPOT_MARKET=...
export DRIFT_INSURANCE_FUND_STAKE=...
export USER_USDC_ATA=...
```

`DRIFT_USER` enables account-dependent current-value e2e coverage.

Insurance fund withdraw may require Drift's request / cooldown flow.

## Step 13: Document Your Adapter

Every adapter should include documentation.

Template:

```md
# <Protocol> Adapter

## Protocol

## Asset

## Program IDs

## Supported Mint

## Instructions

### Deposit

### Withdraw

### current_value

## extra_data

| Byte range | Type | Meaning |
| ---------- | ---- | ------- |

## Deposit Accounts

| Index | Account | Writable | Signer | Notes |
| ----: | ------- | -------- | ------ | ----- |

## Withdraw Accounts

| Index | Account | Writable | Signer | Notes |
| ----: | ------- | -------- | ------ | ----- |

## current_value Accounts

| Index | Account | Writable | Signer | Notes |
| ----: | ------- | -------- | ------ | ----- |

## Returned Value Unit

## Testing

## Environment Variables

## Limitations
```

Required documentation:

* target protocol;
* asset;
* adapter program id;
* target protocol program id;
* supported mint;
* deposit instruction;
* withdraw instruction;
* current-value source account;
* returned value unit;
* `extra_data` format;
* `remaining_accounts` order;
* required env vars for tests;
* known limitations.

Be honest.

If a test is only a wiring test, call it a wiring test.

If full execution requires signer-controlled protocol state, say so.

## Common Mistakes

## Registering Before Deploying

Wrong flow:

```text
register adapter -> deploy adapter
```

Correct flow:

```text
deploy adapter -> register adapter
```

The registry stores the adapter program id. Register only deployed adapter programs.

## Passing the Signer Twice

The dispatcher injects the signer into the adapter CPI.

Do not add the signer again unless the target protocol requires it at a specific downstream account index.

## Wrong `remaining_accounts` Order

The dispatcher does not parse protocol accounts.

If the account order is wrong, the adapter or target protocol will fail.

Write account tables before coding.

## Using Wallet Address Instead of Position Account

A wallet is not always the protocol user account.

Many protocols use separate accounts:

* obligation;
* lending account;
* bank account;
* position;
* user stats;
* stake account;
* LP position.

Use the real protocol position account for `current_value`.

## Treating Protocol-Native Value as USD

`current_value` returns a `u64`.

It may represent:

* token amount;
* raw shares;
* scaled balance;
* LP amount;
* collateral amount;
* available liquidity.

Do not label it USD unless the adapter actually computes USD value.

## Forgetting Oracle / Market / Bank Accounts

Mainnet-fork tests often need more than the user position account.

Protocols may require:

* market account;
* reserve account;
* bank account;
* oracle account;
* vault account;
* authority PDA;
* token program;
* associated token program.

Clone all required accounts.

## Hardcoding Accounts That Should Come From SDK

Hardcode only stable program ids or documented constants.

Markets, banks, reserves, pools, and user positions should usually come from:

* SDK config;
* IDL;
* docs;
* environment variables;
* known transaction analysis.

## Wrong Instruction Discriminator

Do not guess discriminators.

Use:

* IDL;
* generated SDK;
* source code;
* confirmed Anchor sighash.

## Unsafe `extra_data` Decoding

Bad:

```rust
let market_index = u16::from_le_bytes([
    args.extra_data[1],
    args.extra_data[2],
]);
```

Good:

```rust
require!(
    args.extra_data.len() >= 3,
    AdapterError::InvalidExtraData
);

let market_index = u16::from_le_bytes([
    args.extra_data[1],
    args.extra_data[2],
]);
```

## Expecting Cross-Chain Settlement in Local Fork Tests

A local fork can test CCIP instruction construction and account wiring.

It does not prove destination-chain settlement.

## Calling Wiring Tests Full Execution Tests

Wiring tests prove routing and instruction construction.

They do not always prove protocol state transition.

Use honest names:

```text
deposit wiring
withdraw wiring
current_value e2e
full execution
```

## Forgetting to Update `Anchor.toml`

If program id changes:

* update `declare_id!`;
* update `Anchor.toml`;
* rebuild;
* redeploy;
* re-register adapter.

## One-Day Implementation Plan

## Hour 0–1: Research Protocol

Collect:

* docs;
* SDK;
* IDL;
* program id;
* asset mint;
* account layouts;
* deposit transaction;
* withdraw transaction;
* user position account model.

Output:

```text
docs/research/<protocol>.md
```

## Hour 1–2: Define Standard Mapping

Map protocol behavior to:

* `adapter_deposit`;
* `adapter_withdraw`;
* `adapter_current_value`.

Define:

* `extra_data`;
* account order;
* returned value unit;
* known limitations.

Output:

```text
adapter account tables
extra_data table
current_value unit definition
```

## Hour 2–4: Implement Adapter

Add:

* `constants.rs`;
* `error.rs`;
* `event.rs`;
* `adapter_deposit.rs`;
* `adapter_withdraw.rs`;
* `adapter_current_value.rs`.

Build frequently:

```bash
anchor build
```

## Hour 4–5: Deploy Locally

Run:

```bash
anchor build
anchor deploy --program-name <your-adapter>
```

Verify program id:

```bash
solana program show <YOUR_ADAPTER_PROGRAM_ID>
```

## Hour 5–6: Register in Dispatcher

Initialize registry if needed.

Call:

```text
registry_init
adapter_init
```

Confirm adapter PDA and status.

## Hour 6–8: Write Client Calls

Build examples for:

* dispatcher `deposit`;
* dispatcher `withdraw`;
* dispatcher `current_value` simulation.

Use real account metas from protocol SDK / IDL.

## Hour 8–10: Add Tests

Add:

* invalid selector test;
* not enough accounts test;
* current-value test;
* deposit wiring test;
* withdraw wiring test.

Run:

```bash
yarn test:dispatcher
```

## Hour 10–12: Add Mainnet-Fork Script

Create:

```text
tests/scripts/test-fork-<adapter>.sh
tests/mainnet-fork/<adapter>/
```

Clone:

* target program;
* market / bank / reserve / pool;
* user position account;
* token accounts;
* oracle accounts.

Run:

```bash
yarn test:fork:<adapter>
```

## Hour 12–14: Document Adapter

Write:

* protocol summary;
* program ids;
* account tables;
* selectors;
* env vars;
* current-value unit;
* limitations.

## Hour 14–16: Cleanup and Review

Run:

```bash
anchor build
yarn test:dispatcher
yarn test:fork:<adapter>
```

Review:

* no fake keys documented as real;
* no overclaimed tests;
* account order matches code;
* `extra_data` length checks exist;
* current-value unit is honest.

## Final Checklist

Before submitting a new adapter:

* [ ] Adapter builds with `anchor build`.
* [ ] Adapter exposes `adapter_deposit`.
* [ ] Adapter exposes `adapter_withdraw`.
* [ ] Adapter exposes `adapter_current_value`.
* [ ] Adapter program is deployed.
* [ ] `declare_id!` matches deployed program id.
* [ ] `Anchor.toml` is updated.
* [ ] Adapter is registered with dispatcher.
* [ ] Adapter status is `Active`.
* [ ] Deposit route builds or executes.
* [ ] Withdraw route builds or executes.
* [ ] `current_value` returns `u64` via return data.
* [ ] `extra_data` format is documented.
* [ ] Unknown selectors are rejected.
* [ ] `extra_data` length is checked before slicing.
* [ ] `remaining_accounts` order is documented.
* [ ] Signer injection is understood and documented.
* [ ] Current-value unit is documented.
* [ ] Mainnet-fork script exists.
* [ ] Account discovery helper exists if needed.
* [ ] Tests distinguish wiring from full execution.
* [ ] Optional e2e tests skip cleanly when env accounts are missing.
* [ ] No fake account keys are documented as real.
* [ ] Limitations are honest.
