#!/usr/bin/env tsx
import { PublicKey } from "@solana/web3.js";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const DEFAULT_JUPITER_PROGRAM_ID = "PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu";
const JUPITER_PROGRAM_ID = process.env.JUPITER_PROGRAM_ID ?? DEFAULT_JUPITER_PROGRAM_ID;
const ACCOUNT_ENVS = [
  "JUPITER_POSITION_ACCOUNT",
  "JUPITER_POOL_ACCOUNT",
  "JUPITER_LP_MINT",
  "USER_LP_ATA",
  "USER_USDC_ATA",
];

function addIfUnique(set: Set<string>, value: string): void {
  if (!set.has(value)) {
    set.add(value);
    console.log(value);
  }
}

console.error("Jupiter fork discovery: printing required clone accounts to stdout.");
const unique = new Set<string>();
addIfUnique(unique, JUPITER_PROGRAM_ID);
addIfUnique(unique, USDC_MINT);

for (const name of ACCOUNT_ENVS) {
  const value = process.env[name];
  if (!value) {
    continue;
  }

  try {
    addIfUnique(unique, new PublicKey(value).toBase58());
    console.error(`Including optional account ${name}: ${value}`);
  } catch (error) {
    console.error(`Invalid pubkey for ${name}: ${value}`);
  }
}

console.error(
  "TODO: Replace env-driven list with Jupiter SDK/IDL generated instruction metas.",
);
