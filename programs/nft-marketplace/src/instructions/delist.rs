use anchor_lang::prelude::*;
use mpl_core::{accounts::BaseAssetV1, instructions::TransferV1CpiBuilder};

use crate::{
    error::MarketplaceError,
    state::{Listing, Marketplace},
};

#[derive(Accounts)]
#[instruction(seed: u64)]
pub struct Delist<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,

    #[account(mut)]
    ///CHECK
    pub asset: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"marketplace", maker.key().as_ref(), seed.to_le_bytes().as_ref()],
        bump = marketplace.marketplace_bump,
    )]
    pub marketplace: Box<Account<'info, Marketplace>>,

    #[account(
        mut,
        close = maker,
        seeds = [marketplace.key().as_ref(), maker.key().as_ref(), asset.key().as_ref()],
        bump = listing.list_bump,
    )]
    pub listing: Box<Account<'info, Listing>>,

    pub system_program: Program<'info, System>,

    ///CHECK
    pub mpl_core_program: AccountInfo<'info>,
}

impl<'info> Delist<'info> {
    pub fn delist(&mut self, _seed: u64) -> Result<()> {
        let _base_asset = BaseAssetV1::try_from(&self.asset.to_account_info())
            .map_err(|_| error!(MarketplaceError::InvalidAsset))?;

        let listing_seeds = self.asset.key();

        let marketplace_key = self.marketplace.key();

        let seeds = &[
            marketplace_key.as_ref(),
            self.maker.key.as_ref(),
            listing_seeds.as_ref(),
            &[self.listing.list_bump],
        ];

        let signer_seeds = &[&seeds[..]];

        TransferV1CpiBuilder::new(&self.mpl_core_program)
            .asset(&self.asset.to_account_info())
            .authority(Some(&self.listing.to_account_info()))
            .payer(&self.maker.to_account_info())
            .new_owner(&self.maker.to_account_info())
            .invoke_signed(signer_seeds)?;

        self.listing.is_listed = false;

        msg!("NFT delisted successfully");

        Ok(())
    }
}
