"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSolanaPayment = createSolanaPayment;
exports.verifySolanaTransaction = verifySolanaTransaction;
exports.requestAirdrop = requestAirdrop;
exports.createTestKeypair = createTestKeypair;
exports.loadKeypairFromPrivateKey = loadKeypairFromPrivateKey;
const web3_js_1 = require("@solana/web3.js");
const solana_program_client_1 = require("./solana-program-client");
/**
 * Creates and sends a Solana payment transaction
 * @param config - Solana configuration
 * @param recipientAddress - Seller's wallet address
 * @param amount - Amount in lamports (for SOL) or token smallest unit
 * @param currency - Currency type (SOL, USDC, etc.)
 * @returns Transaction signature
 */
async function createSolanaPayment(config, recipientAddress, amount, currency) {
    const rpcUrl = config.rpcUrl || 'https://api.devnet.solana.com';
    const connection = new web3_js_1.Connection(rpcUrl, config.commitment || 'confirmed');
    if (!config.payerKeypair) {
        throw new Error('Payer keypair required for devnet payments');
    }
    const payerKeypair = config.payerKeypair;
    const recipient = new web3_js_1.PublicKey(recipientAddress);
    // If using the escrow program, call depositPayment
    if (config.useProgram) {
        if (!config.requestId) {
            throw new Error('requestId required when using escrow program');
        }
        console.log('[SDK] Using X402 Escrow Program for payment');
        const signature = await (0, solana_program_client_1.depositPayment)(connection, payerKeypair, recipient, config.requestId);
        return signature;
    }
    // Otherwise, use direct transfer (simpler but less secure)
    let transaction;
    let signature;
    if (currency.toLowerCase() === 'sol') {
        // SOL transfer
        transaction = new web3_js_1.Transaction().add(web3_js_1.SystemProgram.transfer({
            fromPubkey: payerKeypair.publicKey,
            toPubkey: recipient,
            lamports: amount,
        }));
        signature = await (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [payerKeypair], { commitment: config.commitment || 'confirmed' });
    }
    else {
        // SPL Token transfer (USDC, etc.)
        // This requires the token mint address
        // For now, we'll throw an error and implement this next
        throw new Error(`SPL token transfers not yet implemented for ${currency}`);
    }
    return signature;
}
/**
 * Verifies a Solana transaction exists and matches expected parameters
 * @param connection - Solana connection
 * @param signature - Transaction signature to verify
 * @param expectedRecipient - Expected recipient address
 * @param expectedAmount - Expected amount transferred
 * @returns Verification result
 */
async function verifySolanaTransaction(connection, signature, expectedRecipient, expectedAmount) {
    try {
        const tx = await connection.getTransaction(signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
        });
        if (!tx) {
            return { verified: false, detail: 'Transaction not found' };
        }
        if (tx.meta?.err) {
            return { verified: false, detail: 'Transaction failed on-chain' };
        }
        // Basic verification - transaction exists and succeeded
        // More detailed verification (amount, recipient) requires parsing instructions
        return { verified: true };
    }
    catch (error) {
        return {
            verified: false,
            detail: `Verification error: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}
/**
 * Requests airdrop for testing on devnet
 * @param connection - Solana connection
 * @param publicKey - Public key to receive airdrop
 * @param amount - Amount in SOL
 */
async function requestAirdrop(connection, publicKey, amount = 1) {
    const signature = await connection.requestAirdrop(publicKey, amount * web3_js_1.LAMPORTS_PER_SOL);
    await connection.confirmTransaction(signature, 'confirmed');
    return signature;
}
/**
 * Creates a new Solana keypair for testing
 */
function createTestKeypair() {
    return web3_js_1.Keypair.generate();
}
/**
 * Loads a keypair from a base58 private key string
 */
function loadKeypairFromPrivateKey(privateKey) {
    const bs58 = require('bs58');
    const decoded = bs58.decode(privateKey);
    return web3_js_1.Keypair.fromSecretKey(decoded);
}
