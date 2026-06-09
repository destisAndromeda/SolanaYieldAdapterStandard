import * as anchor from "@anchor-lang/core";
import { assert } from "chai";
import {
  dispatcherProgram,
  JUPITER_POSITION_ACCOUNT,
  JUPITER_POSITION_NONZERO,
  jupiterAdapterPda,
  provider,
  setupJupiterFork,
  simulateAndDecodeU64ReturnData,
} from "./shared";

function accounts<T>(accounts: T): any {
  return accounts as any;
}

describe("jupiter mainnet-fork current-value e2e", function () {
  before(async function () {
    await setupJupiterFork();
    if (!JUPITER_POSITION_ACCOUNT) {
      this.skip();
    }
  });

  it("should route dispatcher.currentValue through the Jupiter adapter and return raw locked collateral from the BorrowPosition account", async () => {
    const ix = await dispatcherProgram.methods
      .currentValue()
      .accounts(
        accounts({
          authority: provider.wallet.publicKey,
          adapter: jupiterAdapterPda,
        }),
      )
      .remainingAccounts([
        {
          pubkey: JUPITER_POSITION_ACCOUNT!,
          isSigner: false,
          isWritable: false,
        },
      ])
      .instruction();

    const value = await simulateAndDecodeU64ReturnData(ix);
    assert.isTrue(
      value >= BigInt(0),
      "Expected Jupiter current value to be a non-negative raw locked collateral amount",
    );

    if (JUPITER_POSITION_NONZERO) {
      assert.isTrue(
        value > BigInt(0),
        "Expected Jupiter current value to be greater than zero when JUPITER_POSITION_NONZERO=true",
      );
    }
  }).timeout(150000);
});
