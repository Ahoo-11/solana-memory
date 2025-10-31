use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::constants::AUTHORITY_SEED;

#[derive(Accounts)]
pub struct RewardMiner<'info> {
    // Payer covers ATA creations if needed
    #[account(mut)]
    pub payer: Signer<'info>,

    // Vault authority PDA that owns the reward_vault ATA
    /// CHECK: PDA used as token authority; signer via seeds
    #[account(seeds = [AUTHORITY_SEED.as_bytes()], bump)]
    pub vault_authority: UncheckedAccount<'info>,

    // Vault ATA for the reward mint, owned by vault_authority PDA
    #[account(
        mut,
        associated_token::mint = reward_mint,
        associated_token::authority = vault_authority,
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    // Miner wallet and their ATA for the reward mint
    /// CHECK: Miner system account; only used as ATA authority
    pub miner: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = reward_mint,
        associated_token::authority = miner,
    )]
    pub miner_token_account: Account<'info, TokenAccount>,

    pub reward_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RewardArgs {
    pub amount: u64,
}

pub fn handler(ctx: Context<RewardMiner>, args: RewardArgs) -> Result<()> {
    // Transfer MEM tokens from vault to miner's ATA using PDA signer
    let bump = *ctx.bumps.get("vault_authority").expect("vault_authority bump");
    let signer_seeds: &[&[u8]] = &[AUTHORITY_SEED.as_bytes(), &[bump]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.reward_vault.to_account_info(),
        to: ctx.accounts.miner_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    token::transfer(
        CpiContext::new_with_signer(cpi_program, cpi_accounts, &[signer_seeds]),
        args.amount,
    )?;

    Ok(())
}