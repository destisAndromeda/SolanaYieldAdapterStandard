import { Connection, PublicKey } from "@solana/web3.js";

const RPC = "https://api.mainnet-beta.solana.com";

const SIG =
  "4QJBJWyqe3Xs8x5eFWCC5msjahhy53h8E2DRHHZsqfyq6EzdAkB7jcmdM6VKftQvu1cF45CnhjhT2K6QZe3F1bJC";

const KLEND = new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

async function main() {
  const connection = new Connection(RPC, "confirmed");

  const tx = await connection.getTransaction(SIG, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error("Transaction not found");
  }

  const keys = tx.transaction.message.getAccountKeys({
    accountKeysFromLookups: tx.meta?.loadedAddresses,
  });

  const instructions = tx.transaction.message.compiledInstructions;

  for (let ixIndex = 0; ixIndex < instructions.length; ixIndex++) {
    const ix = instructions[ixIndex];
    const programId = keys.get(ix.programIdIndex);

    if (!programId?.equals(KLEND)) continue;

    console.log("\n==============================");
    console.log("KLend instruction index:", ixIndex);
    console.log("Program:", programId.toBase58());
    console.log("Data:", Buffer.from(ix.data).toString("hex"));
    console.log("==============================\n");

    for (let j = 0; j < ix.accountKeyIndexes.length; j++) {
      const pubkey = keys.get(ix.accountKeyIndexes[j]);
      if (!pubkey) continue;

      const info = await connection.getAccountInfo(pubkey);

      let extra = "";

      if (info?.owner.equals(TOKEN_PROGRAM)) {
        try {
          const parsed = await connection.getParsedAccountInfo(pubkey);
          const value: any = parsed.value?.data;

          if (value?.parsed?.info?.mint) {
            const mint = value.parsed.info.mint;
            const amount = value.parsed.info.tokenAmount?.uiAmountString;

            extra = ` | token mint: ${mint} | amount: ${amount}`;

            if (mint === USDC_MINT) {
              extra += " | <<< USDC TOKEN ACCOUNT";
            }
          }
        } catch {}
      }

      const owner = info?.owner.toBase58() ?? "missing";
      const len = info?.data.length ?? 0;

      const likelyKlendState = info?.owner.equals(KLEND)
        ? " | <<< KLEND STATE CANDIDATE"
        : "";

      console.log(
        `${j.toString().padStart(2, "0")} ${pubkey.toBase58()} | owner: ${owner} | len: ${len}${likelyKlendState}${extra}`,
      );
    }
  }
}

main().catch(console.error);