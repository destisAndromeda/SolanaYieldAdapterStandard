import * as anchor from "@anchor-lang/core";
import { BorshCoder, EventParser, Program } from "@anchor-lang/core";
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
  const signature = await provider.connection.requestAirdrop(pubkey, lamports);
  await provider.connection.confirmTransaction(signature);
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

  return [...parser.parseLogs(tx.meta.logMessages)];
}
