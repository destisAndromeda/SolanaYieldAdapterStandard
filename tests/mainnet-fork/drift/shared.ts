import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { createHash } from "crypto";
import { Keypair, PublicKey } from "@solana/web3.js";
import { Dispatcher } from "../../../target/types/dispatcher";
import { DriftAdapter } from "../../../target/types/drift_adapter";

export const SEED_PREFIX = "dispatcher";
export const SEED_REGISTRY = "registry";
export const SEED_ADAPTER = "adapter_info";
export const ADAPTER_STATUS_ACTIVE = 0;
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
export const DRIFT_PROGRAM_ID = new PublicKey("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");
export const DRIFT_USDC_IF_VAULT = new PublicKey("2CqkQvYxp9Mq4PqLvAQ1eryYxebUh4Liyn5YMDtXsYci");

export const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

export const dispatcherProgram = anchor.workspace.Dispatcher as Program<Dispatcher>;
export const driftAdapterProgram = anchor.workspace.DriftAdapter as Program<DriftAdapter>;
export const systemProgram = anchor.web3.SystemProgram.programId;

export function keypairFromSeed(label: string): Keypair {
  const seed = createHash("sha256")
    .update(`solana-yield-adapter-standard:mainnet-fork:${label}`)
    .digest();
  return Keypair.fromSeed(seed);
}

export const driftTestAuthority = keypairFromSeed("drift-test-authority");
export const [registryPda] = findRegistryPda(dispatcherProgram.programId);
export const [driftAdapterPda] = findAdapterPda(
  dispatcherProgram.programId,
  driftAdapterProgram.programId,
  driftTestAuthority.publicKey,
);

export const DRIFT_USER = parseOptionalPubkey("DRIFT_USER");
export const DRIFT_USER_STATS = parseOptionalPubkey("DRIFT_USER_STATS");
export const DRIFT_STATE = parseOptionalPubkey("DRIFT_STATE");
export const DRIFT_USDC_SPOT_MARKET = parseOptionalPubkey("DRIFT_USDC_SPOT_MARKET");
export const DRIFT_INSURANCE_FUND_STAKE = parseOptionalPubkey("DRIFT_INSURANCE_FUND_STAKE");
export const USER_USDC_ATA = parseOptionalPubkey("USER_USDC_ATA");

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

function parseOptionalPubkey(name: string): PublicKey | null {
  const value = process.env[name];
  if (!value) {
    return null;
  }

  try {
    return new PublicKey(value);
  } catch (error) {
    throw new Error(`Invalid ${name} pubkey: ${String(error)}`);
  }
}

export async function airdrop(
  pubkey: PublicKey,
  lamports = 5 * anchor.web3.LAMPORTS_PER_SOL,
): Promise<void> {
  const latest = await provider.connection.getLatestBlockhash();
  const signature = await provider.connection.requestAirdrop(pubkey, lamports);
  await provider.connection.confirmTransaction({
    signature,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  });
}

export async function registerAdapter(
  dispatcherProgramId: PublicKey,
  adapterProgramId: PublicKey,
  authority: Keypair,
  supportedMint: PublicKey,
  status: number,
): Promise<void> {
  const adapterPda = findAdapterPda(dispatcherProgramId, adapterProgramId, authority.publicKey)[0];

  const tx = new anchor.web3.Transaction();
  const ix = await dispatcherProgram.methods
    .adapterInit({
      authority: authority.publicKey,
      programId: adapterProgramId,
      supportedMint,
      status,
    })
    .accounts({
      initializer: provider.wallet.publicKey,
      adapter: adapterPda,
      registry: registryPda,
      systemProgram,
    })
    .instruction();

  tx.add(ix);
  tx.feePayer = provider.wallet.publicKey;
  const latest = await provider.connection.getLatestBlockhash();
  tx.recentBlockhash = latest.blockhash;

  const signedTx = await provider.wallet.signTransaction(tx);
  const sig = await provider.connection.sendRawTransaction(signedTx.serialize());
  await provider.connection.confirmTransaction(sig, "confirmed");
}

