#!/usr/bin/env bash
set -euo pipefail

VALIDATOR_PID=0

cleanup() {
  if [ "$VALIDATOR_PID" -ne 0 ]; then
    kill "$VALIDATOR_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

if [ "$#" -gt 0 ]; then
  export JUPITER_PROGRAM_ID="$1"
fi

JUPITER_PROGRAM_ID="${JUPITER_PROGRAM_ID:-PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu}"
USDC_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
LOCALNET_URL="http://127.0.0.1:8899"

resolve_jupiter_fork_accounts() {
  yarn -s tsx ./tests/mainnet-fork/jupiter/discover-accounts.ts
}

wait_for_validator() {
  local retries=30
  local count=0

  until solana slot --url "$LOCALNET_URL" >/dev/null 2>&1; do
    count=$((count + 1))
    if [ "$count" -ge "$retries" ]; then
      echo "Error: solana-test-validator failed to start after $retries seconds"
      echo "--- validator log ---"
      cat .anchor/jupiter-validator.log || true
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

echo "==> Starting Jupiter mainnet fork"
mkdir -p .anchor
mapfile -t JUPITER_FORK_ACCOUNTS < <(resolve_jupiter_fork_accounts)
if [ "${#JUPITER_FORK_ACCOUNTS[@]}" -eq 0 ]; then
  echo "Error: no Jupiter fork accounts discovered"
  exit 1
fi

echo "==> Cloning Jupiter mainnet accounts: ${JUPITER_FORK_ACCOUNTS[*]}"
clone_args=()
for acct in "${JUPITER_FORK_ACCOUNTS[@]}"; do
  clone_args+=(--clone "$acct")
done

solana-test-validator \
  --url mainnet-beta \
  --reset \
  --clone "$JUPITER_PROGRAM_ID" \
  --clone "$USDC_MINT" \
  "${clone_args[@]}" \
  > .anchor/jupiter-validator.log 2>&1 &
VALIDATOR_PID=$!

echo "==> Validator PID: $VALIDATOR_PID"
export ANCHOR_PROVIDER_URL="$LOCALNET_URL"
export SOLANA_URL="$LOCALNET_URL"
export ANCHOR_WALLET="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"

wait_for_validator

echo "==> Deploying local programs"
anchor deploy

echo "==> Running Jupiter mainnet-fork tests"
yarn run ts-mocha -p ./tsconfig.json -t 1000000 \
  ./tests/mainnet-fork/jupiter/current-value.e2e.test.ts \
  ./tests/mainnet-fork/jupiter/deposit.wiring.test.ts \
  ./tests/mainnet-fork/jupiter/withdraw.wiring.test.ts
