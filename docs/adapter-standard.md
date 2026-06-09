# Solana Yield Adapter Standard

## Status

Draft / Reference Implementation

This document specifies the reference implementation of a Solana Yield Adapter Standard for the `SolanaYieldAdapterStandard` repository.

This implementation is intended as a bounty submission and reference design, not as a finalized ecosystem standard. The repository contains a protocol-agnostic dispatcher, an on-chain registry, a reusable adapter interface crate, five reference adapters, dispatcher tests with a mock adapter, and adapter-specific mainnet-fork tests.

## Abstract

Solana yield protocols expose different instructions, accounts, account layouts, signer requirements, and accounting models. A lending market, an LP position, an insurance fund stake, and a cross-chain yield asset cannot be safely hidden behind a single universal Solana instruction without losing important protocol-specific account semantics.

The Solana Yield Adapter Standard defines a small common adapter interface:

* `deposit`
* `withdraw`
* `current_value`

A dispatcher program routes user calls into registered adapters. The dispatcher does not know protocol-specific instructions, account layouts, discriminators, or value units. Each adapter translates the common interface into protocol-specific CPIs or read-only account queries.

## Motivation

Every Solana yield, lending, LP, and derivatives protocol has its own account model. Kamino, MarginFi, Jupiter, Maple via CCIP, and Drift each require different accounts, instruction discriminators, serialized arguments, and value interpretation.

Without a common interface, integrators must build separate routing logic for every protocol. However, placing all protocol-specific logic inside one dispatcher would make the dispatcher brittle, difficult to audit, and hard to extend.

This standard uses a thin adapter model:

* the dispatcher enforces routing, registration, adapter status, authority forwarding, and a common ABI;
* adapters translate the common ABI into protocol-specific CPIs or account reads;
* clients or SDKs provide protocol-specific `remaining_accounts`;
* protocol programs remain responsible for validating their own invariants.

The design is inspired by ERC-4626, which standardizes vault interactions on Ethereum. Solana requires a different design because Solana instructions are account-explicit. Protocol-specific account metas cannot be hidden behind a single contract call without either losing correctness or making the dispatcher protocol-specific.

## Goals

The goals of this standard are:

* Provide a minimal common interface for Solana yield adapters.
* Keep the dispatcher protocol-agnostic.
* Avoid protocol-specific logic in the dispatcher.
* Support heterogeneous protocols, including:

  * lending markets;
  * LP positions;
  * insurance fund staking;
  * cross-chain yield assets.
* Allow account metas to be supplied by clients, SDKs, IDLs, or protocol-specific helpers.
* Allow adapter-specific serialized arguments through `extra_data`.
* Support read-only `current_value` queries through Solana return data.
* Support registry-gated adapter activation and pausing.
* Make adapters easy to implement, test, isolate, and audit.

## Non-Goals

This standard does not:

* Define a universal accounting unit for every protocol.
* Require all adapters to return USD-denominated value.
* Custody user funds.
* Replace protocol-level validation.
* Guarantee full protocol execution for all adapters in local fork tests.
* Abstract away all protocol accounts.
* Define cross-chain settlement semantics for Maple / CCIP.
* Require the dispatcher to know protocol instruction discriminators.
* Define a risk engine, liquidation engine, oracle model, or quote model.

## Terminology

**Dispatcher**

The protocol-agnostic Anchor program that exposes `deposit`, `withdraw`, and `current_value` and routes calls to registered adapters.

**Adapter**

An Anchor program that implements the standard adapter interface and translates dispatcher calls into protocol-specific CPIs or read-only account reads.

**Registry**

The on-chain dispatcher state that stores the global registry authority.

**Adapter Program**

The on-chain dispatcher account storing metadata for a registered adapter program. In code this account is named `Adapter`.

**Authority / Signer**

The user or controlling signer that calls the dispatcher. The dispatcher injects this signer as the first account in adapter CPIs.

**Supported Mint**

The mint associated with an adapter registration. The dispatcher stores this value but does not enforce protocol-specific token semantics.

**Remaining Accounts**

The protocol-specific accounts passed through the dispatcher to the adapter.

**extra_data**

Opaque adapter-defined bytes passed to `deposit` and `withdraw`.

**Protocol-native value**

A value returned by an adapter in the protocol’s own accounting format. It may be raw token units, shares, scaled balances, locked collateral, available liquidity, or another adapter-documented unit.

**Wiring Test**

A test that verifies dispatcher routing, account forwarding, instruction construction, adapter invocation, and `extra_data` preservation. It does not necessarily prove full protocol execution.

**Mainnet-Fork Test**

A test run against `solana-test-validator --url mainnet-beta` with selected mainnet accounts cloned into the local validator.

**Current Value**

A read-only adapter query that returns a `u64` through Solana return data.

**CPI Translation Layer**

The adapter logic that builds a protocol-specific instruction from the standard adapter call.

## Deployments

| Network | Program    | Address                                        |
| ------- | ---------- | ---------------------------------------------- |
| Devnet  | Dispatcher | `2mYCSzV1J6XKZmd8n1NWcr2NuRYqVtP6tFC7YWPj6ZXU` |

The same dispatcher program id is also declared in `Anchor.toml` for localnet.

## Specification

### Dispatcher Interface

The dispatcher exposes six public instructions:

* `registry_init`
* `adapter_init`
* `toggle_adapter`
* `deposit`
* `withdraw`
* `current_value`

### `registry_init`

Initializes the global registry PDA.

#### Purpose

Creates the dispatcher registry account and records the authorized initializer.

#### Accounts

