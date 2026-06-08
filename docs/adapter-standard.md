# Adapter Standard

## Current value layout helpers

Adapter authors may need to read protocol-specific account data from `remaining_accounts` in `adapter_current_value()`.

The standard current value API remains minimal:

- `adapter_current_value()` returns a `u64` via program return data.
- The dispatcher does not interpret protocol account layouts.
- The adapter is responsible for reading any protocol state it needs from `remaining_accounts`.

`yield_adapter_interface` now provides optional layout helpers for safe offset-based decoding.

### When to use layout helpers

- Prefer protocol SDK typed decoding when a stable account type exists.
- Use raw offset helpers only when there is no stable account type or SDK struct for the account.
- Do not make offset decoding part of dispatcher ABI.
- Keep offsets documented and auditable in adapter code.

### Helper patterns

In the interface crate, use `layout::read_u64_le`, `layout::read_u128_le`, `layout::read_i128_le`, `layout::read_pubkey`, and `layout::read_bytes`.

Also use the macros `account_offset!` and `define_account_offsets!` to centralize and label offsets:

```rust
use yield_adapter_interface::{
    account_offset,
    define_account_offsets,
    layout::read_u64_le,
};

define_account_offsets! {
    drift_user {
        SPOT_0_SCALED_BALANCE: account_offset!(8, 32, 32, 32),
    }
}

let scaled_balance = read_u64_le(
    &data,
    drift_user::SPOT_0_SCALED_BALANCE,
)?;
```

### Safety guarantees

The layout helpers:

- use checked offset arithmetic
- validate account data length before slicing
- never call `unwrap()`
- return Anchor `Result`
- return custom errors from `YieldAdapterInterfaceError`

This is developer tooling inside `yield-adapter-interface`, not a new protocol-specific standard. The dispatcher remains agnostic and the adapter interface remains unchanged.
