import * as anchor from "@anchor-lang/core";
import { assert } from "chai";
import {
  ADAPTER_STATUS_ACTIVE,
  ADAPTER_STATUS_PAUSED,
  activeAdapterPda,
  adapterAuthority,
  dispatcherProgram,
  inactiveAdapterAuthority,
  inactiveAdapterPda,
  mockAdapterProgram,
  mockAdapterProgramAccount,
  MOCK_CURRENT_VALUE,
  USDC_MINT,
  provider,
  registryPda,
  airdrop,
  assertProgramIsExecutable,
  systemProgram,
} from "./shared";

function accounts<T>(accounts: T): any {
  return accounts as any;
}

async function simulateAndDecodeU64ReturnData(
  instruction: anchor.web3.TransactionInstruction,
): Promise<bigint> {
  const tx = new anchor.web3.Transaction().add(instruction);
  tx.feePayer = provider.wallet.publicKey;
  const latest = await provider.connection.getLatestBlockhash();
  tx.recentBlockhash = latest.blockhash;

  const signedTx = await provider.wallet.signTransaction(tx);
  const sim = await provider.connection.simulateTransaction(signedTx);

  if (sim.value.err) {
    const logs = sim.value.logs?.join("\n") ?? "";
    throw new Error(`Simulation failed: ${JSON.stringify(sim.value.err)}\nLogs:\n${logs}`);
  }

  if (!sim.value.returnData) {
    throw new Error("No return data in simulation result");
  }

  const raw = Buffer.from(sim.value.returnData.data[0], "base64");
  return raw.readBigUInt64LE(0);
}

async function ensureRegistryExists(): Promise<void> {
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
}

async function ensureAdapterExists(): Promise<void> {
  try {
    await dispatcherProgram.account.adapter.fetch(activeAdapterPda);
  } catch {
    await airdrop(adapterAuthority.publicKey);
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
}

async function ensureInactiveAdapterExists(): Promise<void> {
  try {
    await dispatcherProgram.account.adapter.fetch(inactiveAdapterPda);
  } catch {
    await airdrop(inactiveAdapterAuthority.publicKey);
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
}

describe("current_value routing", () => {
  before(async () => {
    await airdrop(provider.wallet.publicKey);
    await assertProgramIsExecutable(dispatcherProgram.programId, "Dispatcher program");
    await assertProgramIsExecutable(mockAdapterProgram.programId, "Mock adapter program");
    await ensureRegistryExists();
    await ensureAdapterExists();
    await ensureInactiveAdapterExists();
  });

  it("happy: active adapter returns the fixed mock u64 without duplicate signer remaining account", async () => {
    const ix = await dispatcherProgram.methods
      .currentValue()
      .accounts(accounts({
        authority: provider.wallet.publicKey,
        adapter: activeAdapterPda,
      }))
      .remainingAccounts([mockAdapterProgramAccount])
      .instruction();

    const value = await simulateAndDecodeU64ReturnData(ix);
    assert.strictEqual(value, BigInt(MOCK_CURRENT_VALUE), "dispatcher should return the mock adapter fixed current value");
  });

  it("error: inactive adapter returns Inactive before CPI", async () => {
    try {
      await dispatcherProgram.methods
        .currentValue()
        .accounts(accounts({
          authority: provider.wallet.publicKey,
          adapter: inactiveAdapterPda,
        }))
        .rpc();
      assert.fail("expected error");
    } catch (e) {
      assert.include(String(e), "Inactive");
    }
  });
});
