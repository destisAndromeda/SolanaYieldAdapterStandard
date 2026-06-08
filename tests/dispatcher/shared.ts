import * as anchor from "@anchor-lang/core";
import { AnchorError, BorshCoder, EventParser, Program } from "@anchor-lang/core";
import { assert } from "chai";
import { createHash } from "crypto";
import { Keypair, PublicKey } from "@solana/web3.js";
import { Dispatcher } from "../../target/types/dispatcher";
import { MockAdapter } from "../../target/types/mock_adapter";

/** Deterministic keypair — stable across test files that import this module. */
export function keypairFromSeed(label: string): Keypair {
  const seed = createHash("sha256")
    .update(`solana-yield-adapter-standard:${label}`)
    .digest();
  return Keypair.fromSeed(seed);
}

export const SEED_PREFIX = "dispatcher";
export const SEED_REGISTRY = "registry";
export const SEED_ADAPTER = "adapter_info";
export const EXTRA_DATA_MAX_LEN = 64;
export const ADAPTER_STATUS_ACTIVE = 0;
export const ADAPTER_STATUS_PAUSED = 1;
export const MOCK_CURRENT_VALUE = 123_456_789;
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

export const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

export const dispatcherProgram = anchor.workspace.Dispatcher as Program<Dispatcher>;
export const mockAdapterProgram = anchor.workspace.MockAdapter as Program<MockAdapter>;
export const systemProgram = anchor.web3.SystemProgram.programId;

export const adapterAuthority = keypairFromSeed("adapter-authority");
export const inactiveAdapterAuthority = keypairFromSeed("inactive-adapter-authority");
export const toggleAdapterAuthority = keypairFromSeed("toggle-adapter-authority");
export const unauthorized = keypairFromSeed("unauthorized");

export const [registryPda, registryBump] = findRegistryPda(dispatcherProgram.programId);

export const [activeAdapterPda] = findAdapterPda(
  dispatcherProgram.programId,
  mockAdapterProgram.programId,
  adapterAuthority.publicKey,
);

export const [inactiveAdapterPda] = findAdapterPda(
  dispatcherProgram.programId,
  mockAdapterProgram.programId,
  inactiveAdapterAuthority.publicKey,
);

export const [toggleAdapterPda] = findAdapterPda(
  dispatcherProgram.programId,
  mockAdapterProgram.programId,
  toggleAdapterAuthority.publicKey,
);

export function findRegistryPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_PREFIX), Buffer.from(SEED_REGISTRY)],
    programId,
  );
}

export function findAdapterPda(
  programId: PublicKey,
  adapterProgramId: PublicKey,
  authority: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(SEED_PREFIX),
      adapterProgramId.toBuffer(),
      Buffer.from(SEED_ADAPTER),
      authority.toBuffer(),
    ],
    programId,
  );
}

export async function airdrop(
  pubkey: PublicKey,
  lamports = 2 * anchor.web3.LAMPORTS_PER_SOL,
): Promise<void> {
  const latest = await provider.connection.getLatestBlockhash();
  const signature = await provider.connection.requestAirdrop(pubkey, lamports);

  await provider.connection.confirmTransaction({
    signature,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  });
}

export async function ensureRegistryExists(): Promise<void> {
  try {
    await dispatcherProgram.account.registry.fetch(registryPda);
  } catch {
    await dispatcherProgram.methods
      .registryInit()
      .accounts({
        initializer: provider.wallet.publicKey,
        registry: registryPda,
        systemProgram,
      })
      .rpc();
  }
}

export async function assertProgramIsExecutable(
  programId: PublicKey,
  label: string,
): Promise<void> {
  const accountInfo = await provider.connection.getAccountInfo(programId);
  if (!accountInfo) {
    throw new Error(`${label} ${programId.toBase58()} is not deployed locally.`);
  }
  if (!accountInfo.executable) {
    throw new Error(`${label} ${programId.toBase58()} exists but is not executable.`);
  }
}

export function assertAnchorErrorCode(e: unknown, code: string): void {
  if (e instanceof AnchorError) {
    assert.strictEqual(e.error.errorCode.code, code);
    return;
  }

  const anyE = e as any;
  if (anyE && typeof anyE === "object") {
    if (anyE.error?.errorCode?.code === code) {
      return;
    }
    if (Array.isArray(anyE.logs) && anyE.logs.some((log: unknown) => String(log).includes(code))) {
      return;
    }
    if (typeof anyE.message === "string" && anyE.message.includes(code)) {
      return;
    }
  }

  assert.include(String(e), code);
}

export const mockAdapterProgramAccount = {
  pubkey: mockAdapterProgram.programId,
  isSigner: false,
  isWritable: false,
};

export async function parseDispatcherEvents(txSig: string) {
  await provider.connection.confirmTransaction(txSig, "confirmed");

  const tx = await provider.connection.getTransaction(txSig, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!tx?.meta?.logMessages) {
    throw new Error(`missing logs for transaction ${txSig}`);
  }

  const parser = new EventParser(
    dispatcherProgram.programId,
    new BorshCoder(dispatcherProgram.idl),
  );

  const iterator = parser.parseLogs(tx.meta.logMessages);
  const events: any[] = [];
  let result = iterator.next();
  while (!result.done) {
    events.push(result.value);
    result = iterator.next();
  }
  return events;
}

function parseProgramEventsViaLogs(
  logs: string[],
  programId: anchor.web3.PublicKey,
  idl: any,
): any[] {
  const coder = new BorshCoder(idl);
  const events: any[] = [];
  const programIdString = programId.toString();
  const activeStack: string[] = [];

  for (const log of logs) {
    if (log.startsWith(`Program ${programIdString} invoke`)) {
      activeStack.push(programIdString);
      continue;
    }

    if (log === `Program ${programIdString} success` ||
        log === `Program ${programIdString} failed`) {
      activeStack.pop();
      continue;
    }

    if (activeStack.length === 0) {
      continue;
    }

    if (!log.startsWith("Program data: ")) {
      continue;
    }

    const rawData = log.slice("Program data: ".length);
    const event = coder.events.decode(rawData);
    if (event) {
      events.push(event);
    }
  }

  return events;
}

export async function parseMockAdapterEvents(txSig: string) {
  await provider.connection.confirmTransaction(txSig, "confirmed");

  const tx = await provider.connection.getTransaction(txSig, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!tx?.meta?.logMessages) {
    throw new Error(`missing logs for transaction ${txSig}`);
  }

  const parser = new EventParser(
    mockAdapterProgram.programId,
    new BorshCoder(mockAdapterProgram.idl),
  );

  const iterator = parser.parseLogs(tx.meta.logMessages);
  const events: any[] = [];
  let result = iterator.next();
  while (!result.done) {
    events.push(result.value);
    result = iterator.next();
  }

  if (events.length > 0) {
    return events;
  }

  return parseProgramEventsViaLogs(
    tx.meta.logMessages,
    mockAdapterProgram.programId,
    mockAdapterProgram.idl,
  );
}
