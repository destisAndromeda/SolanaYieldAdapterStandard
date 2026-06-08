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
  export KAMINO_USDC_RESERVE="$1"
fi

: "${KAMINO_USDC_RESERVE:=D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59}"
export KAMINO_USDC_RESERVE

KAMINO_KLEND_PROGRAM="KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
USDC_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
LOCALNET_URL="http://127.0.0.1:8899"

resolve_kamino_fork_accounts() {
  node - "$KAMINO_USDC_RESERVE" "$KAMINO_KLEND_PROGRAM" <<'NODE'
const { Connection, PublicKey } = require('@solana/web3.js');
const { Reserve } = require('@kamino-finance/klend-sdk');
const reserveAddress = new PublicKey(process.argv[2]);
const programId = new PublicKey(process.argv[3]);
const rpc = new Connection('https://api.mainnet-beta.solana.com', { commitment: 'confirmed' });
(async () => {
  const info = await rpc.getAccountInfo(reserveAddress);
  if (!info) {
    console.error(`Failed to fetch account info for Kamino reserve ${reserveAddress.toBase58()} from mainnet-beta`);
    process.exit(1);
  }
  const reserve = Reserve.decode(info.data);
  const market = reserve.lendingMarket.toString();
  const oracles = [
    reserve.config.tokenInfo.pythConfiguration.price,
    reserve.config.tokenInfo.switchboardConfiguration.priceAggregator,
    reserve.config.tokenInfo.switchboardConfiguration.twapAggregator,
    reserve.config.tokenInfo.scopeConfiguration.priceFeed,
  ];
  const uniqueOracles = [...new Set(oracles
    .map((address) => (address && address.toString ? address.toString() : address))
    .filter((address) => address && address !== '11111111111111111111111111111111'))];
  console.log(market);
  uniqueOracles.forEach((address) => console.log(address));
})();
NODE
}

wait_for_validator() {
  local retries=30
  local count=0

  until solana slot --url "$LOCALNET_URL" >/dev/null 2>&1; do
    count=$((count + 1))
    if [ "$count" -ge "$retries" ]; then
      echo "Error: solana-test-validator failed to start after $retries seconds"
      echo "--- validator log ---"
      cat .anchor/kamino-validator.log || true
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

echo "==> Starting Kamino mainnet fork"
mkdir -p .anchor
mapfile -t KAMINO_FORK_ACCOUNTS < <(resolve_kamino_fork_accounts)
echo "==> Cloning Kamino market and oracle accounts: ${KAMINO_FORK_ACCOUNTS[*]}"
clone_args=()
for acct in "${KAMINO_FORK_ACCOUNTS[@]}"; do
  clone_args+=(--clone "$acct")
done
solana-test-validator \
  --url mainnet-beta \
  --reset \
  --clone "$KAMINO_KLEND_PROGRAM" \
  --clone "$USDC_MINT" \
  --clone "$KAMINO_USDC_RESERVE" \
  "${clone_args[@]}" \
  > .anchor/kamino-validator.log 2>&1 &
VALIDATOR_PID=$!

echo "==> Validator PID: $VALIDATOR_PID"
export ANCHOR_PROVIDER_URL="$LOCALNET_URL"
export SOLANA_URL="$LOCALNET_URL"
export ANCHOR_WALLET="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"

wait_for_validator

echo "==> Deploying local programs"
anchor deploy

echo "==> Running Kamino mainnet-fork tests"
yarn run ts-mocha -p ./tsconfig.json -t 1000000 \
  ./tests/mainnet-fork/kamino/current-value.e2e.test.ts \
  ./tests/mainnet-fork/kamino/deposit.wiring.test.ts \
  ./tests/mainnet-fork/kamino/withdraw.wiring.test.ts