import * as anchor from "@anchor-lang/core";
import { assert } from "chai";
import {
  dispatcherProgram,
  JUPITER_POOL_ACCOUNT,
  JUPITER_PROGRAM_ID,
  USER_LP_ATA,
  USER_USDC_ATA,
  jupiterAdapterPda,
  jupiterWithdrawRemainingAccounts,
  provider,
  setupJupiterFork,
} from "./shared";

function accounts<T>(accounts: T): any {
  return accounts as any;
}

describe("jupiter mainnet-fork withdraw wiring", () => {
  before(async () => {
    await setupJupiterFork();
  });

  it("should build dispatcher.withdraw with the expected Jupiter remaining accounts", async () => {
    const amount: anchor.BN = new anchor.BN(1_000_000);
    const extraData = Buffer.from([0]);
    const remainingAccounts = jupiterWithdrawRemainingAccounts();

    const dispatcherIx = await dispatcherProgram.methods
      .withdraw({ amount, extraData })
      .accounts(
        accounts({
          signer: provider.wallet.publicKey,
          adapter: jupiterAdapterPda,
        }),
      )
      .remainingAccounts(remainingAccounts)
      .instruction();

    assert.isTrue(
      dispatcherIx.programId.equals(dispatcherProgram.programId),
      "Expected dispatcher instruction to target the dispatcher program",
    );
    assert.isTrue(
      dispatcherIx.keys.some((key) => key.pubkey.equals(jupiterAdapterPda)),
      "Expected the dispatcher instruction to include the registered adapter PDA",
    );
    assert.isAbove(
      remainingAccounts.length,
      0,
      "Expected the Jupiter wiring helper to provide non-empty remaining accounts",
    );

    if (JUPITER_PROGRAM_ID) {
      assert.isTrue(
        dispatcherIx.keys.some((key) => key.pubkey.equals(JUPITER_PROGRAM_ID)),
        "Expected the dispatcher instruction to include the Jupiter program ID when configured",
      );
    }
    if (JUPITER_POOL_ACCOUNT) {
      assert.isTrue(
        dispatcherIx.keys.some((key) => key.pubkey.equals(JUPITER_POOL_ACCOUNT)),
        "Expected the dispatcher instruction to include the Jupiter pool account when configured",
      );
    }
    if (USER_LP_ATA) {
      assert.isTrue(
        dispatcherIx.keys.some((key) => key.pubkey.equals(USER_LP_ATA)),
        "Expected the dispatcher instruction to include the user LP ATA when configured",
      );
    }
    if (USER_USDC_ATA) {
      assert.isTrue(
        dispatcherIx.keys.some((key) => key.pubkey.equals(USER_USDC_ATA)),
        "Expected the dispatcher instruction to include the user USDC ATA when configured",
      );
    }

    const data = Buffer.from(dispatcherIx.data);
    const selectorByte = data[8 + 8 + 4];
    assert.strictEqual(
      selectorByte,
      extraData[0],
      "Expected extra_data[0] to preserve the adapter function selector",
    );
  }).timeout(150000);
});
