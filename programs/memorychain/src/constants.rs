use anchor_lang::prelude::*;

#[constant]
pub const SEED: &str = "anchor";

// PDA seed for memory blocks
#[constant]
pub const MEMORY_SEED: &str = "memory";

// Optional: PDA seed for a global registry or authority
#[constant]
pub const AUTHORITY_SEED: &str = "authority";
