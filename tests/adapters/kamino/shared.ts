import * as anchor from "@anchor-lang/core";
import { createHash } from "crypto";
import { Keypair, PublicKey } from "@solana/web3.js";
import { Address, TransactionSigner, address } from "@solana/kit";
import { createSolanaRpc } from "@solana/rpc";
import { KaminoAction, KaminoMarket, Reserve, VanillaObligation } from "@kamino-finance/klend-sdk";
import { KaminoAdapter } from "../../target/types/kamino_adapter";

export function keypairFromSeed(label: string): Keypair {
  const seed = createHash("sha256").update(`solana-yield-adapter-standard:adapters:kaminodirect:${label}`).digest();
  return Keypair.fromSeed(seed);
}

export const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

export const KAMINO_KLEND_PROGRAM = new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

export const KAMINO_USDC_RESERVE = (() => {
  const envValue = process.env.KAMINO_USDC_RESERVE;
  if (!envValue) {
    throw new Error("KAMINO_USDC_RESERVE env var is required for Kamino adapter direct tests");
  }
  return new PublicKey(envValue);
})();

export const kaminoAdapterProgram = anchor.workspace.KaminoAdapter as anchor.Program<KaminoAdapter>;
export const kaminoTestAuthority = keypairFromSeed("kamino-test-authority");

export async function assertAccountExists(pubkey: PublicKey, label: string): Promise<void> {
  const info = await provider.connection.getAccountInfo(pubkey);
  if (!info) {
    throw new Error(`${label} ${pubkey.toBase58()} does not exist in the local validator`);
  }
  if (info.data.length === 0) {
    throw new Error(`${label} ${pubkey.toBase58()} exists but has empty data`);
  }
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
  };
}

export function extractKaminoInstruction(action: any): anchor.web3.TransactionInstruction {
  if (!action || !Array.isArray(action.lendingIxs) || action.lendingIxs.length === 0) {
    throw new Error("Kamino action did not build any lending instructions");
  }
  return action.lendingIxs[action.lendingIxs.length - 1];
}

export function remainingAccountsForInstruction(
  instruction: anchor.web3.TransactionInstruction,
): Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }> {
  return instruction.keys.map((key) => ({
    pubkey: key.pubkey,
    isSigner: key.isSigner,
    isWritable: key.isWritable,
  }));
}