| Account          | Type                | Description                                                |
| ---------------- | ------------------- | ---------------------------------------------------------- |
| `initializer`    | `Signer`            | Must match the configured `INITIALIZER` public key.        |
| `registry`       | `Account<Registry>` | PDA initialized with seeds `[b"dispatcher", b"registry"]`. |
| `system_program` | `Program<System>`   | Required for account creation.                             |

#### Behavior

The instruction:

1. Verifies that `initializer` equals the configured `INITIALIZER`.
2. Creates the `Registry` PDA.
3. Stores:

   * `initializer`
   * `bump`
4. Runs the registry invariant check.

#### Failure Cases

* `Unauthorized` if the signer is not the configured initializer.
* `InvalidAccount` if the stored initializer is the default public key.
* Standard Anchor account initialization errors.

#### Events

No event is emitted.

### `adapter_init`

Registers a new adapter.

#### Arguments

```rust
pub struct AdapterInitArgs {
    pub authority: Pubkey,
    pub program_id: Pubkey,
    pub supported_mint: Pubkey,
    pub status: u8,
}
```

`status` is encoded as `AdapterStatus`:

| Value | Status       |
| ----: | ------------ |
|   `0` | `Active`     |
|   `1` | `Paused`     |
|   `2` | `Deprecated` |

#### Accounts

| Account          | Type                | Description                                |
| ---------------- | ------------------- | ------------------------------------------ |
| `initializer`    | `Signer`            | Registry initializer.                      |
| `adapter`        | `Account<Adapter>`  | Adapter Program PDA.                       |
| `registry`       | `Account<Registry>` | Registry PDA with `has_one = initializer`. |
| `system_program` | `Program<System>`   | Required for account creation.             |

The adapter PDA uses seeds:

```text
[
  b"dispatcher",
  adapter_program_id,
  b"adapter_info",
  adapter_authority
]
```

#### Behavior

The instruction:

1. Verifies that `status` maps to a valid `AdapterStatus`.
2. Verifies that the registry belongs to the signer through `has_one = initializer`.
3. Creates the Adapter Program PDA.
4. Stores:

   * `authority`
   * `program_id`
   * `supported_mint`
   * `status`
   * `registered_at`
   * `bump`
5. Runs the adapter invariant check.

#### Failure Cases

* `Unauthorized` if the registry initializer does not match.
* `InvalidStatus` if `status` is not `0`, `1`, or `2`.
* `InvalidAccount` if `authority`, `program_id`, or `supported_mint` is the default public key.
* Standard Anchor PDA or account initialization errors.

#### Events

No event is emitted.

### `toggle_adapter`

Toggles an adapter between active and paused.

#### Accounts

| Account     | Type               | Description                     |
| ----------- | ------------------ | ------------------------------- |
| `authority` | `Signer`           | Must match `adapter.authority`. |
| `adapter`   | `Account<Adapter>` | Adapter Program PDA.            |

#### Behavior

The instruction:

1. Verifies `authority` using `has_one = authority`.
2. Reads the current adapter status.
3. Changes:

   * `Active` to `Paused`
   * `Paused` to `Active`
4. Rejects `Deprecated`.
5. Emits `ToggleEvent`.

#### Failure Cases

* `Unauthorized` if the signer is not the adapter authority.
* `InvalidStatus` if the stored status byte is invalid.
* `Deprecated` if the adapter is deprecated.

#### Events

```rust
pub struct ToggleEvent {
    pub authority: Pubkey,
    pub adapter: Pubkey,
    pub program_id: Pubkey,
    pub status: u8,
}
```

### `deposit`

Routes a deposit request into an active adapter.

#### Arguments

```rust
pub struct DepositArgs {
    pub amount: u64,
    pub extra_data: Vec<u8>,
}
```

#### Accounts

| Account              | Type               | Description                                          |
| -------------------- | ------------------ | ---------------------------------------------------- |
| `signer`             | `Signer`           | User authority. Forwarded into adapter CPI.          |
| `adapter`            | `Account<Adapter>` | Adapter Program PDA.                                 |
| `remaining_accounts` | dynamic            | Protocol-specific accounts forwarded to the adapter. |

#### Behavior

The instruction:

1. Verifies that the adapter status is `Active`.
2. Verifies that `extra_data.len() <= EXTRA_DATA_MAX_LEN`.
3. Borsh-serializes `DepositArgs`.
4. Prepends the standard `adapter_deposit` discriminator.
5. Builds an instruction targeting `adapter.program_id`.
6. Injects the user signer as the first account.
7. Appends all dispatcher `remaining_accounts`.
8. Invokes the adapter program.
9. Emits `DepositEvent`.

The dispatcher does not inspect protocol accounts and does not know the target protocol instruction discriminator.

#### Failure Cases

* `Inactive` if the adapter is not active.
* `Overflow` if `extra_data` exceeds `EXTRA_DATA_MAX_LEN`.
* Standard CPI, account, or protocol errors from the adapter or downstream protocol.

#### Events

```rust
pub struct DepositEvent {
    pub authority: Pubkey,
    pub program_id: Pubkey,
    pub amount: u64,
}
```

### `withdraw`

Routes a withdrawal request into an active adapter.

#### Arguments

```rust
pub struct WithdrawArgs {
    pub amount: u64,
    pub extra_data: Vec<u8>,
}
```

#### Accounts

| Account              | Type               | Description                                          |
| -------------------- | ------------------ | ---------------------------------------------------- |
| `signer`             | `Signer`           | User authority. Forwarded into adapter CPI.          |
| `adapter`            | `Account<Adapter>` | Adapter Program PDA.                                 |
| `remaining_accounts` | dynamic            | Protocol-specific accounts forwarded to the adapter. |

