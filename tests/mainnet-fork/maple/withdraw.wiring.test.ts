import * as anchor from "@anchor-lang/core";
import { assert } from "chai";
import {
  dispatcherProgram,
  CCIP_ROUTER_PROGRAM,
  USDC_MINT,
  SYRUP_USDC_MINT,
  USER_SYRUP_USDC_ATA,
  remainingAccountsFromEnvForCcipSend,
  mapleAdapterPda,
  provider,
  setupMapleFork,
} from "./shared";

function accounts<T>(accounts: T): any {
  return accounts as any;
}

describe("maple mainnet-fork withdraw wiring", () => {
  before(async () => {
    await setupMapleFork();
  });

  it("should build dispatcher.withdraw with CCIP ccip_send wiring accounts", async () => {
    const extraDataFromEnv = process.env.CCIP_SEND_ARGS_BASE64;
    const selector = 0; // ccip_send selector
    const extraData = extraDataFromEnv ? Buffer.concat([Buffer.from([selector]), Buffer.from(extraDataFromEnv, "base64")]) : Buffer.from([selector]);
    const amount: anchor.BN = new anchor.BN(1_000_000);

    const remainingAccounts = remainingAccountsFromEnvForCcipSend();

    const dispatcherIx = await dispatcherProgram.methods
      .withdraw({ amount, extraData })
      .accounts(
        accounts({
          signer: provider.wallet.publicKey,
          adapter: mapleAdapterPda,
        }),
      )
      .remainingAccounts(remainingAccounts)
      .instruction();

    assert.isTrue(dispatcherIx.programId.equals(dispatcherProgram.programId), "Expected dispatcher instruction to target the dispatcher program");
    assert.isTrue(dispatcherIx.keys.some((k) => k.pubkey.equals(mapleAdapterPda)), "Expected dispatcher instruction to include the Maple adapter PDA");

    const data = Buffer.from(dispatcherIx.data);
    const selectorByte = data[8 + 8 + 4];
    assert.strictEqual(selectorByte, selector, "Expected extra_data[0] to preserve ccip selector");

    // CCIP router presence
    assert.isTrue(dispatcherIx.keys.some((k) => k.pubkey.equals(CCIP_ROUTER_PROGRAM)), "Expected CCIP router program to be included in remaining accounts");

    if (extraDataFromEnv) {
      const provided = Buffer.from(extraDataFromEnv, "base64");
      const found = data.indexOf(provided);
      assert.isAtLeast(found, 0, "Expected serialized CCIP args to appear in dispatcher instruction data when provided via CCIP_SEND_ARGS_BASE64");
    }
  }).timeout(150000);
});
