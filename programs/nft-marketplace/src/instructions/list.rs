use anchor_lang::prelude::*;
use mpl_core::{accounts::BaseAssetV1, instructions::TransferV1CpiBuilder};

use crate::{
    error::MarketplaceError,
    state::{Listing, Marketplace},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

#[derive(Accounts)]
#[instruction(seed:u64, amount:u64)]
pub struct List<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,

    pub maker_mint: InterfaceAccount<'info, Mint>, //Asset

    #[account(
        mut,
        associated_token::mint = maker_mint,
        associated_token::authority = maker,
    )]
    pub maker_ata: InterfaceAccount<'info, TokenAccount>, // NFT ATA
    /// CHECK: Validated manually in handler
    pub asset: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"marketplace", maker.key().as_ref(), seed.to_le_bytes().as_ref()],
        bump = marketplace.marketplace_bump,
    )]
    pub marketplace: Account<'info, Marketplace>, // MarketPlace, self-explainatory

    #[account(
        init,
        payer = maker,
        space = 8 + Listing::INIT_SPACE,
        seeds = [marketplace.key().as_ref(), maker.key().as_ref()],
        bump,
    )]
    pub list: Account<'info, Listing>, // Vault derived from Marketplace

    #[account(
        init,
        payer = maker,
        associated_token::mint = maker_mint,
        associated_token::authority = list,
        associated_token::token_program = associated_token_program,
    )]
    pub list_ata: InterfaceAccount<'info, TokenAccount>, // Vault ATA to hold the NFT after
    // transfer
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
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
            maker_mint: self.maker_mint.key(),
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