#### Behavior

The instruction:

1. Verifies that the adapter status is `Active`.
2. Verifies that `extra_data.len() <= EXTRA_DATA_MAX_LEN`.
3. Borsh-serializes `WithdrawArgs`.
4. Prepends the standard `adapter_withdraw` discriminator.
5. Builds an instruction targeting `adapter.program_id`.
6. Injects the user signer as the first account.
7. Appends all dispatcher `remaining_accounts`.
8. Invokes the adapter program.
9. Emits `WithdrawEvent`.

#### Failure Cases

* `Inactive` if the adapter is not active.
* `Overflow` if `extra_data` exceeds `EXTRA_DATA_MAX_LEN`.
* Standard CPI, account, or protocol errors from the adapter or downstream protocol.

#### Events

```rust
pub struct WithdrawEvent {
    pub authority: Pubkey,
    pub program_id: Pubkey,
    pub amount: u64,
}
```

### `current_value`

Routes a read-only value query into an active adapter.

#### Accounts

| Account              | Type               | Description                                               |
| -------------------- | ------------------ | --------------------------------------------------------- |
| `authority`          | `Signer`           | User authority. Forwarded into adapter CPI.               |
| `adapter`            | `Account<Adapter>` | Adapter Program PDA.                                      |
| `remaining_accounts` | dynamic            | Protocol-specific read accounts forwarded to the adapter. |

#### Behavior

The instruction:

1. Verifies that the adapter status is `Active`.
2. Builds an instruction targeting `adapter.program_id`.
3. Uses the standard `adapter_current_value` discriminator.
4. Injects the user authority as the first account.
5. Appends all dispatcher `remaining_accounts`.
6. Invokes the adapter.
7. Reads a `u64` from Solana return data.
8. Sets the same `u64` as dispatcher return data.

This allows clients to simulate the dispatcher instruction and read the returned value without the dispatcher knowing the protocol-specific account layout.

#### Failure Cases

* `Inactive` if the adapter is not active.
* `MissingReturnData` if the adapter does not set return data.
* `InvalidReturnData` if fewer than 8 bytes are returned.
* Standard CPI, account, or protocol errors from the adapter.

#### Events

No dispatcher event is emitted by `current_value`. Adapters may emit adapter-specific current value events.

## Standard Adapter Interface

Every adapter should expose the following Anchor instructions:

```rust
pub fn adapter_deposit(ctx: Context<AdapterDeposit>, args: AdapterDepositArgs) -> Result<()>;

pub fn adapter_withdraw(ctx: Context<AdapterWithdraw>, args: AdapterWithdrawArgs) -> Result<()>;

pub fn adapter_current_value(ctx: Context<AdapterCurrentValue>) -> Result<()>;
```

### Deposit / Withdraw Arguments

```rust
pub struct AdapterDepositArgs {
    pub amount: u64,
    pub extra_data: Vec<u8>,
}

pub struct AdapterWithdrawArgs {
    pub amount: u64,
    pub extra_data: Vec<u8>,
}
```

The dispatcher uses the same Borsh layout as the adapter expects.

### Current Value Arguments

`adapter_current_value` has no standard serialized arguments. It uses `remaining_accounts` and returns a `u64` through Solana return data.

### Standard Discriminators

The reusable interface crate defines the standard adapter entrypoint discriminators:

| Entrypoint              | Discriminator                            |
| ----------------------- | ---------------------------------------- |
| `adapter_deposit`       | `[190, 207, 72, 186, 232, 106, 46, 72]`  |
| `adapter_withdraw`      | `[121, 55, 72, 46, 185, 100, 173, 236]`  |
| `adapter_current_value` | `[67, 200, 59, 238, 163, 138, 170, 179]` |

`EXTRA_DATA_MAX_LEN` is `64` bytes.

## `extra_data` Format

`extra_data` is adapter-defined.

The dispatcher treats `extra_data` as opaque bytes and preserves it exactly when forwarding calls into adapters.

For adapters that support multiple downstream protocol instructions, the current reference implementation commonly uses:

```text
extra_data[0]   = adapter-local selector
extra_data[1..] = protocol-specific serialized arguments
```

Adapters are responsible for:

* checking that `extra_data` is not empty when a selector is required;
* validating minimum length before slicing;
* decoding bytes safely;
* documenting the meaning of each selector.

### Kamino

The Kamino adapter uses `extra_data[0]` as a selector.

Deposit selectors:

| Selector | Downstream instruction                                   |
| -------: | -------------------------------------------------------- |
|      `0` | `deposit_reserve_liquidity_and_obligation_collateral_v2` |
|      `1` | `deposit_reserve_liquidity`                              |
|      `2` | `deposit_obligation_collateral_v2`                       |
|      `3` | `deposit_and_withdraw`                                   |

Withdraw selectors:

| Selector | Downstream instruction                                            |
| -------: | ----------------------------------------------------------------- |
|      `0` | `withdraw_obligation_collateral_and_redeem_reserve_collateral_v2` |
|      `1` | `redeem_reserve_collateral`                                       |
|      `2` | `deposit_and_withdraw`                                            |

For most Kamino instructions the adapter prepends the Kamino discriminator and appends `amount` as little-endian `u64`. For selector paths that require additional arguments, bytes after the selector are forwarded as protocol-specific data.

### MarginFi

The MarginFi adapter uses `extra_data[0]` as a selector.

| Flow     | Selector | Downstream instruction     |
| -------- | -------: | -------------------------- |
| Deposit  |      `0` | `lending_account_deposit`  |
| Withdraw |      `0` | `lending_account_withdraw` |

