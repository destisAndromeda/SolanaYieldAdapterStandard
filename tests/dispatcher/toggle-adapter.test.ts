import * as anchor from "@anchor-lang/core";
import { AnchorError } from "@anchor-lang/core";
import { assert } from "chai";
import {
  ADAPTER_STATUS_ACTIVE,
  ADAPTER_STATUS_PAUSED,
  USDC_MINT,
  airdrop,
  dispatcherProgram,
  findAdapterPda,
  keypairFromSeed,
  mockAdapterProgram,
  provider,
  registryPda,
  systemProgram,
  toggleAdapterAuthority,
  toggleAdapterPda,
  unauthorized,
  parseDispatcherEvents,
} from "./shared";

function accounts<T>(accounts: T): any {
  return accounts as any;
}

function findEventByNames(events: any[], names: string[]) {
  return events.find((event) => names.includes(event.name));
}

describe("toggle_adapter", () => {
  before(async () => {
    await airdrop(toggleAdapterAuthority.publicKey);
    await dispatcherProgram.methods
      .adapterInit({
        authority: toggleAdapterAuthority.publicKey,
        programId: mockAdapterProgram.programId,
        supportedMint: new anchor.web3.PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
        status: ADAPTER_STATUS_ACTIVE,
      })
      .accounts(accounts({
        initializer: provider.wallet.publicKey,
        adapter: toggleAdapterPda,
        registry: registryPda,
        systemProgram,
      }))
      .rpc();
  });

  it("happy: authority toggles active status to paused", async () => {
    const txSig = await dispatcherProgram.methods
      .toggleAdapter()
      .accounts(accounts({
        authority: toggleAdapterAuthority.publicKey,
        adapter: toggleAdapterPda,
      }))
      .signers([toggleAdapterAuthority])
      .rpc();

    const adapter = await dispatcherProgram.account.adapter.fetch(toggleAdapterPda);
    assert.strictEqual(adapter.status, ADAPTER_STATUS_PAUSED);

    const events = await parseDispatcherEvents(txSig);
    const toggleEvent = findEventByNames(events, ["toggleEvent"]);
    assert.isDefined(toggleEvent);
    assert.isTrue(toggleEvent!.data.authority.equals(toggleAdapterAuthority.publicKey));
    assert.isTrue(toggleEvent!.data.adapter.equals(toggleAdapterPda));
    assert.isTrue(toggleEvent!.data.programId.equals(mockAdapterProgram.programId));
    assert.strictEqual(toggleEvent!.data.status, ADAPTER_STATUS_PAUSED);
  });

  it("happy: second toggle flips paused status back to active", async () => {
    const txSig = await dispatcherProgram.methods
      .toggleAdapter()
      .accounts(accounts({
        authority: toggleAdapterAuthority.publicKey,
        adapter: toggleAdapterPda,
      }))
      .signers([toggleAdapterAuthority])
      .rpc();

    const adapter = await dispatcherProgram.account.adapter.fetch(toggleAdapterPda);
    assert.strictEqual(adapter.status, ADAPTER_STATUS_ACTIVE);

    const events = await parseDispatcherEvents(txSig);
    const toggleEvent = findEventByNames(events, ["toggleEvent"]);
    assert.isDefined(toggleEvent);
    assert.strictEqual(toggleEvent!.data.status, ADAPTER_STATUS_ACTIVE);
  });

  it("error: wrong authority returns Unauthorized", async () => {
    try {
      await dispatcherProgram.methods
        .toggleAdapter()
        .accounts(accounts({
          authority: unauthorized.publicKey,
          adapter: toggleAdapterPda,
        }))
        .signers([unauthorized])
        .rpc();
      assert.fail("expected error");
    } catch (e) {
      assert.instanceOf(e, AnchorError);
      assert.strictEqual((e as AnchorError).error.errorCode.code, "Unauthorized");
    }
  });

  it("error: deprecated adapter returns Deprecated", async () => {
    const deprecatedAuthority = keypairFromSeed("deprecated-adapter-authority");
    const deprecatedAdapterPda = findAdapterPda(
      dispatcherProgram.programId,
      mockAdapterProgram.programId,
      deprecatedAuthority.publicKey,
    )[0];

    await airdrop(deprecatedAuthority.publicKey);
    await dispatcherProgram.methods
      .adapterInit({
        authority: deprecatedAuthority.publicKey,
        programId: mockAdapterProgram.programId,
        supportedMint: USDC_MINT,
        status: 2,
      })
      .accounts(accounts({
        initializer: provider.wallet.publicKey,
        adapter: deprecatedAdapterPda,
        registry: registryPda,
        systemProgram,
      }))
      .rpc();

    try {
      await dispatcherProgram.methods
        .toggleAdapter()
        .accounts(accounts({
          authority: deprecatedAuthority.publicKey,
          adapter: deprecatedAdapterPda,
        }))
        .signers([deprecatedAuthority])
        .rpc();
      assert.fail("expected error");
    } catch (e) {
      assert.instanceOf(e, AnchorError);
      assert.strictEqual((e as AnchorError).error.errorCode.code, "Deprecated");
    }
  });
});
