use anchor_lang::prelude::*;

use crate::constants::MEMORY_SEED;
use crate::state::MemoryBlock;

#[derive(Accounts)]
pub struct VerifyMemory<'info> {
    // We don't need payer mutability; just a signer performing verification
    pub verifier: Signer<'info>,

    // PDA must exist; derive using the provided hash
    #[account(
        seeds = [MEMORY_SEED.as_bytes(), &memory_hash.hash],
        bump,
    )]
    pub memory_block: Account<'info, MemoryBlock>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MemoryHash {
    pub hash: [u8; 32],
}

pub fn handler(ctx: Context<VerifyMemory>, memory_hash: MemoryHash) -> Result<()> {
    let block = &ctx.accounts.memory_block;
    require!(block.data_hash == memory_hash.hash, crate::error::ErrorCode::CustomError);
    msg!(
        "Verified memory: hash={:?}, owner={}, timestamp={}",
        block.data_hash,
        block.owner,
        block.timestamp
    );
    Ok(())
}