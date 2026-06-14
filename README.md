# Solana Yield Adapter Standard

A reference implementation of a protocol-agnostic Solana yield adapter standard. This repo provides a dispatcher, on-chain registry, reusable adapter interface crate, five reference adapters, a mock adapter for unit testing, and adapter-specific mainnet-fork wiring tests.

Devnet Dispatcher: `8yq3ahdnSz4GBcVWtohNF5V7MxnVmk6umN4TNhJX182n`

Supported reference adapters:

- Kamino USDC
- MarginFi USDC
- Jupiter
- Maple Syrup via Chainlink CCIP
- Drift Insurance Fund

## Documentation

- [Adapter Standard Specification](docs/adapter-standard.md)
- [Build Your Own Adapter Guide](docs/developer-guide.md)
- Mainnet-fork testing details are covered in the adapter standard and test scripts.

## Deployments

| Network | Program    | Address                                        |
| ------- | ---------- | ---------------------------------------------- |
| Devnet  | Dispatcher | `8yq3ahdnSz4GBcVWtohNF5V7MxnVmk6umN4TNhJX182n` |

### Reference Program IDs (localnet)

| Program         | Address                                        |
| --------------- | ---------------------------------------------- |
| Dispatcher      | `8yq3ahdnSz4GBcVWtohNF5V7MxnVmk6umN4TNhJX182n` |
| drift-adapter   | `EojJcwUUuTuHyTJDyFjUjSxHbZLBuqJt7KPpBR6rVKZb` |
| jupiter-adapter | `CqNUZykVkiQsGTW8rQRSm4cm2DtXgMCmNRvWfgHV9nB2` |
| kamino-adapter  | `BaxHrSyiFkoS4on2HmmEBCAL7BwMfXnZarpHNx6V3GrT` |
| maple-adapter   | `7A1CFrXTEw96vdtsYPG1h5vhXbFCszaipfavL1XhgQKL` |
| marginfi-adapter| `43vGkNHfLML24Df9xCJddmwsx1mbje34yVsH13bqnbny` |
| mock_adapter    | `3ChHEmV3NhvmtzLXPDY62aJizN4tiBGapzpmUKwxj6cV` |

## Why this exists

Solana protocols expose different instructions, account metas, account layouts, signer requirements, and accounting models. A single dispatcher cannot safely hardcode every protocol. This standard keeps the dispatcher protocol-agnostic and moves protocol-specific logic into adapters.

Key design points:

- `remaining_accounts` preserve Solana’s explicit account model.
- `extra_data` carries adapter-specific serialized arguments.
- `current_value` returns a `u64` through Solana return data.
- The dispatcher routes only to registered, active adapters.
- Protocol programs still enforce their own invariants.

## Architecture

```
User / Client
    |
    v
Dispatcher
  - checks registry
  - checks adapter status
  - injects signer
  - forwards amount, extra_data, remaining_accounts
    |
    v
Adapter Program
  - validates adapter-specific args/accounts
  - builds protocol CPI or reads account data
    |
    v
Target Protocol
  Kamino / MarginFi / Jupiter / Maple CCIP / Drift
```

### Dispatcher

- Protocol-agnostic router
- Exposes:
  - `deposit`
  - `withdraw`
  - `current_value`
- Routes only to registered active adapters
- Does not know protocol discriminators or account layouts

### Registry

- Stores registered adapters
- Stores adapter authority, program id, supported mint, and status
- Supports pausing / reactivating adapters

### Adapter Interface

Every adapter implements:

- `adapter_deposit`
- `adapter_withdraw`
- `adapter_current_value`

Common adapter inputs:

- `amount: u64`
- `extra_data: Vec<u8>`
- `remaining_accounts`

`current_value` returns a `u64` via Solana return data.

### Reference Adapters

