import * as anchor from "@anchor-lang/core";
import { assert } from "chai";
import {
  KAMINO_USDC_RESERVE,
  kaminoAdapterProgram,
  provider,
  assertAccountExists,
  simulateAndDecodeU64ReturnData,
} from "./shared";

function accounts<T>(accounts: T): any {
  return accounts as any;
}

describe("kamino adapter direct current-value", () => {
  before(async () => {
    await assertAccountExists(KAMINO_USDC_RESERVE, "Kamino USDC reserve");
  });

  it("should call kamino_adapter.adapterCurrentValue directly and decode the u64 return value", async () => {
    const reserveAccount = await provider.connection.getAccountInfo(KAMINO_USDC_RESERVE);
    assert.isNotNull(reserveAccount, `Kamino reserve account ${KAMINO_USDC_RESERVE.toBase58()} must exist`);
    assert.isAbove(reserveAccount!.data.length, 0, "Kamino reserve account data must not be empty");

    const ix = await kaminoAdapterProgram.methods
      .adapterCurrentValue()
      .accounts(accounts({
        authority: provider.wallet.publicKey,
      }))
      .remainingAccounts([
        {
          pubkey: KAMINO_USDC_RESERVE,
          isSigner: false,
          isWritable: false,
        },
      ])
      .instruction();

    const value = await simulateAndDecodeU64ReturnData(ix);
    assert.isTrue(value > BigInt(0), "Expected Kamino adapter current value to be a positive u64");
  });
});
