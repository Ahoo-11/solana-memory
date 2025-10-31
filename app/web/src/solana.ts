import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey('BYBWXdJzR8tUhwnRLTzDSvCk7B8DY87wqm4Hdzwfn6bn');
const MEMORY_SEED = 'memory';

export function getConnection() {
  return new Connection('https://api.devnet.solana.com', 'confirmed');
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

// Placeholder: Once IDL is available, we'll construct the proper Anchor instruction.
export async function storeMemory(hashHex: string): Promise<string> {
  const anyWindow: any = window as any;
  const provider = anyWindow.solana;
  if (!provider || !provider.isPhantom) throw new Error('Phantom wallet not found');
  const connection = getConnection();
  const walletPubkey = new PublicKey(provider.publicKey.toString());
  const memoryPda = deriveMemoryPda(hashHex);

  // Build a dummy transaction that pings the program (this will fail until the program is deployed and instruction data matches)
  const ix = new TransactionInstruction({
    keys: [
      { pubkey: walletPubkey, isSigner: true, isWritable: true },
      { pubkey: memoryPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: new Uint8Array(8), // discriminator placeholder; replace with real StoreMemory data once IDL is ready
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