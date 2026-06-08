import * as anchor from "@anchor-lang/core";
import { assert } from "chai";
import {
  BANK_LIQUIDITY_VAULT,
  BANK_LIQUIDITY_VAULT_AUTHORITY,
  MARGINFI_ACCOUNT,
  MARGINFI_GROUP,
  MARGINFI_USDC_BANK,
  TOKEN_PROGRAM,
  USER_USDC_DESTINATION_ATA,
  marginfiAdapterPda,
  marginfiWithdrawRemainingAccounts,
  provider,
  setupMarginfiFork,
  dispatcherProgram,
} from "./shared";

function accounts<T>(accounts: T): any {
  return accounts as any;
}

describe("marginfi mainnet-fork withdraw wiring", () => {
  before(async () => {
    await setupMarginfiFork();
  });

  it("should build dispatcher.withdraw with the expected MarginFi wiring accounts", async () => {
    const extraData = Buffer.from([0]);
    const amount: anchor.BN = new anchor.BN(1_000_000);
    const remainingAccounts = marginfiWithdrawRemainingAccounts();

    const dispatcherIx = await dispatcherProgram.methods
      .withdraw({ amount, extraData })
      .accounts(
        accounts({
          signer: provider.wallet.publicKey,
          adapter: marginfiAdapterPda,
        }),
      )
      .remainingAccounts(remainingAccounts)
      .instruction();

    assert.isTrue(
      dispatcherIx.programId.equals(dispatcherProgram.programId),
      "Expected dispatcher instruction to target the dispatcher program",
    );
    assert.isTrue(
      dispatcherIx.keys.some((key) => key.pubkey.equals(marginfiAdapterPda)),
      "Expected the dispatcher instruction to include the registered MarginFi adapter PDA",
    );
    assert.isTrue(
      dispatcherIx.keys.some((key) => key.pubkey.equals(MARGINFI_USDC_BANK)),
      "Expected the dispatcher instruction to include the MarginFi USDC bank",
    );

    if (MARGINFI_GROUP) {
      assert.isTrue(
        dispatcherIx.keys.some((key) => key.pubkey.equals(MARGINFI_GROUP)),
        "Expected the dispatcher instruction to include the MarginFi group when configured",
      );
    }
    if (MARGINFI_ACCOUNT) {
      assert.isTrue(
        dispatcherIx.keys.some((key) => key.pubkey.equals(MARGINFI_ACCOUNT)),
        "Expected the dispatcher instruction to include the MarginFi account when configured",
      );
    }
    if (USER_USDC_DESTINATION_ATA) {
      assert.isTrue(
        dispatcherIx.keys.some((key) => key.pubkey.equals(USER_USDC_DESTINATION_ATA)),
        "Expected the dispatcher instruction to include the user destination USDC ATA when configured",
      );
    }
    if (BANK_LIQUIDITY_VAULT) {
      assert.isTrue(
        dispatcherIx.keys.some((key) => key.pubkey.equals(BANK_LIQUIDITY_VAULT)),
        "Expected the dispatcher instruction to include the bank liquidity vault when configured",
      );
    }
    if (BANK_LIQUIDITY_VAULT_AUTHORITY) {
      assert.isTrue(
        dispatcherIx.keys.some((key) => key.pubkey.equals(BANK_LIQUIDITY_VAULT_AUTHORITY)),
        "Expected the dispatcher instruction to include the bank liquidity vault authority when configured",
      );
    }
    if (TOKEN_PROGRAM) {
      assert.isTrue(
        dispatcherIx.keys.some((key) => key.pubkey.equals(TOKEN_PROGRAM)),
        "Expected the dispatcher instruction to include the token program",
      );
    }

    const data = Buffer.from(dispatcherIx.data);
    const selectorByte = data[8 + 8 + 4];
    assert.strictEqual(selectorByte, extraData[0], "Expected extra_data[0] to preserve the adapter function selector");
    assert.isTrue(
      remainingAccounts.length > 0,
      "Expected MarginFi wiring tests to include at least one protocol-specific remaining account",
    );
  }).timeout(150000);
});
