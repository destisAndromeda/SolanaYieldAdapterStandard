import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { createHash } from "crypto";
import { Keypair, PublicKey } from "@solana/web3.js";
import { Address, AccountRole, Instruction, TransactionSigner, address } from "@solana/kit";
import { createSolanaRpc } from "@solana/rpc";
import { KaminoAction, KaminoMarket, Reserve, VanillaObligation } from "@kamino-finance/klend-sdk";
import { Dispatcher } from "../../../target/types/dispatcher";
import { KaminoAdapter } from "../../../target/types/kamino_adapter";

/** Deterministic keypair — stable across mainnet-fork test files. */
export function keypairFromSeed(label: string): Keypair {
  const seed = createHash("sha256")
    .update(`solana-yield-adapter-standard:mainnet-fork:${label}`)
    .digest();
  return Keypair.fromSeed(seed);
}

// Dispatcher seeds and constants
export const SEED_PREFIX = "dispatcher";
export const SEED_REGISTRY = "registry";
export const SEED_ADAPTER = "adapter_info";
export const ADAPTER_STATUS_ACTIVE = 0;

// Real mainnet addresses
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
export const KAMINO_KLEND_PROGRAM = new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
export const KAMINO_ADAPTER_PROGRAM_ID = new PublicKey("BaxHrSyiFkoS4on2HmmEBCAL7BwMfXnZarpHNx6V3GrT");

export const KAMINO_USDC_RESERVE = (() => {
  const envValue = process.env.KAMINO_USDC_RESERVE;
  if (!envValue) {
    throw new Error("KAMINO_USDC_RESERVE env var is required for Kamino mainnet-fork tests");
  }
  return new PublicKey(envValue);
})();

export const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

export const dispatcherProgram = anchor.workspace.Dispatcher as Program<Dispatcher>;
export const kaminoAdapterProgram = anchor.workspace.KaminoAdapter as Program<KaminoAdapter>;
export const systemProgram = anchor.web3.SystemProgram.programId;

// Test authorities and PDAs
export const kaminoTestAuthority = keypairFromSeed("kamino-test-authority");

export const [registryPda, registryBump] = findRegistryPda(dispatcherProgram.programId);

export const [kaminoAdapterPda] = findAdapterPda(
  dispatcherProgram.programId,
  kaminoAdapterProgram.programId,
  kaminoTestAuthority.publicKey,
);

/**
 * Finds the registry PDA for the dispatcher.
 */
export function findRegistryPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_PREFIX), Buffer.from(SEED_REGISTRY)],
    programId,
  );
}

/**
 * Finds the adapter PDA for the dispatcher.
 */
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

/**
 * Airdrops SOL to a public key.
 */
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

/**
 * Registers an adapter in the dispatcher registry.
 * Assumes registry has already been initialized.
 */
export async function registerAdapter(
  dispatcherProgramId: PublicKey,
  adapterProgramId: PublicKey,
  authority: Keypair,
  supportedMint: PublicKey,
  status: number,
): Promise<void> {
  const adapterPda = findAdapterPda(dispatcherProgramId, adapterProgramId, authority.publicKey)[0];

  // Build adapter_init instruction
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

/**
 * Simulates a transaction and decodes a little-endian u64 from return data.
 * Throws if return data is not present.
 */
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
  const value = raw.readBigUInt64LE(0);
  return value;
}

function getSdkRpc() {
  const endpoint = (provider.connection as any).rpcEndpoint ?? "http://127.0.0.1:8899";
  return createSolanaRpc(endpoint);
}

export async function loadKaminoMarket(): Promise<KaminoMarket> {
  const rpc = getSdkRpc();
  const reserveAccount = await Reserve.fetch(
    rpc,
    address(KAMINO_USDC_RESERVE.toBase58()),
    address(KAMINO_KLEND_PROGRAM.toBase58()),
  );

  if (!reserveAccount) {
    throw new Error(`Failed to fetch Kamino reserve ${KAMINO_USDC_RESERVE.toBase58()}`);
  }

  const marketAddress = reserveAccount.lendingMarket;
  const market = await KaminoMarket.load(
    rpc,
    marketAddress,
    5000,
    address(KAMINO_KLEND_PROGRAM.toBase58()),
  );

  if (!market) {
    throw new Error(`Failed to load Kamino market ${marketAddress}`);
  }

  return market;
}

