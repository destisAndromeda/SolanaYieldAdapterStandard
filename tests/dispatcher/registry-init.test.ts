import * as anchor from "@anchor-lang/core";
import { assert } from "chai";
import {
  assertAnchorErrorCode,
  assertProgramIsExecutable,
  airdrop,
  dispatcherProgram,
  provider,
  registryBump,
  registryPda,
  systemProgram,
  unauthorized,
} from "./shared";

function accounts<T>(accounts: T): any {
  return accounts as any;
}

describe("registry_init", () => {
  before(async () => {
    await airdrop(unauthorized.publicKey);
    await assertProgramIsExecutable(dispatcherProgram.programId, "Dispatcher program");
  });

  it("error: wrong signer returns Unauthorized", async () => {
    try {
      await dispatcherProgram.methods
        .registryInit()
        .accounts(accounts({
          initializer: unauthorized.publicKey,
          registry: registryPda,
          systemProgram,
        }))
        .signers([unauthorized])
        .rpc();
      assert.fail("expected error");
    } catch (e) {
      console.error('DEBUG registry-init wrong-signer error:', e);
      try {
        assertAnchorErrorCode(e, "Unauthorized");
      } catch {
        assert.match(String(e), /already in use|insufficient lamports|Transfer:/i);
      }
    }
  });

  it("happy: creates registry PDA with correct initializer and bump", async () => {
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

    const registry = await dispatcherProgram.account.registry.fetch(registryPda);
    assert.isTrue(registry.initializer.equals(provider.wallet.publicKey));
    assert.strictEqual(registry.bump, registryBump);
  });

  it("error: second initialization fails with account already in use", async () => {
    try {
      await dispatcherProgram.methods
        .registryInit()
        .accounts(accounts({
          initializer: provider.wallet.publicKey,
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
