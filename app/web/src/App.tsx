import { useMemo, useState } from 'react';
import './App.css';
import { connectWallet, deriveMemoryPda, getMemory, storeMemory, PROGRAM_ID } from './solana';

type MemoryRow = {
  pda: string;
  owner: string;
  data_hash_hex: string;
  timestamp: number;
};

function App() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [hashHex, setHashHex] = useState<string>('0x' + '11'.repeat(32));
  const [status, setStatus] = useState<string>('');
  const [rows, setRows] = useState<MemoryRow[]>([]);

  const memoryPda = useMemo(() => deriveMemoryPda(hashHex).toBase58(), [hashHex]);

  async function handleConnect() {
    try {
      const pubkey = await connectWallet();
      setWallet(pubkey.toBase58());
      setStatus('Wallet connected');
    } catch (e: any) {
      setStatus('Connect error: ' + e.message);
    }
  }

  async function handleStore() {
    setStatus('Preparing store transaction...');
    try {
      const sig = await storeMemory(hashHex);
      setStatus(`Submitted: ${sig}`);
    } catch (e: any) {
      setStatus('Store error: ' + e.message + ' (program must be built & deployed)');
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

  return (
    <div className="container">
      <h1>Memorychain</h1>
      <p className="subtitle">Program ID: {PROGRAM_ID.toBase58()}</p>
      <div className="actions">
        <button onClick={handleConnect}>{wallet ? 'Connected' : 'Connect Wallet'}</button>
        <input
          value={hashHex}
          onChange={(e) => setHashHex(e.target.value)}
          placeholder="0x + 64 hex chars (32 bytes)"
          style={{ width: '520px' }}
        />
        <button onClick={handleStore}>Store Memory</button>
        <button onClick={handleGet}>Get Memory</button>
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
