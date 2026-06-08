import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { createHash } from "crypto";
import { Keypair, PublicKey } from "@solana/web3.js";
import { Dispatcher } from "../../../target/types/dispatcher";
import { MarginfiAdapter } from "../../../target/types/marginfi_adapter";

export const SEED_PREFIX = "dispatcher";
export const SEED_REGISTRY = "registry";
export const SEED_ADAPTER = "adapter_info";
export const ADAPTER_STATUS_ACTIVE = 0;
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
export const MARGINFI_PROGRAM_ID = pubkeyFromEnv("MARGINFI_PROGRAM_ID");
export const MARGINFI_GROUP = pubkeyFromEnv("MARGINFI_GROUP");
export const MARGINFI_USDC_BANK = pubkeyFromEnv("MARGINFI_USDC_BANK");
export const MARGINFI_ACCOUNT = optionalPubkeyFromEnv("MARGINFI_ACCOUNT");
export const USER_USDC_ATA = optionalPubkeyFromEnv("USER_USDC_ATA");
export const USER_USDC_DESTINATION_ATA = optionalPubkeyFromEnv("USER_USDC_DESTINATION_ATA");
export const BANK_LIQUIDITY_VAULT = optionalPubkeyFromEnv("BANK_LIQUIDITY_VAULT");
export const BANK_LIQUIDITY_VAULT_AUTHORITY = optionalPubkeyFromEnv("BANK_LIQUIDITY_VAULT_AUTHORITY");
export const TOKEN_PROGRAM = optionalPubkeyFromEnv("TOKEN_PROGRAM") ?? new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

