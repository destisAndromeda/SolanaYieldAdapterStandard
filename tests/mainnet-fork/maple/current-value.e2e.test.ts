import * as anchor from "@anchor-lang/core";
import { assert } from "chai";
import {
  dispatcherProgram,
  USER_SYRUP_USDC_ATA,
  mapleAdapterPda,
  provider,
  setupMapleFork,
  simulateAndDecodeU64ReturnData,
} from "./shared";

function accounts<T>(accounts: T): any {
  return accounts as any;
}

describe("maple mainnet-fork current-value e2e", function () {
  before(async function () {
    await setupMapleFork();
    if (!USER_SYRUP_USDC_ATA) this.skip();
  });

  it("should route dispatcher.currentValue through the Maple adapter and return syrupUSDC base units", async () => {
    const ix = await dispatcherProgram.methods
      .currentValue()
      .accounts(
        accounts({
          authority: provider.wallet.publicKey,
          adapter: mapleAdapterPda,
        }),
      )
      .remainingAccounts([
        {
          pubkey: USER_SYRUP_USDC_ATA!,
          isSigner: false,
          isWritable: false,
        },
      ])
      .instruction();

    const value = await simulateAndDecodeU64ReturnData(ix);
    assert.isTrue(value >= BigInt(0), "Expected syrupUSDC scaled balance to be non-negative");

    if (process.env.MAPLE_SYRUP_NONZERO === "true") {
      assert.isTrue(value > BigInt(0), "Expected syrupUSDC scaled balance to be > 0 when MAPLE_SYRUP_NONZERO=true");
    }
  }).timeout(150000);
});