export async function simulateAndDecodeU64ReturnData(
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

export async function assertProgramIsExecutable(
  connection: anchor.web3.Connection,
  programId: PublicKey,
  label: string,
): Promise<void> {
  const info = await connection.getAccountInfo(programId);
  if (!info) {
    throw new Error(`${label} ${programId.toBase58()} is not deployed locally.`);
  }
  if (!info.executable) {
    throw new Error(`${label} ${programId.toBase58()} exists but is not executable.`);
  }
}

export async function assertAccountExists(
  connection: anchor.web3.Connection,
  pubkey: PublicKey,
  label: string,
): Promise<void> {
  const info = await connection.getAccountInfo(pubkey);
  if (!info) {
    throw new Error(`${label} ${pubkey.toBase58()} does not exist in the local validator.`);
  }
  if (info.data.length === 0) {
    throw new Error(`${label} ${pubkey.toBase58()} exists but contains no data.`);
  }
}

export async function setupDriftFork(): Promise<void> {
  await airdrop(driftTestAuthority.publicKey);

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

  let adapterAccount;
  try {
    adapterAccount = await dispatcherProgram.account.adapter.fetch(driftAdapterPda);
  } catch {
    await registerAdapter(
      dispatcherProgram.programId,
      driftAdapterProgram.programId,
      driftTestAuthority,
      USDC_MINT,
      ADAPTER_STATUS_ACTIVE,
    );
    adapterAccount = await dispatcherProgram.account.adapter.fetch(driftAdapterPda);
  }

  if (!adapterAccount.programId.equals(driftAdapterProgram.programId)) {
    throw new Error(
      `Existing adapter PDA ${driftAdapterPda.toBase58()} points to ${adapterAccount.programId.toBase58()}, expected ${driftAdapterProgram.programId.toBase58()}. Restart validator with --reset or re-register the adapter.`,
    );
  }

  if (!adapterAccount.supportedMint.equals(USDC_MINT)) {
    throw new Error(`Expected registered adapter supported_mint to be ${USDC_MINT.toBase58()}`);
  }

  if (adapterAccount.status !== ADAPTER_STATUS_ACTIVE) {
    throw new Error(`Expected registered adapter status to be Active (${ADAPTER_STATUS_ACTIVE})`);
  }

  await assertProgramIsExecutable(provider.connection, dispatcherProgram.programId, "Dispatcher program");
  await assertProgramIsExecutable(provider.connection, driftAdapterProgram.programId, "Drift adapter program");
  await assertProgramIsExecutable(provider.connection, DRIFT_PROGRAM_ID, "Drift program");
  await assertAccountExists(provider.connection, USDC_MINT, "USDC mint");
  await assertAccountExists(provider.connection, DRIFT_USDC_IF_VAULT, "Drift USDC insurance fund vault");

  if (DRIFT_USER) {
    await assertAccountExists(provider.connection, DRIFT_USER, "Drift user account");
  }
  if (DRIFT_USER_STATS) {
    await assertAccountExists(provider.connection, DRIFT_USER_STATS, "Drift user stats account");
  }
  if (DRIFT_STATE) {
    await assertAccountExists(provider.connection, DRIFT_STATE, "Drift state account");
  }
  if (DRIFT_USDC_SPOT_MARKET) {
    await assertAccountExists(provider.connection, DRIFT_USDC_SPOT_MARKET, "Drift USDC spot market");
  }
  if (DRIFT_INSURANCE_FUND_STAKE) {
    await assertAccountExists(provider.connection, DRIFT_INSURANCE_FUND_STAKE, "Drift insurance fund stake account");
  }
  if (USER_USDC_ATA) {
    await assertAccountExists(provider.connection, USER_USDC_ATA, "User USDC ATA");
  }
}

export function remainingAccountsForInstruction(
  instruction: any,
): Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }> {
  if (!instruction) {
    return [];
  }

  if (Array.isArray(instruction.keys)) {
    return instruction.keys.map((key: any) => ({
      pubkey: new PublicKey(key.pubkey ?? key.pubkey?.toString() ?? key.address),
      isSigner: Boolean(key.isSigner),
      isWritable: Boolean(key.isWritable),
    }));
  }

  if (Array.isArray(instruction.accounts)) {
    return instruction.accounts.map((account: any) => {
      const pubkey = account.pubkey ?? account.address ?? account.key;
      return {
        pubkey: new PublicKey(pubkey.toString()),
        isSigner: Boolean(account.isSigner || account.is_signer),
        isWritable: Boolean(account.isWritable || account.is_writable),
      };
    });
  }

  return [];
}
