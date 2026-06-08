import * as anchor from "@anchor-lang/core";
import { assert } from "chai";
import {
  dispatcherProgram,
  DRIFT_USER,
  driftAdapterPda,
  provider,
  setupDriftFork,
  simulateAndDecodeU64ReturnData,
} from "./shared";

function accounts<T>(accounts: T): any {
  return accounts as any;
}

describe("drift mainnet-fork current-value e2e", function () {
  before(async function () {
    await setupDriftFork();
    if (!DRIFT_USER) {
      this.skip();
    }
  });

  it("should route dispatcher.currentValue through the Drift adapter and return a protocol-native scaled balance", async () => {
    const ix = await dispatcherProgram.methods
      .currentValue()
      .accounts(
        accounts({
          authority: provider.wallet.publicKey,
          adapter: driftAdapterPda,
        }),
      )
      .remainingAccounts([
        {
          pubkey: DRIFT_USER!,
          isSigner: false,
          isWritable: false,
        },
      ])
      .instruction();

    const value = await simulateAndDecodeU64ReturnData(ix);
    assert.isTrue(
      value >= BigInt(0),
      "Expected Drift current value to be a non-negative scaled balance",
    );

    if (process.env.DRIFT_USER_NONZERO === "true") {
      assert.isTrue(
        value > BigInt(0),
        "Expected Drift current value to be greater than zero when DRIFT_USER_NONZERO=true",
      );
    }
  }).timeout(150000);
});
