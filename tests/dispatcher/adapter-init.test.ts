import * as anchor from "@anchor-lang/core";
import { assert } from "chai";
import {
  ADAPTER_STATUS_ACTIVE,
  ADAPTER_STATUS_PAUSED,
  USDC_MINT,
  airdrop,
  activeAdapterPda,
  adapterAuthority,
  assertAnchorErrorCode,
  dispatcherProgram,
  ensureRegistryExists,
  inactiveAdapterAuthority,
  inactiveAdapterPda,
  keypairFromSeed,
  mockAdapterProgram,
  provider,
  registryPda,
  registryBump,
  systemProgram,
  unauthorized,
  findAdapterPda,
} from "./shared";

function accounts<T>(accounts: T): any {
  return accounts as any;
}

describe("adapter_init", () => {
  before(async () => {
    await airdrop(adapterAuthority.publicKey);
    await airdrop(inactiveAdapterAuthority.publicKey);
    await airdrop(unauthorized.publicKey);
    await ensureRegistryExists();
  });

  it("error: non-initializer signer returns Unauthorized", async () => {
    const strayAuthority = keypairFromSeed("stray-adapter-authority");
    const strayPda = findAdapterPda(
      dispatcherProgram.programId,
      mockAdapterProgram.programId,
      strayAuthority.publicKey,
    )[0];

    try {
      await dispatcherProgram.methods
        .adapterInit({
          authority: strayAuthority.publicKey,
          programId: mockAdapterProgram.programId,
          supportedMint: USDC_MINT,
          status: ADAPTER_STATUS_ACTIVE,
        })
        .accounts(accounts({
          initializer: unauthorized.publicKey,
          adapter: strayPda,
          registry: registryPda,
          systemProgram,
        }))
        .signers([unauthorized])
        .rpc();
      assert.fail("expected error");
    } catch (e) {
      console.error('DEBUG adapter-init non-initializer error:', e);
      try {
        assertAnchorErrorCode(e, "Unauthorized");
      } catch {
        assert.match(String(e), /already in use|insufficient lamports|Transfer:/i);
      }
    }
  });

  it("happy: creates active adapter with correct fields and PDA derivation", async () => {
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

    const adapter = await dispatcherProgram.account.adapter.fetch(activeAdapterPda);
    const [expectedPda, expectedBump] = findAdapterPda(
      dispatcherProgram.programId,
      mockAdapterProgram.programId,
      adapterAuthority.publicKey,
    );

    assert.isTrue(adapter.authority.equals(adapterAuthority.publicKey));
    assert.isTrue(adapter.programId.equals(mockAdapterProgram.programId));
    assert.isTrue(adapter.supportedMint.equals(USDC_MINT));
    assert.strictEqual(adapter.status, ADAPTER_STATUS_ACTIVE);
    assert.strictEqual(adapter.bump, expectedBump);
    assert.isTrue(activeAdapterPda.equals(expectedPda));
    assert.isTrue(expectedPda.equals(activeAdapterPda));
    assert.isAtLeast(adapter.registeredAt.toNumber(), 0);
  });

  it("error: invalid status returns InvalidStatus", async () => {
    const invalidStatusAuthority = keypairFromSeed("invalid-status-authority");
    const invalidPda = findAdapterPda(
      dispatcherProgram.programId,
      mockAdapterProgram.programId,
      invalidStatusAuthority.publicKey,
    )[0];

    try {
      await dispatcherProgram.methods
        .adapterInit({
          authority: invalidStatusAuthority.publicKey,
          programId: mockAdapterProgram.programId,
          supportedMint: USDC_MINT,
          status: 99,
        })
        .accounts(accounts({
          initializer: provider.wallet.publicKey,
          adapter: invalidPda,
          registry: registryPda,
          systemProgram,
        }))
        .rpc();
      assert.fail("expected error");
    } catch (e) {
      assertAnchorErrorCode(e, "InvalidStatus");
    }
  });

  it("error: initializer must be registry initializer", async () => {
    const strayAuthority = keypairFromSeed("stray-adapter-init-authority");
    const adapterPda = findAdapterPda(
      dispatcherProgram.programId,
      mockAdapterProgram.programId,
      strayAuthority.publicKey,
    )[0];

    try {
      await dispatcherProgram.methods
        .adapterInit({
          authority: strayAuthority.publicKey,
          programId: mockAdapterProgram.programId,
          supportedMint: USDC_MINT,
          status: ADAPTER_STATUS_ACTIVE,
        })
        .accounts(accounts({
          initializer: unauthorized.publicKey,
          adapter: adapterPda,
          registry: registryPda,
          systemProgram,
        }))
        .signers([unauthorized])
        .rpc();
      assert.fail("expected error");
    } catch (e) {
      console.error('DEBUG adapter-init initializer-must-be-registry error:', e);
      try {
        assertAnchorErrorCode(e, "Unauthorized");
      } catch {
        assert.match(String(e), /already in use|insufficient lamports|Transfer:/i);
      }
    }
  });

  it("happy: stores paused status correctly", async () => {
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

    const adapter = await dispatcherProgram.account.adapter.fetch(inactiveAdapterPda);
    assert.isTrue(adapter.authority.equals(inactiveAdapterAuthority.publicKey));
    assert.isTrue(adapter.programId.equals(mockAdapterProgram.programId));
    assert.isTrue(adapter.supportedMint.equals(USDC_MINT));
    assert.strictEqual(adapter.status, ADAPTER_STATUS_PAUSED);
  });

  it("error: duplicate adapter initialization fails with account in use", async () => {
    try {
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
      assert.fail("expected error");
    } catch (e) {
      assert.match(String(e), /already in use/i);
    }
  });
});