The adapter prepends the MarginFi instruction discriminator and serializes the required protocol-specific arguments.

### Jupiter

The Jupiter adapter uses `extra_data[0]` as a selector.

Deposit selectors:

| Selector | Downstream instruction        |
| -------: | ----------------------------- |
|      `0` | `depositCollateralForBorrows` |
|      `1` | `addLiquidity2`               |

Withdraw selectors:

| Selector | Downstream instruction         |
| -------: | ------------------------------ |
|      `0` | `withdrawCollateralForBorrows` |
|      `1` | `removeLiquidity`              |

The current adapter targets the Jupiter program id `PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu`.

### Maple Syrup via Chainlink CCIP

The Maple adapter uses `extra_data[0]` as a selector.

| Selector | Downstream instruction            |
| -------: | --------------------------------- |
|      `0` | Chainlink CCIP Router `ccip_send` |

Format:

```text
extra_data[0]   = 0
extra_data[1..] = Borsh-serialized CcipSendInstructionArgs without the 8-byte ccip_send discriminator
```

The adapter prepends the `ccip_send` discriminator internally.

`args.amount` is adapter-level metadata for events. The actual CCIP token amount must be encoded inside the serialized CCIP message.

### Drift

The Drift adapter uses `extra_data[0]` as a selector.

Deposit selectors:

| Selector | Downstream instruction            |
| -------: | --------------------------------- |
|      `0` | `deposit`                         |
|      `1` | `add_insurance_fund_stake`        |
|      `2` | `initialize_insurance_fund_stake` |

Withdraw selectors:

| Selector | Downstream instruction                |
| -------: | ------------------------------------- |
|      `0` | `withdraw`                            |
|      `1` | `request_remove_insurance_fund_stake` |
|      `2` | `remove_insurance_fund_stake`         |

For Drift deposit / withdraw selector `0`:

```text
extra_data[1..3] = market_index: u16
extra_data[3]    = reduce_only: bool
```

The adapter places `amount` into the downstream Drift instruction data according to the current implementation.

## `remaining_accounts` Semantics

`remaining_accounts` carry protocol-specific accounts.

The dispatcher does not parse or validate protocol account order. It only forwards accounts to the adapter after injecting the signer / authority as the first adapter CPI account.

The adapter decides how to interpret the remaining account order.

Clients should generate `remaining_accounts` from one of:

* protocol SDKs;
* protocol IDLs;
* protocol documentation;
* adapter-specific helper scripts;
* tested account lists.

Because the dispatcher injects the signer / authority into the adapter CPI, client-side `remaining_accounts` should generally contain protocol-specific accounts only. If a downstream protocol requires the signer to appear again at a specific protocol account index, the client or adapter must account for that explicitly.

## Signer / Authority Rule

The user signs the dispatcher instruction.

The dispatcher forwards the user signer into the adapter CPI as the first account.

Adapters should:

* verify signer presence when required;
* reject default or unexpected authorities;
* validate protocol-specific signer position when the downstream protocol requires it;
* never trust arbitrary `remaining_accounts` without minimum validation.

Protocols still validate their own account constraints during CPI. The adapter does not replace downstream protocol security checks.

## Return Data Format

`current_value` returns a `u64` encoded in little-endian format through Solana return data.

Adapters set return data using:

```rust
set_return_u64(value)
```

The dispatcher reads the adapter return data, decodes the first 8 bytes as a little-endian `u64`, and sets that same value as dispatcher return data.

Returned value is adapter-specific and may be protocol-native.

| Adapter  | Current returned unit                                                   |
| -------- | ----------------------------------------------------------------------- |
| Kamino   | Reserve `available_liquidity()` from the Kamino reserve account.        |
| MarginFi | Raw `asset_shares` read from a MarginFi account and truncated to `u64`. |
| Jupiter  | Raw `locked_collateral` from a Jupiter `BorrowPosition` account.        |
| Maple    | SPL token amount from the user’s syrupUSDC token account.               |
| Drift    | Raw Drift `User.spot_positions[0].scaled_balance`.                      |

Adapters must document the unit they return. Integrators must not assume that `current_value` is USD-denominated or directly comparable across adapters.

## Registry Specification

### Registry Account

```rust
pub struct Registry {
    pub initializer: Pubkey,
    pub bump: u8,
}
```

The registry PDA uses seeds:

```text
[b"dispatcher", b"registry"]
```

The registry initializer is the authority allowed to register adapters.

### Adapter Program Account

```rust
pub struct Adapter {
    pub authority: Pubkey,
    pub program_id: Pubkey,
    pub supported_mint: Pubkey,
    pub status: u8,
    pub registered_at: i64,
    pub bump: u8,
}
```

The adapter PDA uses seeds:

```text
[
  b"dispatcher",
  adapter.program_id,
  b"adapter_info",
  adapter.authority
]
```

### Adapter Status

```rust
pub enum AdapterStatus {
    Active,
    Paused,
    Deprecated,
}
```

Encoded values:

| Value | Status       | Meaning                                             |
| ----: | ------------ | --------------------------------------------------- |
|   `0` | `Active`     | Dispatcher may route calls.                         |
|   `1` | `Paused`     | Dispatcher must reject calls.                       |
|   `2` | `Deprecated` | Adapter cannot be toggled back by `toggle_adapter`. |

The dispatcher checks adapter status before routing `deposit`, `withdraw`, and `current_value`.

The registry provides a governance and security boundary: only registered active adapters can receive dispatcher-routed calls.

## Reference Adapters

## Kamino USDC Adapter

### Protocol

Kamino KLend.

### Asset

USDC.

### Adapter Program

