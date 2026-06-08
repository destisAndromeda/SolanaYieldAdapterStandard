import * as anchor from "@anchor-lang/core";
import { assert } from "chai";
import BN from "bn.js";
import { KaminoAction, VanillaObligation } from "@kamino-finance/klend-sdk";
import {
  dispatcherProgram,
  getKaminoUsdcReserve,
  kaminoAdapterPda,
  kaminoAdapterProgram,
  kaminoTestAuthority,
  loadKaminoMarket,
  provider,
  setupKaminoFork,
  extractKaminoInstruction,
  remainingAccountsForInstruction,
} from "./shared";

function accounts<T>(accounts: T): any {
  return accounts as any;
}

describe("kamino mainnet-fork deposit wiring", () => {
  before(async () => {
    await setupKaminoFork();
  });

  it("should build dispatcher.deposit with the expected Kamino remaining accounts", async () => {
    const kaminoMarket = await loadKaminoMarket();
    const kaminoReserve = await getKaminoUsdcReserve(kaminoMarket);
    const ownerSigner = kaminoTestAuthority;
    const currentSlot = BigInt(await provider.connection.getSlot());
    const depositAmount = new BN(1_000_000);
    const functionSelector = 0;
    const extraData = Buffer.from([functionSelector]);

    const action = await KaminoAction.buildDepositTxns({
      kaminoMarket,
      amount: depositAmount,
      reserveAddress: kaminoReserve.address,
      owner: {
        address: ownerSigner.publicKey.toBase58(),
        signTransactions: async (transactions: any[]) => {
          return transactions.map((tx) => {
            tx.partialSign(ownerSigner);
            return tx;
          });
        },
      },
      obligation: new VanillaObligation(kaminoMarket.getAddress()),
      scopeRefreshConfig: undefined,
      useV2Ixs: true,
      currentSlot,
    });

    const kaminoIx = extractKaminoInstruction(action);
    const remainingAccounts = remainingAccountsForInstruction(kaminoIx);
    if (!remainingAccounts.some((account) => account.pubkey.equals(kaminoAdapterProgram.programId))) {
      remainingAccounts.push({
        pubkey: kaminoAdapterProgram.programId,
        isSigner: false,
        isWritable: false,
      });
    }

    const dispatcherIx = await dispatcherProgram.methods
      .deposit({ amount: depositAmount, extraData })
      .accounts(accounts({
        signer: provider.wallet.publicKey,
        adapter: kaminoAdapterPda,
      }))
      .remainingAccounts(remainingAccounts)
      .instruction();

    assert.isTrue(
      dispatcherIx.programId.equals(dispatcherProgram.programId),
      "Expected dispatcher instruction to target the dispatcher program",
    );
    assert.isTrue(
      dispatcherIx.keys.some((key) => key.pubkey.equals(kaminoAdapterPda)),
      "Expected the dispatcher instruction to include the registered adapter PDA",
    );
    assert.isTrue(
      dispatcherIx.keys.some((key) => key.pubkey.equals(provider.wallet.publicKey)),
      "Expected the dispatcher instruction to include the signer",
    );
    assert.isAbove(
      remainingAccounts.length,
      0,
      "Expected Kamino SDK to provide non-empty remaining accounts for deposit wiring",
    );

    const reservePubkey = new anchor.web3.PublicKey(kaminoReserve.address);
    assert.isTrue(
      dispatcherIx.keys.some((key) => key.pubkey.equals(reservePubkey)),
      "Expected the dispatcher instruction to include the Kamino reserve account",
    );

    const data = Buffer.from(dispatcherIx.data);
    const selectorByte = data[8 + 8 + 4];
    assert.strictEqual(
      selectorByte,
      functionSelector,
      "Expected extra_data[0] to preserve the adapter function selector",
    );
  }).timeout(150000);
});
