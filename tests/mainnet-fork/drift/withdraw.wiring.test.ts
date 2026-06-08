import * as anchor from "@anchor-lang/core";
import { assert } from "chai";
import {
  dispatcherProgram,
  DRIFT_INSURANCE_FUND_STAKE,
  DRIFT_USDC_IF_VAULT,
  DRIFT_USDC_SPOT_MARKET,
  DRIFT_USER,
  DRIFT_USER_STATS,
  DRIFT_STATE,
  USER_USDC_ATA,
  driftAdapterPda,
  provider,
  setupDriftFork,
} from "./shared";

function accounts<T>(accounts: T): any {
  return accounts as any;
}

describe("drift mainnet-fork withdraw wiring", () => {
  before(async () => {
    await setupDriftFork();
  });

  it("should build dispatcher.withdraw with the expected Drift insurance fund wiring accounts", async () => {
    const extraData = Buffer.from([1]);
    const amount: anchor.BN = new anchor.BN(1_000_000);
    const driftInsuranceFundStake = DRIFT_INSURANCE_FUND_STAKE;
    const remainingAccounts = [
      {
        pubkey: DRIFT_USDC_IF_VAULT,
        isSigner: false,
        isWritable: true,
      },
    ];

    if (DRIFT_USER) {
      remainingAccounts.push({ pubkey: DRIFT_USER, isSigner: false, isWritable: true });
    }
    if (DRIFT_USER_STATS) {
      remainingAccounts.push({ pubkey: DRIFT_USER_STATS, isSigner: false, isWritable: true });
    }
    if (DRIFT_STATE) {
      remainingAccounts.push({ pubkey: DRIFT_STATE, isSigner: false, isWritable: false });
    }
    if (DRIFT_USDC_SPOT_MARKET) {
      remainingAccounts.push({ pubkey: DRIFT_USDC_SPOT_MARKET, isSigner: false, isWritable: false });
    }
    if (DRIFT_INSURANCE_FUND_STAKE) {
      remainingAccounts.push({ pubkey: DRIFT_INSURANCE_FUND_STAKE, isSigner: false, isWritable: true });
    }
    if (USER_USDC_ATA) {
      remainingAccounts.push({ pubkey: USER_USDC_ATA, isSigner: false, isWritable: true });
    }

    const dispatcherIx = await dispatcherProgram.methods
      .withdraw({ amount, extraData })
      .accounts(
        accounts({
          signer: provider.wallet.publicKey,
          adapter: driftAdapterPda,
        }),
      )
      .remainingAccounts(remainingAccounts)
      .instruction();

    assert.isTrue(
      dispatcherIx.programId.equals(dispatcherProgram.programId),
      "Expected dispatcher instruction to target the dispatcher program",
    );
    assert.isTrue(
      dispatcherIx.keys.some((key) => key.pubkey.equals(driftAdapterPda)),
      "Expected the dispatcher instruction to include the registered Drift adapter PDA",
    );
    assert.isTrue(
      dispatcherIx.keys.some((key) => key.pubkey.equals(DRIFT_USDC_IF_VAULT)),
      "Expected the dispatcher instruction to include the Drift USDC insurance fund vault",
    );
    if (driftInsuranceFundStake) {
      assert.isTrue(
        dispatcherIx.keys.some((key) => key.pubkey.equals(driftInsuranceFundStake)),
        "Expected the dispatcher instruction to include the Drift insurance fund stake account when configured",
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
