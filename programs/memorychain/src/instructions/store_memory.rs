use anchor_lang::prelude::*;

use crate::constants::MEMORY_SEED;
use crate::state::MemoryBlock;

#[derive(Accounts)]
pub struct StoreMemory<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    // PDA for a memory block derived from ("memory", data_hash)
    #[account(
        init,
        seeds = [MEMORY_SEED.as_bytes(), &memory_hash.hash],
        bump,
        payer = payer,
        space = MemoryBlock::LEN,
    )]
    pub memory_block: Account<'info, MemoryBlock>,

    pub system_program: Program<'info, System>,
}

// Hash parameter passed into instruction
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MemoryHash {
    pub hash: [u8; 32],
}

pub fn handler(ctx: Context<StoreMemory>, memory_hash: MemoryHash) -> Result<()> {
    let block = &mut ctx.accounts.memory_block;
    block.owner = ctx.accounts.payer.key();
    block.data_hash = memory_hash.hash;
    block.timestamp = Clock::get()?.unix_timestamp;

    msg!("Stored memory: {:?}", block.data_hash);
    Ok(())
}