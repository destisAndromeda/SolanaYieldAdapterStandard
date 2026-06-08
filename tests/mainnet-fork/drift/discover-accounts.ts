#!/usr/bin/env tsx
import { PublicKey } from "@solana/web3.js";

const DRIFT_PROGRAM_ID = "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const DRIFT_USDC_IF_VAULT = "2CqkQvYxp9Mq4PqLvAQ1eryYxebUh4Liyn5YMDtXsYci";

function parsePubkey(value: string): PublicKey {
  try {
    return new PublicKey(value);
  } catch (error) {
    throw new Error(`Invalid public key value: ${value} (${String(error)})`);
  }
}

function addIfUnique(set: Set<string>, value: string) {
  if (!set.has(value)) {
    set.add(value);
    console.log(value);
  }
}

const envOptional = [
  "DRIFT_USER",
  "DRIFT_USER_STATS",
  "DRIFT_STATE",
  "DRIFT_USDC_SPOT_MARKET",
  "DRIFT_INSURANCE_FUND_STAKE",
  "USER_USDC_ATA",
];

const uniquePubkeys = new Set<string>();

console.error("Drift fork discovery: printing required clone accounts to stdout.");
addIfUnique(uniquePubkeys, DRIFT_PROGRAM_ID);
addIfUnique(uniquePubkeys, USDC_MINT);
addIfUnique(uniquePubkeys, DRIFT_USDC_IF_VAULT);

for (const envName of envOptional) {
  const envValue = process.env[envName];
  if (!envValue) {
    continue;
  }

  try {
    addIfUnique(uniquePubkeys, parsePubkey(envValue).toBase58());
    console.error(`Including optional account ${envName}: ${envValue}`);
  } catch (error) {
    console.error(`Skipping invalid ${envName}: ${String(error)}`);
    process.exit(1);
  }
}

if (uniquePubkeys.size === 0) {
  console.error("No accounts discovered. This should not happen.");
  process.exit(1);
}

console.error("TODO: Replace env-driven account discovery with Drift SDK-generated instruction metas when available.");
