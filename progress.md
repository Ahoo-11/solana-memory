Memorychain – Next Implementations Plan

Status snapshot
- Program: MemoryBlock account, store_memory, verify_memory, reward_miner are implemented and wired in lib.rs.
- Frontend: Vite React app scaffolded with a basic UI; browser-friendly PDA derivation and account fetch in solana.ts; Buffer issue fixed.
- Client (Node): TypeScript scaffolding added; store/verify wiring is pending IDL.
- Blocker: cargo-build-sbf missing on Windows; Agave/Solana CLI needs admin install to unblock `anchor build`.

Goal for next milestone (M1): Build the program, generate the IDL, wire client + UI, and demonstrate end‑to‑end store/verify on devnet.

Phase 1 — Unblock build & generate IDL
1) Install Agave/Solana CLI (admin)
   - Action: Run installer as Administrator to get `solana`, `cargo-build-sbf`, and platform-tools.
   - Verify: `solana --version`, `cargo-build-sbf --version`, `anchor --version` output without errors.
   - Windows PATH: Ensure `%USERPROFILE%\.local\share\solana\install\active_release\bin` is in PATH (User scope is fine).
   - Commands (run from an Admin PowerShell):
     - mkdir C:\agave-install-tmp
     - Invoke-WebRequest -UseBasicParsing -Uri https://release.anza.xyz/v3.0.8/agave-install-init-x86_64-pc-windows-msvc.exe -OutFile C:\agave-install-tmp\agave-install-init.exe
     - & C:\agave-install-tmp\agave-install-init.exe v3.0.8
   - If tools still missing: run `cargo-build-sbf --force-tools-install` in a regular PowerShell.

2) Configure Solana and Anchor
   - Set cluster to devnet: `solana config set -u devnet`
   - Ensure Node/Rust versions are compatible (Node >= 18, Rust stable; Agave provides its own SBF toolchain).

3) Build to produce IDL
   - Action: `anchor build`
   - Artifacts expected:
     - target/idl/memorychain.json (IDL)
     - target/types/memorychain.ts (TypeScript types)
     - target/deploy/memorychain-keypair.json (program keypair)
   - Extract PROGRAM_ID: `solana-keygen pubkey target/deploy/memorychain-keypair.json`

Acceptance criteria (Phase 1)
- `anchor build` succeeds and IDL/types are present; PROGRAM_ID is determined.

Phase 2 — Client SDK & Web wiring
1) Client TypeScript (Node, app/src/index.ts)
   - Import IDL and PROGRAM_ID; use Anchor Program client to implement:
     - storeMemory(hash): derives PDA, sends `store_memory` instruction, waits for confirmation.
     - getMemory(hash): fetches account, decodes via IDL or borsh, returns owner/timestamp.
   - Acceptance: CLI prints signature for store; getMemory returns valid metadata.

2) Web UI (app/web)
   - Option A: Use @solana/web3.js with precomputed instruction data (IDL) to build transactions in the browser.
   - Option B: Add @coral-xyz/anchor in web and polyfills if required (vite-plugin-node-polyfills). Prefer Option A for lower friction.
   - Replace placeholder store call with real transaction; show success/failure toast and update table.
   - Acceptance: Store/Fetch work via Phantom (devnet) and show the record in the UI table.

Phase 3 — Wallet adapter & env config
1) Wallet integration
   - Add @solana/wallet-adapter (base, react, wallets) for Phantom/Solflare/Backpack.
   - Wrap App with WalletAdapterProvider and use hooks; unify connection handling.
2) Environment & config
   - Expose CLUSTER and PROGRAM_ID via Vite env (e.g., .env.development). Read them in solana.ts.
   - Acceptance: Multiple wallets connect, program ID is read from env, actions work on devnet.

Phase 4 — SPL token reward_miner
1) On-chain changes
   - Add `anchor_spl::token` types to reward_miner.
   - Create vault authority PDA and vault token account owned by the PDA.
   - Transfer MEM tokens to miner’s ATA on reward_miner invocation.
2) Off-chain setup
   - Create MEM mint on devnet and mint supply to vault ATA.
   - Add a script to initialize vault and fund it.
   - Acceptance: reward_miner transfers correct token amount to miner; balances reflect changes.

Phase 5 — Tests, deployment, CI, docs
1) Tests
   - Write Anchor TypeScript tests for store/verify/reward.
   - Use a fresh keypair and devnet; assert PDAs and data integrity.
2) Deployment
   - `anchor deploy` to devnet; persist PROGRAM_ID in Anchor.toml and web env.
3) CI
   - GitHub Actions: cache Rust/Node, run `anchor build` and tests on push.
4) Docs
   - README: quickstart, IDL-based client usage, PDA layout, token reward setup, troubleshooting.
   - Acceptance: Passing tests in CI; README lets a new dev run the flow end‑to‑end.

Task checklist (prioritized)
- [ ] Install Agave/Solana CLI on Windows (admin) and verify cargo-build-sbf
- [ ] Configure PATH and cluster; run `anchor build` to produce IDL
- [ ] Wire IDL into Node client (storeMemory/getMemory/verifyMemory)
- [ ] Replace placeholder in web UI with real program calls; show confirmation & errors
- [ ] Add wallet adapter (Phantom/Solflare/Backpack) and env config
- [ ] Implement SPL token reward_miner (vault PDA + token transfers)
- [ ] Write integration tests; deploy to devnet and persist PROGRAM_ID
- [ ] Set up CI; write README integration guide

Notes & risks
- Windows install requires Administrator for Agave init; without it, `anchor build` will fail due to missing platform-tools.
- Using Anchor in the browser may require polyfills; prefer raw @solana/web3.js with IDL-driven instruction layouts.
- Token rewards require careful PDA authority management to avoid stuck funds.