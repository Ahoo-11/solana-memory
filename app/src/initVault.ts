import fs from 'fs';
import path from 'path';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token';

const PROGRAM_ID = new PublicKey('BYBWXdJzR8tUhwnRLTzDSvCk7B8DY87wqm4Hdzwfn6bn');
const AUTHORITY_SEED = 'authority';

function loadKeypair(): Keypair {
  const walletPath = process.env.ANCHOR_WALLET || path.join(process.env.HOME || process.env.USERPROFILE || '', '.config', 'solana', 'id.json');
  try {
    const raw = fs.readFileSync(walletPath, 'utf-8');
    const secret = Uint8Array.from(JSON.parse(raw));
    return Keypair.fromSecretKey(secret);
  } catch {
    // Fallback to ephemeral keypair if local keypair is not found
    return Keypair.generate();
  }
}

async function main() {
  const connection = new Connection(process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com', 'confirmed');
  const payer = loadKeypair();

  // Attempt airdrop on devnet for the payer if needed
  try {
    const sig = await connection.requestAirdrop(payer.publicKey, 2_000_000_000);
    const bh = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...bh }, 'confirmed');
    console.log('Airdropped 2 SOL to payer:', payer.publicKey.toBase58());
  } catch {
    // ignore faucet errors; user may already have balance
  }

  // Derive vault authority PDA
  const [vaultAuthority] = PublicKey.findProgramAddressSync([
    Buffer.from(AUTHORITY_SEED),
  ], PROGRAM_ID);

  console.log('Vault authority PDA:', vaultAuthority.toBase58());

  // Create MEM mint with payer as mint authority
  const decimals = 6;
  const mint = await createMint(connection, payer, payer.publicKey, payer.publicKey, decimals);
  console.log('Created MEM mint:', mint.toBase58());

  // Create or fetch the vault ATA owned by the PDA (allow off-curve)
  const vaultAta = await getOrCreateAssociatedTokenAccount(connection, payer, mint, vaultAuthority, true);
  console.log('Vault ATA:', vaultAta.address.toBase58());

  // Mint initial supply to vault
  const amount = 1_000_000_000; // 1,000 MEM (with 6 decimals)
  await mintTo(connection, payer, mint, vaultAta.address, payer, amount);
  console.log('Minted', amount, 'to vault');

  console.log('Set VITE_REWARD_MINT in app/web/.env.development to:', mint.toBase58());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});