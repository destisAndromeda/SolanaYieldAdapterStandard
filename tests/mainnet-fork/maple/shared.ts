import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { createHash } from "crypto";
import { Keypair, PublicKey } from "@solana/web3.js";
import { Dispatcher } from "../../../target/types/dispatcher";
import { MapleAdapter } from "../../../target/types/maple_adapter";

export const SEED_PREFIX = "dispatcher";
export const SEED_REGISTRY = "registry";
export const SEED_ADAPTER = "adapter_info";
export const ADAPTER_STATUS_ACTIVE = 0;

export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
export const CCIP_ROUTER_PROGRAM = new PublicKey("Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C");

function envThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} env var is required for Maple mainnet-fork tests`);
  return v;
}

export const SYRUP_USDC_MINT: PublicKey | null = optionalPubkeyFromEnv("SYRUP_USDC_MINT");

export const USER_SYRUP_USDC_ATA: PublicKey | null = (() => {
  const v = process.env.USER_SYRUP_USDC_ATA;
  if (!v) return null;
  return new PublicKey(v);
})();

// Optional CCIP account env vars
const CCIP_ENVS = [
  "CCIP_CONFIG",
  "CCIP_DEST_CHAIN_STATE",
  "CCIP_NONCE",
  "CCIP_FEE_TOKEN_PROGRAM",
  "CCIP_FEE_TOKEN_MINT",
  "CCIP_FEE_TOKEN_USER_ATA",
  "CCIP_FEE_TOKEN_RECEIVER",
  "CCIP_FEE_BILLING_SIGNER",
  "CCIP_FEE_QUOTER",
  "CCIP_FEE_QUOTER_CONFIG",
  "CCIP_FEE_QUOTER_DEST_CHAIN",
  "CCIP_FEE_QUOTER_BILLING_TOKEN_CONFIG",
  "CCIP_FEE_QUOTER_LINK_TOKEN_CONFIG",
  "CCIP_RMN_REMOTE",
  "CCIP_RMN_REMOTE_CURSES",
  "CCIP_RMN_REMOTE_CONFIG",
];

export function pubkeyFromEnv(name: string): PublicKey {
  const v = process.env[name];
  if (!v) throw new Error(`${name} env var is required`);
  return new PublicKey(v);
}

export function optionalPubkeyFromEnv(name: string): PublicKey | null {
  const v = process.env[name];
  if (!v) return null;
  return new PublicKey(v);
}

export function remainingAccountsFromEnvForCcipSend(): Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }> {
  const accounts: Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }> = [];
  for (const name of CCIP_ENVS) {
    const v = process.env[name];
    if (!v) continue;
    accounts.push({ pubkey: new PublicKey(v), isSigner: false, isWritable: false });
  }
  // Always include CCIP router program as a non-writable, non-signer account if not present
  if (!accounts.some((a) => a.pubkey.equals(CCIP_ROUTER_PROGRAM))) {
    accounts.unshift({ pubkey: CCIP_ROUTER_PROGRAM, isSigner: false, isWritable: false });
  }
  return accounts;
}

export const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

export const dispatcherProgram = anchor.workspace.Dispatcher as Program<Dispatcher>;
export const mapleAdapterProgram = anchor.workspace.MapleAdapter as Program<MapleAdapter>;
export const systemProgram = anchor.web3.SystemProgram.programId;

export function keypairFromSeed(label: string): Keypair {
  const seed = createHash("sha256").update(`solana-yield-adapter-standard:mainnet-fork:${label}`).digest();
  return Keypair.fromSeed(seed);
}

export const mapleTestAuthority = keypairFromSeed("maple-test-authority");
export const [registryPda] = findRegistryPda(dispatcherProgram.programId);
export const [mapleAdapterPda] = findAdapterPda(
  dispatcherProgram.programId,
  mapleAdapterProgram.programId,
  mapleTestAuthority.publicKey,
);

export function findRegistryPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from(SEED_PREFIX), Buffer.from(SEED_REGISTRY)], programId);
}

export function findAdapterPda(programId: PublicKey, adapterProgramId: PublicKey, authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([
    Buffer.from(SEED_PREFIX),
    adapterProgramId.toBuffer(),
    Buffer.from(SEED_ADAPTER),
    authority.toBuffer(),
  ], programId);
}

export async function airdrop(pubkey: PublicKey, lamports = 5 * anchor.web3.LAMPORTS_PER_SOL): Promise<void> {
  const latest = await provider.connection.getLatestBlockhash();
  const signature = await provider.connection.requestAirdrop(pubkey, lamports);
  await provider.connection.confirmTransaction({ signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight });
}

export async function registerAdapter(dispatcherProgramId: PublicKey, adapterProgramId: PublicKey, authority: Keypair, supportedMint: PublicKey, status: number): Promise<void> {
  const adapterPda = findAdapterPda(dispatcherProgramId, adapterProgramId, authority.publicKey)[0];
  const tx = new anchor.web3.Transaction();
  const ix = await dispatcherProgram.methods
    .adapterInit({ authority: authority.publicKey, programId: adapterProgramId, supportedMint, status })
    .accounts({ initializer: provider.wallet.publicKey, adapter: adapterPda, registry: registryPda, systemProgram })
    .instruction();

  tx.add(ix);
  tx.feePayer = provider.wallet.publicKey;
  const latest = await provider.connection.getLatestBlockhash();
  tx.recentBlockhash = latest.blockhash;
  const signedTx = await provider.wallet.signTransaction(tx);
  const sig = await provider.connection.sendRawTransaction(signedTx.serialize());
  await provider.connection.confirmTransaction(sig, "confirmed");
}

export async function simulateAndDecodeU64ReturnData(instruction: anchor.web3.TransactionInstruction): Promise<bigint> {
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
  const value = raw.readBigUInt64LE(0);
  return value;
}

export async function assertProgramIsExecutable(connection: anchor.web3.Connection, programId: PublicKey, label: string): Promise<void> {
  const info = await connection.getAccountInfo(programId);
  if (!info) throw new Error(`${label} ${programId.toBase58()} is not deployed locally.`);
  if (!info.executable) throw new Error(`${label} ${programId.toBase58()} exists but is not executable.`);
}

export async function assertAccountExists(connection: anchor.web3.Connection, pubkey: PublicKey, label: string): Promise<void> {
  const info = await connection.getAccountInfo(pubkey);
  if (!info) throw new Error(`${label} ${pubkey.toBase58()} does not exist in the local validator.`);
  if (info.data.length === 0) throw new Error(`${label} ${pubkey.toBase58()} exists but contains no data.`);
}

export async function setupMapleFork(): Promise<void> {
  await airdrop(mapleTestAuthority.publicKey);

  try {
    await dispatcherProgram.account.registry.fetch(registryPda);
  } catch {
    await dispatcherProgram.methods.registryInit().accounts({ initializer: provider.wallet.publicKey, registry: registryPda, systemProgram }).rpc();
  }

  let adapterAccount;
  try {
    adapterAccount = await dispatcherProgram.account.adapter.fetch(mapleAdapterPda);
  } catch {
    await registerAdapter(dispatcherProgram.programId, mapleAdapterProgram.programId, mapleTestAuthority, USDC_MINT, ADAPTER_STATUS_ACTIVE);
    adapterAccount = await dispatcherProgram.account.adapter.fetch(mapleAdapterPda);
  }

  if (!adapterAccount.programId.equals(mapleAdapterProgram.programId)) {
    throw new Error(`Existing adapter PDA ${mapleAdapterPda.toBase58()} points to ${adapterAccount.programId.toBase58()}, expected ${mapleAdapterProgram.programId.toBase58()}. Restart validator with --reset or re-register the adapter.`);
  }

  if (!adapterAccount.supportedMint.equals(USDC_MINT)) {
    throw new Error(`Expected registered adapter supported_mint to be ${USDC_MINT.toBase58()}`);
  }

  if (adapterAccount.status !== ADAPTER_STATUS_ACTIVE) {
    throw new Error(`Expected registered adapter status to be Active (${ADAPTER_STATUS_ACTIVE})`);
  }

  await assertProgramIsExecutable(provider.connection, dispatcherProgram.programId, "Dispatcher program");
  await assertProgramIsExecutable(provider.connection, mapleAdapterProgram.programId, "Maple adapter program");
  await assertProgramIsExecutable(provider.connection, CCIP_ROUTER_PROGRAM, "CCIP Router program");
  await assertAccountExists(provider.connection, USDC_MINT, "USDC mint");

  if (SYRUP_USDC_MINT) {
    await assertAccountExists(provider.connection, SYRUP_USDC_MINT, "syrupUSDC mint");
  }

  if (USER_SYRUP_USDC_ATA) {
    await assertAccountExists(provider.connection, USER_SYRUP_USDC_ATA, "user syrupUSDC ATA");
  }
}
