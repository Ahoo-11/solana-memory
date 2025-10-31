pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("BYBWXdJzR8tUhwnRLTzDSvCk7B8DY87wqm4Hdzwfn6bn");

#[program]
pub mod memorychain {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        initialize::handler(ctx)
    }

    pub fn store_memory(ctx: Context<StoreMemory>, memory_hash: store_memory::MemoryHash) -> Result<()> {
        store_memory::handler(ctx, memory_hash)
    }

    pub fn verify_memory(ctx: Context<VerifyMemory>, memory_hash: verify_memory::MemoryHash) -> Result<()> {
        verify_memory::handler(ctx, memory_hash)
    }

    pub fn reward_miner(ctx: Context<RewardMiner>, args: reward_miner::RewardArgs) -> Result<()> {
        reward_miner::handler(ctx, args)
    }
}
