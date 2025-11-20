use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;

use crate::instructions::*;

declare_id!("Ah6XxSHCXhM9eMgv26wd1pnAey5SfMyx3mc4HShZGy3t");

#[program]
pub mod nft_marketplace {

    use super::*;

    pub fn initialize(ctx: Context<Initialize>, seed: u64, name: String) -> Result<()> {
        ctx.accounts.init(seed, name, &ctx.bumps)
    }

    pub fn list(ctx: Context<List>, _seed: u64, amount: u64) -> Result<()> {
        ctx.accounts.list_nft(amount, &ctx.bumps)?;
        ctx.accounts.transfer_to_vault()
    }
}
