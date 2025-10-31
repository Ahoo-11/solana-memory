use anchor_lang::prelude::*;

// Core data structure representing an AI memory proof on-chain
#[account]
pub struct MemoryBlock {
    pub owner: Pubkey,        // Wallet that stored the memory
    pub data_hash: [u8; 32],  // Hash of the data (compressed or raw)
    pub timestamp: i64,       // Unix timestamp when stored
}

impl MemoryBlock {
    pub const LEN: usize = 8  // account discriminator
        + 32                  // owner pubkey
        + 32                  // data_hash
        + 8;                  // timestamp i64
}