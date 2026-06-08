import { Connection, PublicKey } from "@solana/web3.js";
import { getConfig, MarginfiClient } from "@mrgnlabs/marginfi-client-v2";
import { NodeWallet, loadKeypair } from "@mrgnlabs/mrgn-common";
import { Keypair } from "@solana/web3.js";

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";

function getConnection(): Connection {
  return new Connection(process.env.MARGINFI_RPC_ENDPOINT ?? DEFAULT_RPC, {
    commitment: "confirmed",
  });
}

function getWallet(): any {
  if (process.env.MARGINFI_WALLET_KEY) {
    const secretKey = new Uint8Array(JSON.parse(process.env.MARGINFI_WALLET_KEY));
    return new NodeWallet(Keypair.fromSecretKey(secretKey) as any);
  }

  const walletPath = process.env.MARGINFI_WALLET ?? `${process.env.HOME}/.config/solana/id.json`;
  return new NodeWallet(loadKeypair(walletPath));
}

export async function loadMarginfiClient(): Promise<InstanceType<typeof MarginfiClient>> {
  const config = getConfig("production", {
    programId: process.env.MARGINFI_PROGRAM ? new PublicKey(process.env.MARGINFI_PROGRAM) : undefined,
    groupPk: process.env.MARGINFI_GROUP ? new PublicKey(process.env.MARGINFI_GROUP) : undefined,
  });

  const connection = getConnection();
  const wallet = getWallet();
  // Allow passing preloaded bank addresses to skip on-chain GPA during discovery.
  const preloadEnv = process.env.PRELOAD_BANK_ADDRS || (() => {
    const arg = process.argv.find((a) => a.startsWith("--preload-bank-addrs="));
    return arg ? arg.split("=")[1] : undefined;
  })();

  const preloadedBankAddresses = preloadEnv
    ? preloadEnv.split(",").map((s) => new PublicKey(s.trim()))
    : undefined;

  return MarginfiClient.fetch(config, wallet as any, connection as any, {
    preloadedBankAddresses: preloadedBankAddresses as any,
  } as any);
}

export async function getMarginfiUsdcBank() {
  const client = await loadMarginfiClient();
  const bank = client.getBankByTokenSymbol("USDC") ?? client.getBankByMint(USDC_MINT);

  if (!bank) {
    throw new Error("USDC bank not found in MarginFi production group");
  }

  return bank;
}

async function rawDiscoverUsdcBank(connection: Connection, programId: PublicKey) {
  console.error("Attempting raw on-chain discovery of USDC bank by scanning program accounts...");
  try {
    const accounts = await connection.getProgramAccounts(programId, { commitment: "confirmed" });
    const needle = USDC_MINT.toBuffer();
    for (const acct of accounts) {
      const data = acct.account.data;
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (buf.indexOf(needle) !== -1) {
        console.error(`Found candidate bank account: ${acct.pubkey.toBase58()}`);
        return acct.pubkey;
      }
    }
    throw new Error("No program-owned account contains the USDC mint bytes");
  } catch (err) {
    const msg = String(err || "");
    // If the RPC aborted the full scan, try memcmp-based discovery at likely offsets.
    if (msg.includes("scan aborted") || msg.includes("accumulated scan results exceeded")) {
      console.error("Full scan aborted by RPC; falling back to memcmp offset search (this may take a while)...");
      // try offsets 0..256
      for (let offset = 0; offset <= 256; offset++) {
        try {
          const bytes = USDC_MINT.toBase58();
          const res = await connection.getProgramAccounts(programId, {
            commitment: "confirmed",
            filters: [
              { memcmp: { offset, bytes } },
            ],
          });
          if (res && res.length > 0) {
            console.error(`memcmp found candidate at offset ${offset}: ${res[0].pubkey.toBase58()}`);
            return res[0].pubkey;
          }
        } catch (e) {
          // ignore and continue
        }
      }
      throw new Error("memcmp-based discovery found no candidate");
    }
    throw new Error(`raw discovery failed: ${String(err)}`);
  }
}

async function main() {
  const config = getConfig("production", {
    programId: process.env.MARGINFI_PROGRAM ? new PublicKey(process.env.MARGINFI_PROGRAM) : undefined,
    groupPk: process.env.MARGINFI_GROUP ? new PublicKey(process.env.MARGINFI_GROUP) : undefined,
  });

  console.log(`export MARGINFI_PROGRAM_ID=${config.programId.toBase58()}`);
  console.log(`export MARGINFI_GROUP=${config.groupPk.toBase58()}`);

  try {
    const bank = await getMarginfiUsdcBank();
    console.log(`export MARGINFI_USDC_BANK=${bank.address.toBase58()}`);
  } catch (err) {
    console.error("Warning: failed to discover MARGINFI_USDC_BANK via SDK:", String(err));
    // Try raw on-chain fallback if programId available
    try {
      const programId = config.programId;
      if (programId) {
        const candidate = await rawDiscoverUsdcBank(getConnection(), programId);
        if (candidate) {
          console.log(`export MARGINFI_USDC_BANK=${candidate.toBase58()}`);
          return;
        }
      }
    } catch (err2) {
      console.error("Raw discovery also failed:", String(err2));
    }

    console.error("You can set MARGINFI_USDC_BANK manually from known configs or run the SDK with different env vars.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
