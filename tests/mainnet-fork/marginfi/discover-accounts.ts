import { PublicKey } from "@solana/web3.js";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Error: ${name} env var is required for MarginFi mainnet-fork discovery`);
    process.exit(1);
  }
  return value;
}

function optionalEnv(name: string): string | null {
  return process.env[name] ?? null;
}

function parsePubkey(value: string): PublicKey {
  try {
    return new PublicKey(value);
  } catch (error) {
    console.error(`Error: invalid pubkey provided for MarginFi discovery: ${String(error)}`);
    process.exit(1);
  }
}

// TODO: Replace env-driven list with MarginFi SDK-generated instruction metas.
console.error("MarginFi fork discovery: printing required clone accounts to stdout.");

const accounts = new Set<string>();
accounts.add(requiredEnv("MARGINFI_PROGRAM_ID"));
accounts.add("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
accounts.add(requiredEnv("MARGINFI_GROUP"));
accounts.add(requiredEnv("MARGINFI_USDC_BANK"));

for (const name of [
  "MARGINFI_ACCOUNT",
  "USER_USDC_ATA",
  "USER_USDC_DESTINATION_ATA",
  "BANK_LIQUIDITY_VAULT",
  "BANK_LIQUIDITY_VAULT_AUTHORITY",
  "TOKEN_PROGRAM",
]) {
  const value = optionalEnv(name);
  if (!value) {
    continue;
  }

  // Validate the account pubkey before printing.
  parsePubkey(value);
  accounts.add(value);
}

for (const account of Array.from(accounts)) {
  console.log(account);
}
