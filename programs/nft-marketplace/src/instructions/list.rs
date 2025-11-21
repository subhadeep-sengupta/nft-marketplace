use anchor_lang::prelude::*;
use mpl_core::{accounts::BaseAssetV1, instructions::TransferV1CpiBuilder};

use crate::{
    error::MarketplaceError,
    state::{Listing, Marketplace},
};

#[derive(Accounts)]
#[instruction(seed:u64, amount:u64)]
pub struct List<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,

    #[account(mut)]
    /// CHECK: Validated manually in handler
    pub asset: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"marketplace", maker.key().as_ref(), seed.to_le_bytes().as_ref()],
        bump = marketplace.marketplace_bump,
    )]
    pub marketplace: Box<Account<'info, Marketplace>>, // MarketPlace, self-explainatory

    #[account(
        init,
        payer = maker,
        space = 8 + Listing::INIT_SPACE,
        seeds = [marketplace.key().as_ref(), maker.key().as_ref()],
        bump,
    )]
    pub list: Box<Account<'info, Listing>>, // Vault derived from Marketplace

    // transfer
    pub system_program: Program<'info, System>,
    ///CHECK: SAFE
    pub mpl_core_program: AccountInfo<'info>,
}

impl<'info> List<'info> {
    pub fn list_nft(&mut self, amount: u64, bumps: &ListBumps) -> Result<()> {
        let _base_asset = BaseAssetV1::try_from(&self.asset.to_account_info())
            .map_err(|_| error!(MarketplaceError::InvalidAsset))?;

        let clock = Clock::get()?;
        self.list.set_inner(Listing {
            maker: self.maker.key(),
            maker_mint: self.asset.key(),
            price: amount,
            is_listed: true,
            listed_at: clock.unix_timestamp,
            list_bump: bumps.list,
        });
        Ok(())
    }

    pub fn transfer_to_vault(&mut self) -> Result<()> {
        let mpl_core_program = self.mpl_core_program.to_account_info();

        TransferV1CpiBuilder::new(&mpl_core_program)
            .asset(&self.asset.to_account_info())
            .payer(&self.maker.to_account_info())
            .new_owner(&self.list.to_account_info())
            .invoke()?;

        msg!("NFT trasnferred successfully");

        Ok(())
    }
}