`BaxHrSyiFkoS4on2HmmEBCAL7BwMfXnZarpHNx6V3GrT`

### Known Constants

| Name                        | Public Key                                     |
| --------------------------- | ---------------------------------------------- |
| Kamino KLend Program        | `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD`  |
| USDC Mint                   | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| Default Kamino USDC Reserve | `D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59` |

### Behavior

The Kamino adapter supports multiple KLend deposit and withdraw paths selected by `extra_data[0]`.

`current_value` expects:

```text
remaining_accounts[0] = Kamino Reserve account
```

It decodes the Kamino `Reserve` account and returns `reserve.available_liquidity()`.

### Testing

Command:

```bash
yarn test:fork:kamino
```

Optional environment variable:

```bash
KAMINO_USDC_RESERVE
```

If not provided, the fork script uses:

```text
D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59
```

The fork script resolves the Kamino market and oracle accounts from the reserve account and clones them into the local validator.

Full write execution may require complete Kamino user obligation, token account, reserve, market, and oracle state. Wiring tests should not be interpreted as full production execution coverage.

## MarginFi USDC Adapter

### Protocol

MarginFi v2.

### Asset

USDC.

### Adapter Program

`43vGkNHfLML24Df9xCJddmwsx1mbje34yVsH13bqnbny`

### Known Constants

| Name                                      | Public Key                                     |
| ----------------------------------------- | ---------------------------------------------- |
| MarginFi v2 Program                       | `MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA`  |
| USDC Mint                                 | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| Default MarginFi USDC Bank in fork script | `2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB` |

### Behavior

The MarginFi adapter supports:

| Flow     | Selector | Instruction                |
| -------- | -------: | -------------------------- |
| Deposit  |      `0` | `lending_account_deposit`  |
| Withdraw |      `0` | `lending_account_withdraw` |

`current_value` expects:

```text
remaining_accounts[0] = MarginFi account
```

It reads raw `asset_shares` from the account data. This value is protocol-native I80F48-style accounting data, not a supported-mint token amount. To compute exact USDC value, clients need MarginFi bank exchange-rate data.

### Testing

Command:

```bash
yarn test:fork:marginfi
```

Environment variables used by tests and discovery helpers:

```bash
MARGINFI_PROGRAM_ID
MARGINFI_GROUP
MARGINFI_USDC_BANK
MARGINFI_ACCOUNT
USER_USDC_ATA
USER_USDC_DESTINATION_ATA
BANK_LIQUIDITY_VAULT
BANK_LIQUIDITY_VAULT_AUTHORITY
TOKEN_PROGRAM
```

`MARGINFI_GROUP` and `MARGINFI_USDC_BANK` should be taken from MarginFi SDK/config or the repository test helper. The fork script attempts auto-discovery through the helper script before requiring the core variables.

`current_value` e2e coverage requires `MARGINFI_ACCOUNT`. Deposit and withdraw are wiring-oriented unless signer-controlled MarginFi accounts and token accounts are available.

## Jupiter Adapter

### Protocol

Jupiter adapter implementation in this repository.

The current reference adapter targets the Jupiter program id:

```text
PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu
```

The adapter should not be described as a generic Jupiter Swap adapter. It currently routes to the program and account model implemented in the repository.

### Adapter Program

`CqNUZykVkiQsGTW8rQRSm4cm2DtXgMCmNRvWfgHV9nB2`

### Known Constants

| Name                               | Public Key                                     |
| ---------------------------------- | ---------------------------------------------- |
| Jupiter Program ID used by adapter | `PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu`  |
| USDC Mint                          | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |

Other Jupiter accounts are env-provided.

### Behavior

Deposit selectors:

| Selector | Instruction                   |
| -------: | ----------------------------- |
|      `0` | `depositCollateralForBorrows` |
|      `1` | `addLiquidity2`               |

Withdraw selectors:

| Selector | Instruction                    |
| -------: | ------------------------------ |
|      `0` | `withdrawCollateralForBorrows` |
|      `1` | `removeLiquidity`              |

`current_value` expects:

```text
remaining_accounts[0] = Jupiter BorrowPosition account
```

It reads raw `locked_collateral` and returns it as a `u64`. This value is protocol-native and may not be denominated in the supported mint.

### Testing

Command:

```bash
yarn test:fork:jupiter
```

Environment variables used by tests and discovery helpers:

```bash
JUPITER_PROGRAM_ID
JUPITER_POSITION_ACCOUNT
JUPITER_POOL_ACCOUNT
JUPITER_LP_MINT
USER_LP_ATA
USER_USDC_ATA
```

`JUPITER_POSITION_ACCOUNT` enables current-value e2e coverage. If it is missing, the account-dependent current-value path may be skipped. Deposit and withdraw tests verify dispatcher wiring and `extra_data` preservation.

## Maple Syrup Adapter

### Protocol

Maple Syrup / syrupUSDC modeled through Chainlink CCIP.

This adapter is intentionally different from a local Solana lending vault adapter. Deposit and withdraw both route through the Chainlink CCIP Router `ccip_send` instruction.

### Adapter Program

`7A1CFrXTEw96vdtsYPG1h5vhXbFCszaipfavL1XhgQKL`

### Known Constants

| Name                 | Public Key                                     |
| -------------------- | ---------------------------------------------- |
| CCIP Router Program  | `Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C` |
| USDC Mint            | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| syrupUSDC Mint       | `AvZZF1YaZDziPY2RCK4oJrRVrbN3mTD9NL24hPeaZeUj` |
| syrupUSDC Token Pool | `HrTBpF3LqSxXnjnYdR4htnBLyMHNZ6eNaDZGPundvHbm` |

### Behavior

