import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NftMarketplace } from "../target/types/nft_marketplace";
import { create, mplCore } from "@metaplex-foundation/mpl-core";
import { createSignerFromKeypair, generateSigner, keypairIdentity } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { assert } from "chai";
import { getAssociatedTokenAddressSync, } from "@solana/spl-token"

describe("nft-marketplace", () => {
	// Configure the client to use the local cluster.
	//
	const provider = anchor.AnchorProvider.env()
	anchor.setProvider(provider);

	const program = anchor.workspace.NftMarketplace as Program<NftMarketplace>;

	const connection = provider.connection;

	//Test accounts
	const maker = provider.wallet as anchor.Wallet;

	let umi;
	let asset;
	let collection;

	//Marketplace Config
	const seed = new anchor.BN(Math.floor(Math.random() * 10000));
	const marketplaceName = "Test Marketplace";
	const listingPrice = new anchor.BN(1_000_000_000);

	before(async () => {
		umi = createUmi(connection.rpcEndpoint).use(mplCore());

		const umiKeypair = umi.eddsa.createKeypairFromSecretKey(maker.payer.secretKey);

		const umiSigner = createSignerFromKeypair(umi, umiKeypair);

		umi.use(keypairIdentity(umiSigner));

		console.log(maker.publicKey.toBase58());
	});

	it("Initializes the marketplace", async () => {
		//marketplace PDA
		const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
			[
				Buffer.from("marketplace"),
				maker.publicKey.toBuffer(),
				seed.toArrayLike(Buffer, "le", 8),
			],
			program.programId
		);

		//treasury PDA
		const [treasuryPda] = anchor.web3.PublicKey.findProgramAddressSync(
			[
				Buffer.from("treasury"),
				marketplacePda.toBuffer()
			],
			program.programId
		);

		//RewardsMint PDA
		const [rewardsMintPda] = anchor.web3.PublicKey.findProgramAddressSync(
			[
				Buffer.from("rewards"),
				marketplacePda.toBuffer()
			],
			program.programId
		);

		console.log("\n=== Marketplace Initialization ===");
		console.log("Marketplace PDA:", marketplacePda.toBase58());
		console.log("Treasury PDA:", treasuryPda.toBase58());
		console.log("Rewards Mint PDA:", rewardsMintPda.toBase58());

		// call initialize instruction

		const tx = await program.methods.initialize(seed, marketplaceName)
			.accountsStrict({
				maker: maker.publicKey,
				marketplace: marketplacePda,
				treasury: treasuryPda,
				rewardsMint: rewardsMintPda,
				systemProgram: anchor.web3.SystemProgram.programId,
				tokenProgram: TOKEN_PROGRAM_ID,
			})
			.rpc();

		console.log("Initialize tx signature: ", tx);

		const marketplaceAccount = await program.account.marketplace.fetch(
			marketplacePda
		);

		assert.equal(
			marketplaceAccount.maker.toBase58(),
			maker.publicKey.toBase58(),
			"Maker mismatch"
		);
		assert.equal(
			marketplaceAccount.seed.toString(),
			seed.toString(),
			"Seed mismatch"
		);
		assert.equal(
			marketplaceAccount.name,
			marketplaceName,
			"Name mismatch"
		);

		console.log("✅ Marketplace initialized successfully");
		console.log("Marketplace data:", {
			maker: marketplaceAccount.maker.toBase58(),
			seed: marketplaceAccount.seed.toString(),
			name: marketplaceAccount.name,
			marketplaceBump: marketplaceAccount.marketplaceBump,
			treasuryBump: marketplaceAccount.treasuryBump,
			rewardsBump: marketplaceAccount.rewardsBump,
		});
	})

	it("Mints a metaplex core NFT", async () => {
		console.log("\n=== Minting Metaplex Core NFT ===");
		asset = generateSigner(umi);

		console.log(`Asset address: ${asset.publicKey}`);

		const tx = await create(umi, {
			asset: asset,
			name: "Test NFT",
			uri: "https://gist.githubusercontent.com/subhadeep-sengupta/39de5be3070b33d1c563ba84dc0d2056/raw/cff248b0b2a10a1029014a6ee0754c934853ac57/pekka.json",
		}).sendAndConfirm(umi);
		console.log("NFT Mint tx signature:", tx.signature);
		console.log("✅ Metaplex Core NFT minted successfully");
		console.log("Asset Public Key:", asset.publicKey);

	})

	it("Lists NFT on the marketplace", async () => {

		const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
			[
				Buffer.from("marketplace"),
				maker.publicKey.toBuffer(),
				seed.toArrayLike(Buffer, "le", 8),
			],
			program.programId
		);

		// Derive listing PDA
		const [listPda] = anchor.web3.PublicKey.findProgramAddressSync(
			[marketplacePda.toBuffer(), maker.publicKey.toBuffer()],
			program.programId
		);

		const assetPublickey = new anchor.web3.PublicKey(asset.publicKey);

		const makerMint = assetPublickey;

		const MPL_CORE_PROGRAM_ID = new anchor.web3.PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

		try {
			const tx = await program.methods.list(seed, listingPrice)
				.accountsStrict({
					maker: maker.publicKey,
					asset: assetPublickey,
					marketplace: marketplacePda,
					list: listPda,
					systemProgram: anchor.web3.SystemProgram.programId,
					mplCoreProgram: MPL_CORE_PROGRAM_ID,
				})
				.rpc();
			console.log(`List tx signature: ${tx}`);

			const listingAccount = await program.account.listing.fetch(listPda);

			assert.equal(
				listingAccount.maker.toBase58(),
				maker.publicKey.toBase58(),
				"Listing maker mismatch"
			);
			assert.equal(
				listingAccount.makerMint.toBase58(),
				makerMint.toBase58(),
				"Listing mint mismatch"
			);
			assert.equal(
				listingAccount.price.toString(),
				listingPrice.toString(),
				"Listing price mismatch"
			);
			assert.isTrue(listingAccount.isListed, "NFT not marked as listed");

			console.log("✅ NFT listed successfully");
			console.log("Listing data:", {
				maker: listingAccount.maker.toBase58(),
				price: listingAccount.price.toString(),
				isListed: listingAccount.isListed,
				listedAt: new Date(listingAccount.listedAt.toNumber() * 1000).toISOString(),
				listBump: listingAccount.listBump
			});
		} catch (error) {
			console.log(`Error listing NFT: ${error}`);
			throw error;
		}
	});

});
