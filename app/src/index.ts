import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as anchor from '@coral-xyz/anchor';
import { Keypair, Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';

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

  // Build instruction data: discriminator + MemoryHash (32 bytes)
  const storeDiscrim = crypto.createHash('sha256').update('global:store_memory').digest().slice(0, 8);
  const data = Buffer.concat([storeDiscrim, Buffer.from(hashBytes)]);

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: provider.wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: memoryPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = provider.wallet.publicKey;
  const { blockhash } = await provider.connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  const sig = await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [provider.wallet.payer]);
  console.log('StoreMemory tx:', sig);
  return sig;
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

export async function verifyMemory(hashHex: string) {
  const provider = getProvider();
  const hashBytes = hexTo32Bytes(hashHex);

  const [memoryPda] = PublicKey.findProgramAddressSync([
    Buffer.from(MEMORY_SEED),
    Buffer.from(hashBytes),
  ], PROGRAM_ID);

  const verifyDiscrim = crypto.createHash('sha256').update('global:verify_memory').digest().slice(0, 8);
  const data = Buffer.concat([verifyDiscrim, Buffer.from(hashBytes)]);

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: provider.wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: memoryPda, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = provider.wallet.publicKey;
  const { blockhash } = await provider.connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  const sig = await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [provider.wallet.payer]);
  console.log('VerifyMemory tx:', sig);
  return sig;
}

// Demo usage when running `npm run dev`
async function main() {
  const exampleHash = '0x' + '11'.repeat(32); // replace with actual data or file hash
  await storeMemory(exampleHash);
  await getMemory(exampleHash);
  await verifyMemory(exampleHash);
}

if (require.main === module) {
  main().catch((e) => console.error(e));
}