Deposit:

* routes to CCIP Router `ccip_send`;
* represents a Maple Syrup deposit request;
* sends USDC according to the encoded CCIP message.

Withdraw:

* routes to CCIP Router `ccip_send`;
* represents a Maple Syrup withdraw / redeem request;
* sends syrupUSDC according to the encoded CCIP message.

The adapter does not parse the full CCIP message on-chain. The token amount must be encoded inside the serialized `CcipSendInstructionArgs`.

The Maple adapter validates:

* `extra_data` is not empty;
* at least 18 CCIP accounts are provided;
* `remaining_accounts[3]` equals the adapter authority;
* `remaining_accounts[3]` is a signer.

`current_value` expects:

```text
remaining_accounts[0] = user's syrupUSDC token account
```

It returns the SPL token account amount in base units.

Cross-chain settlement is asynchronous and outside the scope of local mainnet-fork testing.

### Testing

Command:

```bash
yarn test:fork:maple
```

Environment variables used by tests and discovery helpers:

```bash
SYRUP_USDC_MINT
USER_SYRUP_USDC_ATA
CCIP_SEND_ARGS_BASE64
CCIP_CONFIG
CCIP_DEST_CHAIN_STATE
CCIP_NONCE
CCIP_FEE_TOKEN_PROGRAM
CCIP_FEE_TOKEN_MINT
CCIP_FEE_TOKEN_USER_ATA
CCIP_FEE_TOKEN_RECEIVER
CCIP_FEE_BILLING_SIGNER
CCIP_FEE_QUOTER
CCIP_FEE_QUOTER_CONFIG
CCIP_FEE_QUOTER_DEST_CHAIN
CCIP_FEE_QUOTER_BILLING_TOKEN_CONFIG
CCIP_FEE_QUOTER_LINK_TOKEN_CONFIG
CCIP_RMN_REMOTE
CCIP_RMN_REMOTE_CURSES
CCIP_RMN_REMOTE_CONFIG
```

`USER_SYRUP_USDC_ATA` enables current-value e2e coverage.

`CCIP_SEND_ARGS_BASE64` is serialized `ccip_send` args, not a public key.

Deposit and withdraw wiring tests can run without proving complete cross-chain CCIP settlement. Full CCIP execution is not expected in local fork tests unless all required CCIP message, fee, billing, RMN, and destination-chain accounts are provided correctly.

## Drift Insurance Fund Adapter

### Protocol

Drift Protocol v2.

### Integration

Insurance Fund staking and Drift deposit / withdraw instruction routing.

### Adapter Program

`EojJcwUUuTuHyTJDyFjUjSxHbZLBuqJt7KPpBR6rVKZb`

### Known Constants

| Name                      | Public Key                                     |
| ------------------------- | ---------------------------------------------- |
| Drift Program ID          | `dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH`  |
| USDC Mint                 | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| USDC Insurance Fund Vault | `2CqkQvYxp9Mq4PqLvAQ1eryYxebUh4Liyn5YMDtXsYci` |

### Behavior

Deposit selectors:

| Selector | Instruction                       |
| -------: | --------------------------------- |
|      `0` | `deposit`                         |
|      `1` | `add_insurance_fund_stake`        |
|      `2` | `initialize_insurance_fund_stake` |

Withdraw selectors:

| Selector | Instruction                           |
| -------: | ------------------------------------- |
|      `0` | `withdraw`                            |
|      `1` | `request_remove_insurance_fund_stake` |
|      `2` | `remove_insurance_fund_stake`         |

`current_value` expects:

```text
remaining_accounts[0] = Drift User account
```

It reads `User.spot_positions[0].scaled_balance` from raw account data and returns it as a `u64`.

This value is Drift protocol-native scaled accounting data, not a direct USDC amount.

Full withdraw execution may require Drift’s request / cooldown flow and initialized insurance fund stake accounts.

### Testing

Command:

```bash
yarn test:fork:drift
```

Environment variables used by tests and discovery helpers:

```bash
DRIFT_USER
DRIFT_USER_STATS
DRIFT_STATE
DRIFT_USDC_SPOT_MARKET
DRIFT_INSURANCE_FUND_STAKE
USER_USDC_ATA
```

`DRIFT_USER` enables current-value e2e coverage. Deposit and withdraw tests verify account wiring.

## Mainnet-Fork Testing Specification

Each adapter has its own fork script.

The project intentionally does not run one giant fork for all protocols. Each fork script clones only the program and accounts required by that adapter. This makes tests faster, easier to debug, and easier to extend independently.

Fork scripts:

* start `solana-test-validator` with `--url mainnet-beta`;
* clone required protocol programs and accounts;
* deploy local dispatcher and adapter programs;
* run adapter-specific TypeScript tests.

Some `current_value` tests require a real user position or token account supplied through environment variables. If such an account is not provided, the account-dependent e2e path may be skipped. This is expected and should be interpreted as opt-in e2e coverage.

Passing wiring tests means dispatcher instruction construction, adapter PDA routing, remaining account forwarding, and `extra_data` preservation work. It does not necessarily prove full downstream protocol execution.

### Test Matrix

