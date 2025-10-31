import { useMemo, useState } from 'react';
import './App.css';
import { deriveMemoryPda, getMemory, storeMemory, verifyMemory, rewardMiner, PROGRAM_ID } from './solana';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

type MemoryRow = {
  pda: string;
  owner: string;
  data_hash_hex: string;
  timestamp: number;
};

function App() {
  const { publicKey, connected } = useWallet();
  const [wallet, setWallet] = useState<string | null>(null);
  const [hashHex, setHashHex] = useState<string>('0x' + '11'.repeat(32));
  const [status, setStatus] = useState<string>('');
  const [rows, setRows] = useState<MemoryRow[]>([]);
  const [rewardAmount, setRewardAmount] = useState<number>(1000000); // 1 MEM (6 decimals)

  const memoryPda = useMemo(() => deriveMemoryPda(hashHex).toBase58(), [hashHex]);

  // Reflect adapter connection state into local state for display
  if (connected && publicKey && wallet !== publicKey.toBase58()) {
    setWallet(publicKey.toBase58());
  }

  async function handleStore() {
    setStatus('Preparing store transaction...');
    try {
      const sig = await storeMemory(hashHex);
      setStatus(`Store submitted: ${sig}`);
    } catch (e: any) {
      setStatus('Store error: ' + e.message + ' (program must be built & deployed)');
    }
  }

  async function handleVerify() {
    setStatus('Preparing verify transaction...');
    try {
      const sig = await verifyMemory(hashHex);
      setStatus(`Verify submitted: ${sig}`);
    } catch (e: any) {
      setStatus('Verify error: ' + e.message + ' (program must be built & deployed)');
    }
  }

  async function handleGet() {
    setStatus('Fetching memory...');
    try {
      const res = await getMemory(hashHex);
      if (res) {
        setRows((prev) => [res, ...prev]);
        setStatus('Found memory');
      } else {
        setStatus('Memory not found');
      }
    } catch (e: any) {
      setStatus('Get error: ' + e.message);
    }
  }

  async function handleReward() {
    setStatus('Preparing reward transaction...');
    try {
      const sig = await rewardMiner(rewardAmount);
      setStatus(`Reward submitted: ${sig}`);
    } catch (e: any) {
      setStatus('Reward error: ' + e.message + ' (ensure vault funded & VITE_REWARD_MINT set)');
    }
  }

  return (
    <div className="container">
      <h1>Memorychain</h1>
      <p className="subtitle">Program ID: {PROGRAM_ID.toBase58()}</p>
      <div className="actions">
        <WalletMultiButton />
        <input
          value={hashHex}
          onChange={(e) => setHashHex(e.target.value)}
          placeholder="0x + 64 hex chars (32 bytes)"
          style={{ width: '520px' }}
        />
        <button onClick={handleStore}>Store Memory</button>
        <button onClick={handleVerify}>Verify Memory</button>
        <button onClick={handleGet}>Get Memory</button>
        <input
          type="number"
          value={rewardAmount}
          onChange={(e) => setRewardAmount(parseInt(e.target.value || '0', 10))}
          placeholder="Reward amount (base units)"
          style={{ width: '220px' }}
        />
        <button onClick={handleReward}>Reward Miner</button>
      </div>
      <p className="status">{status}</p>
      <div className="pda">Derived PDA: {memoryPda}</div>
      <table className="mem-table">
        <thead>
          <tr>
            <th>PDA</th>
            <th>Owner</th>
            <th>Hash</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.pda}</td>
              <td>{r.owner}</td>
              <td>{r.data_hash_hex}</td>
              <td>{new Date(r.timestamp * 1000).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
