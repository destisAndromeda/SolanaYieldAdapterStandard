#!/usr/bin/env bash
set -euo pipefail

VALIDATOR_PID=0

cleanup() {
  if [ "$VALIDATOR_PID" -ne 0 ]; then
    kill "$VALIDATOR_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

: "${MARGINFI_PROGRAM_ID:-}"
: "${MARGINFI_GROUP:-}"
MARGINFI_USDC_BANK="${MARGINFI_USDC_BANK:-2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB}"

# Try auto-discovery of missing MarginFi envs using the helper script.
try_auto_discover_marginfi() {
  echo "==> Attempting MarginFi config auto-discovery via helper"
  # Capture only export lines and eval them to set env vars in this shell.
  local out
  out=$(npx -y tsx ./tests/mainnet-fork/marginfi/print-config.ts 2>/dev/null || true)
  if [ -n "$(echo "$out" | grep -E '^export ' )" ]; then
    echo "==> Applying discovered envs"
    eval "$(echo "$out" | grep -E '^export ' )"
  else
    echo "==> No env exports discovered by helper"
  fi
}

if [ -z "${MARGINFI_PROGRAM_ID:-}" ] || [ -z "${MARGINFI_GROUP:-}" ] || [ -z "${MARGINFI_USDC_BANK:-}" ]; then
  try_auto_discover_marginfi
fi

# Now require the vars to be set (either provided or discovered)
: "${MARGINFI_PROGRAM_ID:?MARGINFI_PROGRAM_ID is required}"
: "${MARGINFI_GROUP:?MARGINFI_GROUP is required}"
: "${MARGINFI_USDC_BANK:?MARGINFI_USDC_BANK is required}"

USDC_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
LOCALNET_URL="http://127.0.0.1:8899"

resolve_marginfi_fork_accounts() {
  yarn -s tsx ./tests/mainnet-fork/marginfi/discover-accounts.ts
}

wait_for_validator() {
  local retries=30
  local count=0

  until solana slot --url "$LOCALNET_URL" >/dev/null 2>&1; do
    count=$((count + 1))
    if [ "$count" -ge "$retries" ]; then
      echo "Error: solana-test-validator failed to start after $retries seconds"
      echo "--- validator log ---"
      cat .anchor/marginfi-validator.log || true
      echo "--- end log ---"
      exit 1
    fi
    echo "==> Waiting for validator RPC ($count/$retries)..."
    sleep 1
  done
  echo "==> Validator RPC is ready"
}

echo "==> Stopping previous validator"
cleanup
sleep 1

echo "==> Starting MarginFi mainnet fork"
mkdir -p .anchor
mapfile -t MARGINFI_FORK_ACCOUNTS < <(resolve_marginfi_fork_accounts)
if [ "${#MARGINFI_FORK_ACCOUNTS[@]}" -eq 0 ]; then
  echo "Error: no MarginFi fork accounts discovered"
  exit 1
fi

echo "==> Cloning MarginFi mainnet accounts: ${MARGINFI_FORK_ACCOUNTS[*]}"
clone_args=()
for acct in "${MARGINFI_FORK_ACCOUNTS[@]}"; do
  clone_args+=(--clone "$acct")
 done

solana-test-validator \
  --url mainnet-beta \
  --reset \
  --clone "$MARGINFI_PROGRAM_ID" \
  --clone "$USDC_MINT" \
  --clone "$MARGINFI_GROUP" \
  --clone "$MARGINFI_USDC_BANK" \
  "${clone_args[@]}" \
  > .anchor/marginfi-validator.log 2>&1 &
VALIDATOR_PID=$!

echo "==> Validator PID: $VALIDATOR_PID"
export ANCHOR_PROVIDER_URL="$LOCALNET_URL"
export SOLANA_URL="$LOCALNET_URL"
export ANCHOR_WALLET="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"

wait_for_validator

echo "==> Deploying local programs"
anchor deploy

echo "==> Running MarginFi mainnet-fork tests"
yarn run ts-mocha -p ./tsconfig.json -t 1000000 \
  ./tests/mainnet-fork/marginfi/current-value.e2e.test.ts \
  ./tests/mainnet-fork/marginfi/deposit.wiring.test.ts \
  ./tests/mainnet-fork/marginfi/withdraw.wiring.test.ts