| Adapter  | `current_value` test | Deposit test      | Withdraw test     | Optional env for `current_value`           | Notes                                                                 |
| -------- | -------------------- | ----------------- | ----------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| Kamino   | E2E reserve read     | Wiring            | Wiring            | `KAMINO_USDC_RESERVE` optional / defaulted | Market and oracle accounts are resolved dynamically from the reserve. |
| MarginFi | Optional e2e         | Wiring            | Wiring            | `MARGINFI_ACCOUNT`                         | Requires group, bank, and env-provided accounts.                      |
| Jupiter  | Optional e2e         | Wiring            | Wiring            | `JUPITER_POSITION_ACCOUNT`                 | Returns raw locked collateral.                                        |
| Maple    | Optional e2e         | CCIP wiring       | CCIP wiring       | `USER_SYRUP_USDC_ATA`                      | Cross-chain settlement is not tested locally.                         |
| Drift    | Optional e2e         | IF / Drift wiring | IF / Drift wiring | `DRIFT_USER`                               | IF withdraw may involve request / cooldown flow.                      |

## Commands

The repository uses Yarn in `Anchor.toml` and `package.json`.

### Build

```bash
anchor build
```

### Dispatcher Tests

```bash
yarn test:dispatcher
```

Equivalent package command:

```bash
yarn test
```

The dispatcher test script runs:

```bash
anchor test -- --features testing
```

### Adapter Mainnet-Fork Tests

```bash
yarn test:fork:kamino
yarn test:fork:marginfi
yarn test:fork:jupiter
yarn test:fork:maple
yarn test:fork:drift
```

Each command runs the corresponding script in:

```text
tests/scripts/
```

## Toolchain / Versions

Repository files specify:

| Component                      | Version / Setting |
| ------------------------------ | ----------------- |
| Package manager                | `yarn`            |
| Rust toolchain                 | `1.89.0`          |
| `@anchor-lang/core`            | `^1.0.2`          |
| `@solana/web3.js`              | `^1.98.4`         |
| TypeScript                     | `^5.7.3`          |
| `tsx`                          | `^4.22.4`         |
| `@kamino-finance/klend-sdk`    | `^8.0.2`          |
| `@mrgnlabs/marginfi-client-v2` | `6.4.2`           |

Tested local environment reported for the reference implementation:

| Component             | Version                    |
| --------------------- | -------------------------- |
| Anchor CLI            | `1.0.2`                    |
| `anchor-lang`         | `1.0.2`                    |
| `anchor-spl`          | `1.0.2`                    |
| Solana CLI / Agave    | `4.0.0`                    |
| Rust / SBPF toolchain | `1.89.0-sbpf-solana-v1.53` |
| Node                  | `20.20.2`                  |

If repository files and local environment differ, repository files should be treated as the source of truth for builds.

## Safety and Security Considerations

The dispatcher is not a risk engine.

The dispatcher does not:

* validate protocol-specific account correctness;
* verify oracle prices;
* check liquidation risk;
* compute USD value;
* validate downstream protocol invariants;
* guarantee cross-chain settlement.

Adapters must:

* validate minimum account counts;
* validate expected signer placement where applicable;
* check `extra_data` length before slicing;
* reject unknown selectors;
* document account order;
* document returned `current_value` units.

`remaining_accounts` are powerful. Incorrect account ordering can cause adapter failure or unintended downstream behavior. Clients should generate account metas from protocol SDKs, IDLs, or audited helpers.

`extra_data` is opaque to the dispatcher. Unsafe decoding inside adapters can cause panics or incorrect instruction data. Adapters should treat `extra_data` as untrusted input.

Paused adapters should not be routable. The dispatcher enforces this before `deposit`, `withdraw`, and `current_value`.

Cross-chain adapters such as Maple / CCIP introduce asynchronous settlement risk outside dispatcher scope. A successful local `ccip_send` wiring test does not imply destination-chain execution or final settlement.

Mainnet-fork wiring tests are not a substitute for audits, production integration tests, or protocol-specific security review.

## Rationale

Solana protocols require explicit account metas. Attempting to standardize every account layout would either make the dispatcher protocol-specific or force an unsafe lowest-common-denominator abstraction.

This standard chooses a small ABI:

* `amount`
* `extra_data`
* `remaining_accounts`
* `u64` return data

This keeps the dispatcher stable while allowing adapters to evolve independently.

`extra_data` keeps protocol-specific instruction arguments out of the dispatcher.

`remaining_accounts` preserves Solana’s explicit account model.

Return data enables a simple common read API for simulations and off-chain integrations.

The registry creates a simple governance and security boundary: only registered active adapters can receive dispatcher-routed calls.

One adapter per protocol keeps integrations isolated, easier to test, and easier to audit.

## Backwards Compatibility / Extensibility

New adapters can be added without modifying the dispatcher.

Existing adapters can evolve their own `extra_data` formats, but clients should treat adapter `extra_data` as adapter-versioned.

Future versions of this standard could add:

* richer value metadata;
* decimals;
* asset units;
* quote APIs;
* standardized preview functions;
* adapter version fields;
* stronger account schema descriptions;
* registry-level deprecation flows.

The current standard intentionally keeps the core ABI minimal.

## Build Your Own Adapter Summary

To implement a new adapter:

1. Create a new Anchor adapter program.
2. Implement `adapter_deposit`.
3. Implement `adapter_withdraw`.
4. Implement `adapter_current_value`.
5. Decode `extra_data` safely.
6. Validate required accounts and signer assumptions.
7. Build the downstream protocol CPI instruction.
8. Return `u64` through Solana return data for `current_value`.
9. Register the adapter through `adapter_init`.
10. Add mock or unit tests.
11. Add adapter-specific mainnet-fork tests.
12. Document returned units, account order, selectors, and environment variables.

## Appendix A: Known Public Keys

