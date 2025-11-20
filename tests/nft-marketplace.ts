import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NftMarketplace } from "../target/types/nft_marketplace";
import { create, fetchCollection, mplCore } from "@metaplex-foundation/mpl-core";
import { createSignerFromKeypair, generateSigner, keypairIdentity } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { assert } from "chai";

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
});
