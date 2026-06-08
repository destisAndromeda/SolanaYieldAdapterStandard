import * as anchor from "@anchor-lang/core";
import { assert } from "chai";
import {
  dispatcherProgram,
  getKaminoUsdcReserve,
  kaminoAdapterPda,
  kaminoAdapterProgram,
  provider,
  setupKaminoFork,
  simulateAndDecodeU64ReturnData,
  KAMINO_USDC_RESERVE,
} from "./shared";

function accounts<T>(accounts: T): any {
  return accounts as any;
}

describe("kamino mainnet-fork current-value e2e", () => {
  before(async () => {
    await setupKaminoFork();
  });

  it("should route dispatcher.currentValue through the Kamino adapter and return a positive liquidity value", async () => {
    const reserve = await getKaminoUsdcReserve();

    const ix = await dispatcherProgram.methods
      .currentValue()
      .accounts(accounts({
        authority: provider.wallet.publicKey,
        adapter: kaminoAdapterPda,
      }))
      .remainingAccounts([
        {
          pubkey: new anchor.web3.PublicKey(reserve.address),
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: kaminoAdapterProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ])
      .instruction();

    try {
      const value = await simulateAndDecodeU64ReturnData(ix);
      assert.isTrue(value > BigInt(0), "Expected kamino current value to be greater than zero");
    } catch (error) {
      const adapterAccount = await dispatcherProgram.account.adapter
        .fetch(kaminoAdapterPda)
        .catch(() => null);
      const adapterProgramId = adapterAccount?.programId?.toBase58() ?? "unknown";

      throw new Error([
        "Kamino current-value e2e failed",
        `dispatcher program id: ${dispatcherProgram.programId.toBase58()}`,
        `kamino adapter program id: ${kaminoAdapterProgram.programId.toBase58()}`,
        `registered adapter program id: ${adapterProgramId}`,
        `reserve pubkey: ${KAMINO_USDC_RESERVE.toBase58()}`,
        `reserve exists: ${Boolean(reserve)}`,
        `error: ${String(error)}`,
      ].join("\n"));
    }
  }).timeout(150000);
});