| Name                            | Public Key                                     |
| ------------------------------- | ---------------------------------------------- |
| Dispatcher devnet / localnet    | `2mYCSzV1J6XKZmd8n1NWcr2NuRYqVtP6tFC7YWPj6ZXU` |
| Mock Adapter                    | `3ChHEmV3NhvmtzLXPDY62aJizN4tiBGapzpmUKwxj6cV` |
| Kamino Adapter                  | `BaxHrSyiFkoS4on2HmmEBCAL7BwMfXnZarpHNx6V3GrT` |
| MarginFi Adapter                | `43vGkNHfLML24Df9xCJddmwsx1mbje34yVsH13bqnbny` |
| Jupiter Adapter                 | `CqNUZykVkiQsGTW8rQRSm4cm2DtXgMCmNRvWfgHV9nB2` |
| Maple Adapter                   | `7A1CFrXTEw96vdtsYPG1h5vhXbFCszaipfavL1XhgQKL` |
| Drift Adapter                   | `EojJcwUUuTuHyTJDyFjUjSxHbZLBuqJt7KPpBR6rVKZb` |
| USDC Mint                       | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| Kamino KLend Program            | `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD`  |
| Default Kamino USDC Reserve     | `D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59` |
| MarginFi v2 Program             | `MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA`  |
| Default MarginFi USDC Bank      | `2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB` |
| Jupiter Program used by adapter | `PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu`  |
| CCIP Router Program             | `Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C` |
| syrupUSDC Mint                  | `AvZZF1YaZDziPY2RCK4oJrRVrbN3mTD9NL24hPeaZeUj` |
| syrupUSDC Token Pool            | `HrTBpF3LqSxXnjnYdR4htnBLyMHNZ6eNaDZGPundvHbm` |
| Drift Program                   | `dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH`  |
| Drift USDC Insurance Fund Vault | `2CqkQvYxp9Mq4PqLvAQ1eryYxebUh4Liyn5YMDtXsYci` |

MarginFi group / account values and Jupiter position / pool accounts are env-provided and should not be hardcoded unless taken from a known SDK config or a controlled test fixture.

## Appendix B: Mainnet-Fork Environment Variables

### Kamino

```bash
KAMINO_USDC_RESERVE
```

`KAMINO_USDC_RESERVE` is optional. If omitted, the fork script uses the default Kamino USDC reserve.

### MarginFi

```bash
MARGINFI_PROGRAM_ID
MARGINFI_GROUP
MARGINFI_USDC_BANK
MARGINFI_ACCOUNT
USER_USDC_ATA
USER_USDC_DESTINATION_ATA
BANK_LIQUIDITY_VAULT
BANK_LIQUIDITY_VAULT_AUTHORITY
TOKEN_PROGRAM
```

Core fork configuration requires a MarginFi program id, group, and USDC bank. The script attempts helper-based discovery.

`MARGINFI_ACCOUNT` enables account-dependent current-value e2e coverage.

### Jupiter

```bash
JUPITER_PROGRAM_ID
JUPITER_POSITION_ACCOUNT
JUPITER_POOL_ACCOUNT
JUPITER_LP_MINT
USER_LP_ATA
USER_USDC_ATA
```

`JUPITER_PROGRAM_ID` defaults to:

```text
PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu
```

`JUPITER_POSITION_ACCOUNT` enables account-dependent current-value e2e coverage.

### Maple

```bash
SYRUP_USDC_MINT
USER_SYRUP_USDC_ATA
CCIP_SEND_ARGS_BASE64
CCIP_CONFIG
CCIP_DEST_CHAIN_STATE
CCIP_NONCE
CCIP_FEE_TOKEN_PROGRAM
CCIP_FEE_TOKEN_MINT
CCIP_FEE_TOKEN_USER_ATA
CCIP_FEE_TOKEN_RECEIVER
CCIP_FEE_BILLING_SIGNER
CCIP_FEE_QUOTER
CCIP_FEE_QUOTER_CONFIG
CCIP_FEE_QUOTER_DEST_CHAIN
CCIP_FEE_QUOTER_BILLING_TOKEN_CONFIG
CCIP_FEE_QUOTER_LINK_TOKEN_CONFIG
CCIP_RMN_REMOTE
CCIP_RMN_REMOTE_CURSES
CCIP_RMN_REMOTE_CONFIG
```

`USER_SYRUP_USDC_ATA` enables current-value e2e coverage.

`CCIP_SEND_ARGS_BASE64` contains serialized CCIP instruction args and is not a public key.

### Drift

```bash
DRIFT_USER
DRIFT_USER_STATS
DRIFT_STATE
DRIFT_USDC_SPOT_MARKET
DRIFT_INSURANCE_FUND_STAKE
USER_USDC_ATA
```

`DRIFT_USER` enables account-dependent current-value e2e coverage.

## Appendix C: Test Result Interpretation

Passing wiring tests mean that the following are working:

* dispatcher instruction construction;
* adapter PDA routing;
* adapter active-status checks;
* signer forwarding;
* `remaining_accounts` forwarding;
* adapter entrypoint invocation;
* `extra_data` preservation;
* protocol instruction data construction up to the tested boundary.

Pending or skipped current-value tests usually mean that the optional real protocol user, position, or token account was not provided.

Pending does not mean the adapter is entirely untested. It means that the account-dependent e2e path was not enabled for that run.

Full execution tests require signer-controlled accounts and protocol-specific state.

Expected examples:

| Adapter | Example Result Without Optional Account                        |
| ------- | -------------------------------------------------------------- |
| Jupiter | 2 passing, 1 pending if `JUPITER_POSITION_ACCOUNT` is missing. |
| Maple   | 2 passing, 1 pending if `USER_SYRUP_USDC_ATA` is missing.      |
| Drift   | 2 passing, 1 pending if `DRIFT_USER` is missing.               |

Full protocol execution should be tested separately with controlled accounts, complete protocol state, and protocol-specific assertions.
