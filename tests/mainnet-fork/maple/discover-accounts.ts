#!/usr/bin/env tsx
import { PublicKey } from "@solana/web3.js";

const CCIP_ROUTER_PROGRAM = "Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const CCIP_ENVS = [
  "SYRUP_USDC_MINT",
  "USER_SYRUP_USDC_ATA",
  "CCIP_CONFIG",
  "CCIP_DEST_CHAIN_STATE",
  "CCIP_NONCE",
  "CCIP_FEE_TOKEN_PROGRAM",
  "CCIP_FEE_TOKEN_MINT",
  "CCIP_FEE_TOKEN_USER_ATA",
  "CCIP_FEE_TOKEN_RECEIVER",
  "CCIP_FEE_BILLING_SIGNER",
  "CCIP_FEE_QUOTER",
  "CCIP_FEE_QUOTER_CONFIG",
  "CCIP_FEE_QUOTER_DEST_CHAIN",
  "CCIP_FEE_QUOTER_BILLING_TOKEN_CONFIG",
  "CCIP_FEE_QUOTER_LINK_TOKEN_CONFIG",
  "CCIP_RMN_REMOTE",
  "CCIP_RMN_REMOTE_CURSES",
  "CCIP_RMN_REMOTE_CONFIG",
];

function addIfUnique(set: Set<string>, value: string) {
  if (!set.has(value)) {
    set.add(value);
    console.log(value);
  }
}

console.error("Maple fork discovery: printing required clone accounts to stdout.");
const unique = new Set<string>();
addIfUnique(unique, CCIP_ROUTER_PROGRAM);
addIfUnique(unique, USDC_MINT);

for (const name of CCIP_ENVS) {
  const v = process.env[name];
  if (!v) continue;
  try {
    const pk = new PublicKey(v).toBase58();
    addIfUnique(unique, pk);
    console.error(`Including optional account ${name}: ${pk}`);
  } catch (err) {
    console.error(`Invalid pubkey for ${name}: ${v}`);
  }
}

console.error("TODO: Replace env-driven CCIP account discovery with generated ccip_send instruction metas when the CCIP SDK builder is wired.");
