import fs from 'fs';
import path from 'path';
import * as anchor from '@coral-xyz/anchor';
import { Keypair, Connection, PublicKey, SystemProgram } from '@solana/web3.js';

// Program ID from Rust declare_id!
const PROGRAM_ID = new PublicKey('BYBWXdJzR8tUhwnRLTzDSvCk7B8DY87wqm4Hdzwfn6bn');

// Seeds must match program constants
const MEMORY_SEED = 'memory';

// Load local keypair from Solana config if ANCHOR_WALLET not set
function loadKeypair(): Keypair {
  const walletPath = process.env.ANCHOR_WALLET || path.join(process.env.HOME || process.env.USERPROFILE || '', '.config', 'solana', 'id.json');
  const raw = fs.readFileSync(walletPath, 'utf-8');
  const secret = Uint8Array.from(JSON.parse(raw));
  return Keypair.fromSecretKey(secret);
}

function getProvider() {
  const payer = loadKeypair();
  const connection = new Connection(process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com', 'confirmed');
  const wallet = new anchor.Wallet(payer);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);
  return provider;
}

// Helper to convert hex string to 32-byte array
function hexTo32Bytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length !== 64) throw new Error('hash must be 32 bytes hex');
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function storeMemory(hashHex: string) {
  const provider = getProvider();
  const hashBytes = hexTo32Bytes(hashHex);

  // Derive PDA for memory block using seeds ["memory", hash]
  const [memoryPda] = PublicKey.findProgramAddressSync([
    Buffer.from(MEMORY_SEED),
    Buffer.from(hashBytes),
  ], PROGRAM_ID);

  // Build instruction via Anchor IDL-free approach: manually construct instruction data using Anchor's discriminator
  // Since we don't have the IDL yet, we can temporarily use Anchor's Instruction construction via coder
  // Fallback: Use a simple SystemProgram createAccount with space and then serialize fields via Anchor Coder once IDL is available.
  // For now, we'll invoke the program expecting it to create the account using the StoreMemory instruction.

  // Using Anchor's coder requires the IDL; until build completes, we can't produce it. We'll log the derived PDA for manual testing.
  console.log('Derived memory PDA:', memoryPda.toBase58());
  console.log('Note: storeMemory will be fully wired after the IDL is generated via anchor build.');
}

export async function getMemory(hashHex: string) {
  const provider = getProvider();
  const hashBytes = hexTo32Bytes(hashHex);
  const [memoryPda] = PublicKey.findProgramAddressSync([
    Buffer.from(MEMORY_SEED),
    Buffer.from(hashBytes),
  ], PROGRAM_ID);

  const account = await provider.connection.getAccountInfo(memoryPda);
  if (!account) {
    console.log('Memory not found for hash:', hashHex);
    return null;
  }
  // Basic decoder: Anchor accounts start with 8-byte discriminator; then owner(32), data_hash(32), timestamp(i64)
  const data = account.data;
  if (data.length < 80) {
    console.log('Unexpected account size:', data.length);
    return null;
  }
  const owner = new PublicKey(data.slice(8, 40));
  const storedHash = Buffer.from(data.slice(40, 72));
  const timestampBuf = data.slice(72, 80);
  const timestamp = new DataView(timestampBuf.buffer, timestampBuf.byteOffset, timestampBuf.byteLength).getBigInt64(0, true);
  console.log('Memory found:', {
    pda: memoryPda.toBase58(),
    owner: owner.toBase58(),
    data_hash_hex: storedHash.toString('hex'),
    timestamp: Number(timestamp),
  });
  return {
    pda: memoryPda.toBase58(),
    owner: owner.toBase58(),
    data_hash_hex: storedHash.toString('hex'),
    timestamp: Number(timestamp),
  };
}

// Demo usage when running `npm run dev`
async function main() {
  const exampleHash = '0x' + '11'.repeat(32); // replace with actual data or file hash
  await storeMemory(exampleHash);
  await getMemory(exampleHash);
}

if (require.main === module) {
  main().catch((e) => console.error(e));
}