export function pubkeyFromEnv(name: string): PublicKey {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} env var is required for MarginFi mainnet-fork tests`);
  }

  try {
    return new PublicKey(value);
  } catch (error) {
    throw new Error(`Invalid ${name} pubkey: ${String(error)}`);
  }
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

export const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

export const dispatcherProgram = anchor.workspace.Dispatcher as Program<Dispatcher>;
export const marginfiAdapterProgram = anchor.workspace.MarginfiAdapter as Program<MarginfiAdapter>;
export const systemProgram = anchor.web3.SystemProgram.programId;

export function keypairFromSeed(label: string): Keypair {
  const seed = createHash("sha256").update(`solana-yield-adapter-standard:mainnet-fork:${label}`).digest();
  return Keypair.fromSeed(seed);
}

export const marginfiTestAuthority = keypairFromSeed("marginfi-test-authority");
export const [registryPda] = findRegistryPda(dispatcherProgram.programId);
export const [marginfiAdapterPda] = findAdapterPda(
  dispatcherProgram.programId,
  marginfiAdapterProgram.programId,
  marginfiTestAuthority.publicKey,
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
  if (!info) throw new Error(`${label} ${programId.toBase58()} is not deployed locally.`);
  if (!info.executable) throw new Error(`${label} ${programId.toBase58()} exists but is not executable.`);
}

export async function assertAccountExists(
  connection: anchor.web3.Connection,
  pubkey: PublicKey,
  label: string,
): Promise<void> {
  const info = await connection.getAccountInfo(pubkey);
  if (!info) throw new Error(`${label} ${pubkey.toBase58()} does not exist in the local validator.`);
  if (info.data.length === 0) throw new Error(`${label} ${pubkey.toBase58()} exists but contains no data.`);
}

export async function setupMarginfiFork(): Promise<void> {
  await airdrop(marginfiTestAuthority.publicKey);

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
    adapterAccount = await dispatcherProgram.account.adapter.fetch(marginfiAdapterPda);
  } catch {
    await registerAdapter(
      dispatcherProgram.programId,
      marginfiAdapterProgram.programId,
      marginfiTestAuthority,
      USDC_MINT,
      ADAPTER_STATUS_ACTIVE,
    );
    adapterAccount = await dispatcherProgram.account.adapter.fetch(marginfiAdapterPda);
  }

  if (!adapterAccount.programId.equals(marginfiAdapterProgram.programId)) {
    throw new Error(
      `Existing adapter PDA ${marginfiAdapterPda.toBase58()} points to ${adapterAccount.programId.toBase58()}, expected ${marginfiAdapterProgram.programId.toBase58()}. Restart validator with --reset or re-register the adapter.`,
    );
  }

  if (!adapterAccount.supportedMint.equals(USDC_MINT)) {
    throw new Error(`Expected registered adapter supported_mint to be ${USDC_MINT.toBase58()}`);
  }

  if (adapterAccount.status !== ADAPTER_STATUS_ACTIVE) {
    throw new Error(`Expected registered adapter status to be Active (${ADAPTER_STATUS_ACTIVE})`);
  }

  await assertProgramIsExecutable(provider.connection, dispatcherProgram.programId, "Dispatcher program");
  await assertProgramIsExecutable(provider.connection, marginfiAdapterProgram.programId, "MarginFi adapter program");
  await assertProgramIsExecutable(provider.connection, MARGINFI_PROGRAM_ID, "MarginFi program");
  await assertAccountExists(provider.connection, USDC_MINT, "USDC mint");
  await assertAccountExists(provider.connection, MARGINFI_GROUP, "MarginFi group");
  await assertAccountExists(provider.connection, MARGINFI_USDC_BANK, "MarginFi USDC bank");

  if (MARGINFI_ACCOUNT) {
    await assertAccountExists(provider.connection, MARGINFI_ACCOUNT, "MarginFi account");
  }
  if (USER_USDC_ATA) {
    await assertAccountExists(provider.connection, USER_USDC_ATA, "User USDC ATA");
  }
  if (USER_USDC_DESTINATION_ATA) {
    await assertAccountExists(provider.connection, USER_USDC_DESTINATION_ATA, "User USDC destination ATA");
  }
  if (BANK_LIQUIDITY_VAULT) {
    await assertAccountExists(provider.connection, BANK_LIQUIDITY_VAULT, "Bank liquidity vault");
  }
  if (BANK_LIQUIDITY_VAULT_AUTHORITY) {
    await assertAccountExists(provider.connection, BANK_LIQUIDITY_VAULT_AUTHORITY, "Bank liquidity vault authority");
  }
  if (process.env.TOKEN_PROGRAM) {
    await assertAccountExists(provider.connection, TOKEN_PROGRAM, "Token program");
  }
}

export function marginfiDepositRemainingAccounts(): Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }> {
  const accounts: Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }> = [
    { pubkey: MARGINFI_GROUP, isSigner: false, isWritable: false },
    { pubkey: MARGINFI_USDC_BANK, isSigner: false, isWritable: true },
  ];

  if (MARGINFI_ACCOUNT) {
    accounts.push({ pubkey: MARGINFI_ACCOUNT, isSigner: false, isWritable: true });
  }
  if (USER_USDC_ATA) {
    accounts.push({ pubkey: USER_USDC_ATA, isSigner: false, isWritable: true });
  }
  if (BANK_LIQUIDITY_VAULT) {
    accounts.push({ pubkey: BANK_LIQUIDITY_VAULT, isSigner: false, isWritable: true });
  }
  if (BANK_LIQUIDITY_VAULT_AUTHORITY) {
    accounts.push({ pubkey: BANK_LIQUIDITY_VAULT_AUTHORITY, isSigner: false, isWritable: false });
  }
  if (TOKEN_PROGRAM) {
    accounts.push({ pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false });
  }

  return accounts;
}

export function marginfiWithdrawRemainingAccounts(): Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }> {
  const accounts: Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }> = [
    { pubkey: MARGINFI_GROUP, isSigner: false, isWritable: false },
    { pubkey: MARGINFI_USDC_BANK, isSigner: false, isWritable: true },
  ];

  if (MARGINFI_ACCOUNT) {
    accounts.push({ pubkey: MARGINFI_ACCOUNT, isSigner: false, isWritable: true });
  }
  if (USER_USDC_DESTINATION_ATA) {
    accounts.push({ pubkey: USER_USDC_DESTINATION_ATA, isSigner: false, isWritable: true });
  }
  if (BANK_LIQUIDITY_VAULT_AUTHORITY) {
    accounts.push({ pubkey: BANK_LIQUIDITY_VAULT_AUTHORITY, isSigner: false, isWritable: false });
  }
  if (BANK_LIQUIDITY_VAULT) {
    accounts.push({ pubkey: BANK_LIQUIDITY_VAULT, isSigner: false, isWritable: true });
  }
  if (TOKEN_PROGRAM) {
    accounts.push({ pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false });
  }

  return accounts;
}
