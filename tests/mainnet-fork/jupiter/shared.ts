import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { createHash } from "crypto";
import { Keypair, PublicKey } from "@solana/web3.js";
import { Dispatcher } from "../../../target/types/dispatcher";
import { JupiterAdapter } from "../../../target/types/jupiter_adapter";

export const SEED_PREFIX = "dispatcher";
export const SEED_REGISTRY = "registry";
export const SEED_ADAPTER = "adapter_info";
export const ADAPTER_STATUS_ACTIVE = 0;

export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
export const JUPITER_PROGRAM_ID = pubkeyFromEnv(
  "JUPITER_PROGRAM_ID",
  new PublicKey("PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu"),
);
export const JUPITER_POSITION_ACCOUNT = optionalPubkeyFromEnv("JUPITER_POSITION_ACCOUNT");
export const JUPITER_POOL_ACCOUNT = optionalPubkeyFromEnv("JUPITER_POOL_ACCOUNT");
export const JUPITER_LP_MINT = optionalPubkeyFromEnv("JUPITER_LP_MINT");
export const USER_LP_ATA = optionalPubkeyFromEnv("USER_LP_ATA");
export const USER_USDC_ATA = optionalPubkeyFromEnv("USER_USDC_ATA");
export const JUPITER_POSITION_NONZERO = process.env.JUPITER_POSITION_NONZERO === "true";

export const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

export const dispatcherProgram = anchor.workspace.Dispatcher as Program<Dispatcher>;
export const jupiterAdapterProgram = anchor.workspace.JupiterAdapter as Program<JupiterAdapter>;
export const systemProgram = anchor.web3.SystemProgram.programId;

export function keypairFromSeed(label: string): Keypair {
  const seed = createHash("sha256").update(`solana-yield-adapter-standard:mainnet-fork:${label}`).digest();
  return Keypair.fromSeed(seed);
}

export const jupiterTestAuthority = keypairFromSeed("jupiter-test-authority");
export const [registryPda] = findRegistryPda(dispatcherProgram.programId);
export const [jupiterAdapterPda] = findAdapterPda(
  dispatcherProgram.programId,
  jupiterAdapterProgram.programId,
  jupiterTestAuthority.publicKey,
);

export function findRegistryPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from(SEED_PREFIX), Buffer.from(SEED_REGISTRY)], programId);
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

export function pubkeyFromEnv(name: string, fallback?: PublicKey): PublicKey {
  const value = process.env[name];

  if (value) {
    try {
      return new PublicKey(value);
    } catch (error) {
      throw new Error(`Invalid ${name} pubkey: ${String(error)}`);
    }
  }

  if (fallback) {
    return fallback;
  }

  throw new Error(`${name} env var is required for Jupiter mainnet-fork tests`);
}

export function optionalPubkeyFromEnv(name: string): PublicKey | null {
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

export async function airdrop(pubkey: PublicKey, lamports = 5 * anchor.web3.LAMPORTS_PER_SOL): Promise<void> {
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

export async function setupJupiterFork(): Promise<void> {
  await airdrop(jupiterTestAuthority.publicKey);

  try {
    await dispatcherProgram.account.registry.fetch(registryPda);
  } catch {
    await dispatcherProgram.methods
      .registryInit()
      .accounts({ initializer: provider.wallet.publicKey, registry: registryPda, systemProgram })
      .rpc();
  }

  let adapterAccount;
  try {
    adapterAccount = await dispatcherProgram.account.adapter.fetch(jupiterAdapterPda);
  } catch {
    await registerAdapter(
      dispatcherProgram.programId,
      jupiterAdapterProgram.programId,
      jupiterTestAuthority,
      USDC_MINT,
      ADAPTER_STATUS_ACTIVE,
    );
    adapterAccount = await dispatcherProgram.account.adapter.fetch(jupiterAdapterPda);
  }

  if (!adapterAccount.programId.equals(jupiterAdapterProgram.programId)) {
    throw new Error(
      `Existing adapter PDA ${jupiterAdapterPda.toBase58()} points to ${adapterAccount.programId.toBase58()}, expected ${jupiterAdapterProgram.programId.toBase58()}. Restart validator with --reset or re-register the adapter.`,
    );
  }

  if (!adapterAccount.supportedMint.equals(USDC_MINT)) {
    throw new Error(`Expected registered adapter supported_mint to be ${USDC_MINT.toBase58()}`);
  }

  if (adapterAccount.status !== ADAPTER_STATUS_ACTIVE) {
    throw new Error(`Expected registered adapter status to be Active (${ADAPTER_STATUS_ACTIVE})`);
  }

  await assertProgramIsExecutable(provider.connection, dispatcherProgram.programId, "Dispatcher program");
  await assertProgramIsExecutable(provider.connection, jupiterAdapterProgram.programId, "Jupiter adapter program");
  await assertProgramIsExecutable(provider.connection, JUPITER_PROGRAM_ID, "Jupiter protocol program");
  await assertAccountExists(provider.connection, USDC_MINT, "USDC mint");

  if (JUPITER_POSITION_ACCOUNT) {
    await assertAccountExists(provider.connection, JUPITER_POSITION_ACCOUNT, "Jupiter borrow position account");
  }
  if (JUPITER_POOL_ACCOUNT) {
    await assertAccountExists(provider.connection, JUPITER_POOL_ACCOUNT, "Jupiter pool account");
  }
  if (JUPITER_LP_MINT) {
    await assertAccountExists(provider.connection, JUPITER_LP_MINT, "Jupiter LP mint");
  }
  if (USER_LP_ATA) {
    await assertAccountExists(provider.connection, USER_LP_ATA, "User LP token ATA");
  }
  if (USER_USDC_ATA) {
    await assertAccountExists(provider.connection, USER_USDC_ATA, "User USDC ATA");
  }
}

export function jupiterDepositRemainingAccounts(): Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }> {
  const accounts: Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }> = [];

  if (JUPITER_PROGRAM_ID) {
    accounts.push({ pubkey: JUPITER_PROGRAM_ID, isSigner: false, isWritable: false });
  }
  if (JUPITER_POSITION_ACCOUNT) {
    accounts.push({ pubkey: JUPITER_POSITION_ACCOUNT, isSigner: false, isWritable: false });
  }
  if (JUPITER_POOL_ACCOUNT) {
    accounts.push({ pubkey: JUPITER_POOL_ACCOUNT, isSigner: false, isWritable: false });
  }
  if (JUPITER_LP_MINT) {
    accounts.push({ pubkey: JUPITER_LP_MINT, isSigner: false, isWritable: false });
  }
  if (USER_LP_ATA) {
    accounts.push({ pubkey: USER_LP_ATA, isSigner: false, isWritable: true });
  }
  if (USER_USDC_ATA) {
    accounts.push({ pubkey: USER_USDC_ATA, isSigner: false, isWritable: true });
  }

  return accounts;
}

export function jupiterWithdrawRemainingAccounts(): Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }> {
  return jupiterDepositRemainingAccounts();
}
