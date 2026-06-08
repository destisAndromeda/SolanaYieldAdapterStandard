import * as anchor from "@anchor-lang/core";
import { AnchorError } from "@anchor-lang/core";
import { assert } from "chai";
import {
  ADAPTER_STATUS_ACTIVE,
  ADAPTER_STATUS_PAUSED,
  EXTRA_DATA_MAX_LEN,
  USDC_MINT,
  activeAdapterPda,
  adapterAuthority,
  dispatcherProgram,
  inactiveAdapterAuthority,
  inactiveAdapterPda,
  keypairFromSeed,
  mockAdapterProgram,
  mockAdapterProgramAccount,
  parseMockAdapterEvents,
  provider,
  registryPda,
  airdrop,
  assertProgramIsExecutable,
  systemProgram,
} from "./shared";

function accounts<T>(accounts: T): any {
  return accounts as any;
}

function findEventByNames(events: any[], names: string[]) {
  return events.find((event) => names.includes(event.name));
}

describe("withdraw routing", () => {
  before(async () => {
    await airdrop(adapterAuthority.publicKey);
    await airdrop(inactiveAdapterAuthority.publicKey);
    await assertProgramIsExecutable(mockAdapterProgram.programId, "Mock adapter program");

    try {
      await dispatcherProgram.account.registry.fetch(registryPda);
    } catch {
      await dispatcherProgram.methods
        .registryInit()
        .accounts(accounts({
          initializer: provider.wallet.publicKey,
          registry: registryPda,
          systemProgram,
        }))
        .rpc();
    }

    try {
      await dispatcherProgram.account.adapter.fetch(activeAdapterPda);
    } catch {
      await dispatcherProgram.methods
        .adapterInit({
          authority: adapterAuthority.publicKey,
          programId: mockAdapterProgram.programId,
          supportedMint: USDC_MINT,
          status: ADAPTER_STATUS_ACTIVE,
        })
        .accounts(accounts({
          initializer: provider.wallet.publicKey,
          adapter: activeAdapterPda,
          registry: registryPda,
          systemProgram,
        }))
        .rpc();
    }

    try {
      await dispatcherProgram.account.adapter.fetch(inactiveAdapterPda);
    } catch {
      await dispatcherProgram.methods
        .adapterInit({
          authority: inactiveAdapterAuthority.publicKey,
          programId: mockAdapterProgram.programId,
          supportedMint: USDC_MINT,
          status: ADAPTER_STATUS_PAUSED,
        })
        .accounts(accounts({
          initializer: provider.wallet.publicKey,
          adapter: inactiveAdapterPda,
          registry: registryPda,
          systemProgram,
        }))
        .rpc();
    }
  });

  it("happy: active adapter forwards signer automatically and passes extra_data unchanged", async () => {
    const amount = new anchor.BN(2_000_000);
    const extraData = Buffer.from([5, 6, 7, 8]);

    const txSig = await dispatcherProgram.methods
      .withdraw({ amount, extraData })
      .accounts(accounts({
        signer: provider.wallet.publicKey,
        adapter: activeAdapterPda,
      }))
      .remainingAccounts([mockAdapterProgramAccount])
      .rpc();

    const mockEvents = await parseMockAdapterEvents(txSig);
    const mockWithdrawEvent = findEventByNames(mockEvents, ["mockWithdrawCalled", "MockWithdrawCalled"]);
    assert.isDefined(mockWithdrawEvent, "expected mock adapter withdraw event");

    const authority = mockWithdrawEvent!.data.authority ?? mockWithdrawEvent!.data.authority;
    const amountValue = mockWithdrawEvent!.data.amount ?? mockWithdrawEvent!.data.amount;
    const extra = mockWithdrawEvent!.data.extra_data ?? mockWithdrawEvent!.data.extraData;

    assert.isTrue(authority.equals(provider.wallet.publicKey));
    assert.isTrue(amountValue.eq(amount));
    assert.deepStrictEqual(Buffer.from(extra), extraData);
  });

  it("error: inactive adapter returns Inactive before CPI", async () => {
    try {
      await dispatcherProgram.methods
        .withdraw({ amount: new anchor.BN(1_000_000), extraData: Buffer.alloc(0) })
        .accounts(accounts({
          signer: provider.wallet.publicKey,
          adapter: inactiveAdapterPda,
        }))
        .rpc();
      assert.fail("expected error");
    } catch (e) {
      assert.instanceOf(e, AnchorError);
      assert.strictEqual((e as AnchorError).error.errorCode.code, "Inactive");
    }
  });

  it("error: extra_data longer than max returns Overflow", async () => {
    const extraData = Buffer.alloc(EXTRA_DATA_MAX_LEN + 1, 1);
    try {
      await dispatcherProgram.methods
        .withdraw({ amount: new anchor.BN(1_000_000), extraData })
        .accounts(accounts({
          signer: provider.wallet.publicKey,
          adapter: activeAdapterPda,
        }))
        .rpc();
      assert.fail("expected error");
    } catch (e) {
      assert.instanceOf(e, AnchorError);
      assert.strictEqual((e as AnchorError).error.errorCode.code, "Overflow");
    }
  });
});
