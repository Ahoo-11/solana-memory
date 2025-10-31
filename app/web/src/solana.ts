import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';

// SPL Token program IDs (hardcoded to avoid browser-unfriendly deps)
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

// Read from env when available, fallback to hardcoded values
const PROGRAM_ID_STR = (import.meta as any).env?.VITE_PROGRAM_ID || 'BYBWXdJzR8tUhwnRLTzDSvCk7B8DY87wqm4Hdzwfn6bn';
export const PROGRAM_ID = new PublicKey(PROGRAM_ID_STR);
const MEMORY_SEED = 'memory';
const AUTHORITY_SEED = 'authority';
const CLUSTER = (import.meta as any).env?.VITE_CLUSTER || 'https://api.devnet.solana.com';

export function getConnection() {
  return new Connection(CLUSTER, 'confirmed');
}

export async function connectWallet(): Promise<PublicKey> {
  const anyWindow: any = window as any;
  const provider = anyWindow.solana;
  if (!provider || !provider.isPhantom) {
    throw new Error('Phantom wallet not found. Please install Phantom.');
  }
  const resp = await provider.connect();
  return new PublicKey(resp.publicKey.toString());
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error('invalid hex');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function hexTo32Bytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length !== 64) throw new Error('hash must be 32 bytes hex');
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function deriveMemoryPda(hashHex: string): PublicKey {
  const hashBytes = hexTo32Bytes(hashHex);
  const encoder = new TextEncoder();
  const [pda] = PublicKey.findProgramAddressSync([
    encoder.encode(MEMORY_SEED),
    hashBytes,
  ], PROGRAM_ID);
  return pda;
}

export async function getMemory(hashHex: string) {
  const connection = getConnection();
  const pda = deriveMemoryPda(hashHex);
  const account = await connection.getAccountInfo(pda);
  if (!account) return null;
  const data = account.data;
  if (data.length < 80) return null;
  const owner = new PublicKey(data.slice(8, 40));
  const storedHash = new Uint8Array(data.slice(40, 72));
  const tsSlice = data.slice(72, 80);
  const timestamp = new DataView(tsSlice.buffer, tsSlice.byteOffset, tsSlice.byteLength).getBigInt64(0, true);
  return {
    pda: pda.toBase58(),
    owner: owner.toBase58(),
    data_hash_hex: bytesToHex(storedHash),
    timestamp: Number(timestamp),
  };
}

// Precomputed Anchor discriminators for instructions
const STORE_MEMORY_DISCRIM_HEX = 'a86758f05db91eeb';
const VERIFY_MEMORY_DISCRIM_HEX = '38a854bc6be2207f';
const REWARD_MINER_DISCRIM_HEX = '0bd6980abc243e7d';
const STORE_MEMORY_DISCRIM = hexToBytes(STORE_MEMORY_DISCRIM_HEX);
const VERIFY_MEMORY_DISCRIM = hexToBytes(VERIFY_MEMORY_DISCRIM_HEX);
const REWARD_MINER_DISCRIM = hexToBytes(REWARD_MINER_DISCRIM_HEX);

function buildStoreData(hashBytes: Uint8Array): Uint8Array {
  const data = new Uint8Array(8 + 32);
  data.set(STORE_MEMORY_DISCRIM, 0);
  data.set(hashBytes, 8);
  return data;
}

function buildVerifyData(hashBytes: Uint8Array): Uint8Array {
  const data = new Uint8Array(8 + 32);
  data.set(VERIFY_MEMORY_DISCRIM, 0);
  data.set(hashBytes, 8);
  return data;
}

export async function storeMemory(hashHex: string): Promise<string> {
  const anyWindow: any = window as any;
  const provider = anyWindow.solana;
  if (!provider || !provider.isPhantom) throw new Error('Phantom wallet not found');
  const connection = getConnection();
  const walletPubkey = new PublicKey(provider.publicKey.toString());
  const memoryPda = deriveMemoryPda(hashHex);
  const hashBytes = hexTo32Bytes(hashHex);

  const data = buildStoreData(hashBytes);

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: walletPubkey, isSigner: true, isWritable: true },
      { pubkey: memoryPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = walletPubkey;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  const signed = await provider.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize());
  return sig;
}

export async function verifyMemory(hashHex: string): Promise<string> {
  const anyWindow: any = window as any;
  const provider = anyWindow.solana;
  if (!provider || !provider.isPhantom) throw new Error('Phantom wallet not found');
  const connection = getConnection();
  const walletPubkey = new PublicKey(provider.publicKey.toString());
  const memoryPda = deriveMemoryPda(hashHex);
  const hashBytes = hexTo32Bytes(hashHex);

  const data = buildVerifyData(hashBytes);

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: walletPubkey, isSigner: true, isWritable: false },
      { pubkey: memoryPda, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = walletPubkey;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  const signed = await provider.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize());
  return sig;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Minimal helper to derive an associated token address deterministically.
// Matches the seeds used by the SPL Associated Token Account program.
export async function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey,
  allowOwnerOffCurve: boolean = false,
): Promise<PublicKey> {
  // For browser-only usage we skip curve validation; PDAs require allowOwnerOffCurve=true
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

export async function rewardMiner(amount: number): Promise<string> {
  const anyWindow: any = window as any;
  const provider = anyWindow.solana;
  if (!provider || !provider.isPhantom) throw new Error('Phantom wallet not found');
  const connection = getConnection();
  const walletPubkey = new PublicKey(provider.publicKey.toString());

  const encoder = new TextEncoder();
  const [vaultAuthority] = PublicKey.findProgramAddressSync([
    encoder.encode(AUTHORITY_SEED),
  ], PROGRAM_ID);

  const mintStr = (import.meta as any).env?.VITE_REWARD_MINT;
  if (!mintStr) throw new Error('VITE_REWARD_MINT not set');
  const rewardMint = new PublicKey(mintStr);

  const rewardVault = await getAssociatedTokenAddress(rewardMint, vaultAuthority, true);
  const minerAta = await getAssociatedTokenAddress(rewardMint, walletPubkey);

  const data = new Uint8Array(8 + 8);
  data.set(REWARD_MINER_DISCRIM, 0);
  // little-endian u64
  const dv = new DataView(data.buffer);
  dv.setBigUint64(8, BigInt(amount), true);

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: walletPubkey, isSigner: true, isWritable: true }, // payer
      { pubkey: vaultAuthority, isSigner: false, isWritable: false },
      { pubkey: rewardVault, isSigner: false, isWritable: true },
      { pubkey: walletPubkey, isSigner: false, isWritable: false }, // miner
      { pubkey: minerAta, isSigner: false, isWritable: true },
      { pubkey: rewardMint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = walletPubkey;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  const signed = await provider.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize());
  return sig;
}