| Adapter | Protocol | Current-value unit | Notes |
| ------- | -------- | ------------------ | ----- |
| Kamino | Kamino USDC | Reserve / available liquidity | wiring + e2e current_value |
| MarginFi | MarginFi USDC | Protocol-native account value / shares | wiring + optional current_value |
| Jupiter | Jupiter | Locked collateral / position value | wiring + optional current_value |
| Maple | Syrup USDC via Chainlink CCIP | Syrup USDC token amount | wiring + optional CCIP current_value |
| Drift | Drift Insurance Fund | Scaled balance | wiring + optional current_value |

## Repository Layout

```
crates/
  yield-adapter-interface/    # shared adapter interface, args, return-data helpers

programs/
  dispatcher/                 # registry + router
  mock-adapter/               # testing adapter
  kamino-adapter/
  marginfi-adapter/
  jupiter-adapter/
  maple-adapter/
  drift-adapter/

tests/
  dispatcher/                 # dispatcher + mock adapter tests
  mainnet-fork/               # adapter-specific fork tests
  scripts/                    # fork validator scripts

docs/
  adapter-standard.md
  developer-guide.md
```

## Quickstart

### Install dependencies

```bash
yarn install
```

### Build

```bash
anchor build
```

### Run dispatcher tests

```bash
yarn test:dispatcher
```

### Run mainnet-fork tests

```bash
yarn test:fork:kamino
yarn test:fork:marginfi
yarn test:fork:jupiter
yarn test:fork:maple
yarn test:fork:drift
```

## Mainnet-Fork Testing

Each adapter has its own fork script. The scripts:

- start `solana-test-validator --url mainnet-beta`
- clone only required mainnet accounts
- deploy local dispatcher/adapters into the fork
- run adapter-specific wiring and current_value tests

Some `current_value` tests are optional and may be skipped if a real cloned protocol account is not provided. That is intentional because full e2e current_value requires real mainnet accounts.

Typical result interpretation:

- `2 passing, 1 pending` usually means:
  - deposit wiring passed
  - withdraw wiring passed
  - current_value e2e was skipped or optional

### Important fork env vars

#### Kamino

- `KAMINO_USDC_RESERVE`
- Default: `D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59`

#### MarginFi

- `MARGINFI_PROGRAM_ID`
- `MARGINFI_GROUP`
- `MARGINFI_USDC_BANK`
- `MARGINFI_ACCOUNT`

#### Jupiter

- `JUPITER_PROGRAM_ID`
- `JUPITER_POSITION_ACCOUNT`
- `JUPITER_POOL_ACCOUNT`

#### Maple

- `SYRUP_USDC_MINT`
- `USER_SYRUP_USDC_ATA`
- `CCIP_SEND_ARGS_BASE64`

#### Drift

- `DRIFT_USER`
- `DRIFT_USER_STATS`
- `DRIFT_STATE`
- `DRIFT_USDC_SPOT_MARKET`
- `DRIFT_INSURANCE_FUND_STAKE`

For the complete environment variable list, see [Adapter Standard Specification](docs/adapter-standard.md).

## Building a New Adapter

To add a new adapter:

1. Research protocol docs, SDK, IDL, and real transactions
2. Implement the adapter program
3. Deploy the adapter
4. Register it in the dispatcher with `adapter_init`
5. Route calls through the dispatcher
6. Add mainnet-fork tests
7. Document account order and `extra_data`

Deployment happens before dispatcher registration. See [Build Your Own Adapter Guide](docs/developer-guide.md) for the full workflow.

## Toolchain

Repository toolchain facts:

- Anchor CLI: `1.0.2`
- `@anchor-lang/core`: `^1.0.2`
- `@solana/web3.js`: `^1.98.4`
- Node: `20.20.2`
- TypeScript: `^5.7.3`
- Yarn package manager

## Safety Notes

- The dispatcher is a router, not a risk engine.
- It does not validate protocol-specific accounts.
- `remaining_accounts` order is adapter-specific.
- `extra_data` is adapter-specific and must be decoded safely.
- `current_value` may return protocol-native units, not USD.
- CCIP/cross-chain settlement is outside local fork scope.

## Status

Draft / reference implementation for the Solana Yield Adapter Standard bounty submission. This is not an audited production system.
