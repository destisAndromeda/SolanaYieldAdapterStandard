import * as anchor from "@anchor-lang/core";
import { assert } from "chai";
import BN from "bn.js";
import { KaminoAction, VanillaObligation } from "@kamino-finance/klend-sdk";
import {
  KAMINO_USDC_RESERVE,
  createKaminoSigner,
  getKaminoUsdcReserve,
  kaminoAdapterProgram,
  kaminoTestAuthority,
  loadKaminoMarket,
  provider,
  remainingAccountsForInstruction,
} from "./shared";

function accounts<T>(accounts: T): any {
  return accounts as any;
}

describe("kamino adapter direct withdraw build", () => {
  it("should build a kamino_adapter.adapterWithdraw with the correct remaining accounts and selector", async () => {
    const kaminoMarket = await loadKaminoMarket();
    const kaminoReserve = await getKaminoUsdcReserve(kaminoMarket);
    const ownerSigner = createKaminoSigner(kaminoTestAuthority);
    const currentSlot = BigInt(await provider.connection.getSlot());
    const withdrawAmount = new BN(1_000_000);
    const functionSelector = 0;
    const extraData = Buffer.from([functionSelector]);

    const action = await KaminoAction.buildWithdrawTxns({
      kaminoMarket,
      amount: withdrawAmount,
      reserveAddress: kaminoReserve.address,
      owner: ownerSigner,
      obligation: new VanillaObligation(kaminoMarket.getAddress()),
      scopeRefreshConfig: undefined,
      useV2Ixs: true,
      currentSlot,
    });

    const kaminoIx = action.lendingIxs[action.lendingIxs.length - 1];
    const remainingAccounts = remainingAccountsForInstruction(kaminoIx);

    assert.isTrue(
      remainingAccounts.some((account) => account.pubkey.equals(KAMINO_USDC_RESERVE)),
      "Expected Kamino reserve to be present in the helper remaining accounts",
    );
    assert.isAbove(remainingAccounts.length, 0, "Expected non-empty remaining accounts for Kamino withdraw path");

    const adapterIx = await kaminoAdapterProgram.methods
      .adapterWithdraw({ amount: withdrawAmount, extraData })
      .accounts(accounts({ authority: provider.wallet.publicKey }))
      .remainingAccounts(remainingAccounts)
      .instruction();

    assert.isTrue(
      adapterIx.programId.equals(kaminoAdapterProgram.programId),
      "Expected adapter instruction programId to be kamino_adapter",
    );

    const data = Buffer.from(adapterIx.data);
    const selectorByte = data[8 + 8 + 4];
    assert.strictEqual(
      selectorByte,
      functionSelector,
      "Expected the first extra_data byte to select the Kamino adapter withdraw function",
    );
  });
});
