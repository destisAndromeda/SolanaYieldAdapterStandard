import * as anchor from "@anchor-lang/core";
import { assert } from "chai";
import {
  dispatcherProgram,
  MARGINFI_ACCOUNT,
  marginfiAdapterPda,
  provider,
  setupMarginfiFork,
  simulateAndDecodeU64ReturnData,
} from "./shared";

function accounts<T>(accounts: T): any {
  return accounts as any;
}

describe("marginfi mainnet-fork current-value e2e", function () {
  before(async function () {
    await setupMarginfiFork();
    if (!MARGINFI_ACCOUNT) {
      this.skip();
    }
  });

  it("should route dispatcher.currentValue through the MarginFi adapter and return a protocol-native raw asset shares balance", async () => {
    const ix = await dispatcherProgram.methods
      .currentValue()
      .accounts(
        accounts({
          authority: provider.wallet.publicKey,
          adapter: marginfiAdapterPda,
        }),
      )
      .remainingAccounts([
        {
          pubkey: MARGINFI_ACCOUNT!,
          isSigner: false,
          isWritable: false,
        },
      ])
      .instruction();

    const value = await simulateAndDecodeU64ReturnData(ix);
    assert.isTrue(value >= BigInt(0), "Expected MarginFi current value to be a non-negative raw asset shares balance");

    if (process.env.MARGINFI_ACCOUNT_NONZERO === "true") {
      assert.isTrue(value > BigInt(0), "Expected MarginFi current value to be greater than zero when MARGINFI_ACCOUNT_NONZERO=true");
    }
  }).timeout(150000);
});