export async function getKaminoUsdcReserve(market?: KaminoMarket) {
  const loadedMarket = market ?? (await loadKaminoMarket());
  const reserve = loadedMarket.getReserveByAddress(address(KAMINO_USDC_RESERVE.toBase58()));
  if (!reserve) {
    throw new Error(`Kamino reserve ${KAMINO_USDC_RESERVE.toBase58()} not found in market ${loadedMarket.getAddress()}`);
  }
  return reserve;
}

export function createKaminoSigner(keypair: Keypair): TransactionSigner {
  return {
    address: address(keypair.publicKey.toBase58()),
    signTransactions: async (transactions: any[]) => {
      return transactions.map((tx) => {
        tx.partialSign(keypair);
        return tx;
      });
    },
  } as TransactionSigner;
}

export async function assertProgramExists(
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

export async function setupKaminoFork(): Promise<void> {
  await airdrop(kaminoTestAuthority.publicKey);

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
    adapterAccount = await dispatcherProgram.account.adapter.fetch(kaminoAdapterPda);
  } catch {
    await registerAdapter(
      dispatcherProgram.programId,
      kaminoAdapterProgram.programId,
      kaminoTestAuthority,
      USDC_MINT,
      ADAPTER_STATUS_ACTIVE,
    );
    adapterAccount = await dispatcherProgram.account.adapter.fetch(kaminoAdapterPda);
  }

  if (!adapterAccount.programId.equals(kaminoAdapterProgram.programId)) {
    throw new Error(
      `Existing adapter PDA ${kaminoAdapterPda.toBase58()} points to ${adapterAccount.programId.toBase58()}, expected ${kaminoAdapterProgram.programId.toBase58()}. Restart validator with --reset or re-register the adapter.`,
    );
  }

  if (!adapterAccount.supportedMint.equals(USDC_MINT)) {
    throw new Error(`Expected registered adapter supported_mint to be ${USDC_MINT.toBase58()}`);
  }

  if (adapterAccount.status !== ADAPTER_STATUS_ACTIVE) {
    throw new Error(`Expected registered adapter status to be Active (${ADAPTER_STATUS_ACTIVE})`);
  }

  await assertProgramExists(provider.connection, dispatcherProgram.programId, "Dispatcher program");
  await assertProgramExists(provider.connection, kaminoAdapterProgram.programId, "Kamino adapter program");
  await assertProgramExists(provider.connection, KAMINO_KLEND_PROGRAM, "Kamino KLend program");
  await assertAccountExists(provider.connection, USDC_MINT, "USDC mint");
  await assertAccountExists(provider.connection, KAMINO_USDC_RESERVE, "Kamino USDC reserve");

  const market = await loadKaminoMarket();
  const reserve = await getKaminoUsdcReserve(market);
  if (!reserve) {
    throw new Error(`Expected Kamino reserve ${KAMINO_USDC_RESERVE.toBase58()} to be present in the market`);
  }
}

export function extractKaminoInstruction(action: any): Instruction {
  if (!action || !Array.isArray(action.lendingIxs) || action.lendingIxs.length === 0) {
    throw new Error("Kamino action did not build any lending instructions");
  }
  return action.lendingIxs[action.lendingIxs.length - 1];
}

export function remainingAccountsForInstruction(
  instruction: Instruction,
): Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }> {
  if (!instruction.accounts) {
    return [];
  }

  return instruction.accounts.map((account) => {
    const isSigner =
      account.role === AccountRole.READONLY_SIGNER ||
      account.role === AccountRole.WRITABLE_SIGNER;
    const isWritable =
      account.role === AccountRole.WRITABLE ||
      account.role === AccountRole.WRITABLE_SIGNER;

    return {
      pubkey: new PublicKey(account.address as string),
      isSigner,
      isWritable,
    };
  });
}

export async function printRequiredForkAccounts(): Promise<void> {
  const market = await loadKaminoMarket();
  const reserve = await getKaminoUsdcReserve(market);
  const usdcReserves = market.getReservesByMint(address(USDC_MINT.toBase58()));

  console.log("Kamino mainnet-fork required accounts:");
  console.log(`  KLend program: ${KAMINO_KLEND_PROGRAM.toBase58()}`);
  console.log(`  Kamino adapter: ${KAMINO_ADAPTER_PROGRAM_ID.toBase58()}`);
  console.log(`  USDC mint: ${USDC_MINT.toBase58()}`);
  console.log(`  Kamino USDC reserve: ${KAMINO_USDC_RESERVE.toBase58()}`);
  console.log(`  Kamino market: ${market.getAddress()}`);
  console.log(`  Discovered USDC reserves: ${usdcReserves.map((r) => r.address).join(", ")}`);
  console.log(`  Loaded reserve address: ${reserve.address}`);
}
