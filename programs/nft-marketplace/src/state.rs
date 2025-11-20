use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Marketplace {
    pub maker: Pubkey, // maker's publickey
    pub seed: u64,     // seed to derive PDA
    #[max_len(30)]
    pub name: String, // name of the marketplace
    pub marketplace_bump: u8, // bump for escrow PDA signer
    pub treasury_bump: u8, // bump for Vault PDA
    pub rewards_bump: u8, //bump for Rewards PDA
}

#[account]
#[derive(InitSpace)]
pub struct Listing {
    pub maker: Pubkey,      // owner's publickey
    pub maker_mint: Pubkey, // Specific NFT mint associated with this listing
    pub price: u64,         // Price in lamports
    pub is_listed: bool,    // Whether this NFT is currently available for sale
    pub listed_at: i64,     // time when the NFT is listed
    pub list_bump: u8,      // bump for this list PDA
}
