/**
 * Devnet Client Example
 *
 * This example demonstrates using the X402 SDK with Solana devnet.
 * It creates real Solana transactions for payment verification.
 *
 * Prerequisites:
 * 1. Start facilitator in devnet mode: FACILITATOR_MODE=devnet npm run dev:facilitator
 * 2. Start seller with wallet address: SELLER_WALLET_ADDRESS=<your-address> npm run dev:seller
 * 3. Ensure you have SOL in your devnet wallet (use solana airdrop)
 */

import { X402Client, createTestKeypair, requestAirdrop } from '../src/sdk';
import { Connection, Keypair } from '@solana/web3.js';

async function main() {
  console.log('🚀 Starting Devnet X402 Client Example\n');

  // Create or load a Solana keypair for the payer
  // In production, you would load this from a file or environment variable
  const payerKeypair = createTestKeypair();
  console.log(`👛 Payer wallet: ${payerKeypair.publicKey.toBase58()}\n`);

  // Request airdrop for testing on devnet
  console.log('💰 Requesting airdrop from Solana devnet...');
  try {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const airdropSignature = await requestAirdrop(connection, payerKeypair.publicKey, 1);
    console.log(`✅ Airdrop successful: ${airdropSignature}\n`);
  } catch (error) {
    console.error('❌ Airdrop failed. You may need to wait or use a different RPC endpoint.');
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}\n`);
    // Continue anyway - wallet might already have funds
  }

  // Create X402 client in devnet mode
  const client = new X402Client({
    mode: 'devnet',
    solanaKeypair: payerKeypair,
    solanaRpcUrl: 'https://api.devnet.solana.com',
  });

  console.log('📞 Making request to seller API...\n');

  try {
    // Make request - SDK will automatically handle payment flow
    const response = await client.requestWithAutoPay(
      'http://localhost:4000/inference',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Explain how Solana devnet payments work in x402 protocol',
        }),
      }
    );

    console.log(`✅ Response status: ${response.status}\n`);

    if (response.ok) {
      const data = await response.json();
      console.log('📦 Response data:');
      console.log(`   Result: ${data.result}`);
      console.log(`   Model: ${data.model}`);
      console.log(`   Cost charged: ${data.cost_charged} minor units`);
      console.log(`   Timestamp: ${data.timestamp}\n`);
    } else {
      const error = await response.json();
      console.error('❌ Request failed:');
      console.error(`   Error: ${error.error}`);
      console.error(`   Message: ${error.message || error.detail}\n`);
    }

    console.log('✨ Example completed successfully!');
  } catch (error) {
    console.error('❌ Error occurred:');
    console.error(`   ${error instanceof Error ? error.message : String(error)}\n`);
    console.log('💡 Make sure:');
    console.log('   1. Facilitator is running in devnet mode: FACILITATOR_MODE=devnet npm run dev:facilitator');
    console.log('   2. Seller is running with wallet address: SELLER_WALLET_ADDRESS=<address> npm run dev:seller');
    console.log('   3. Seller wallet address is valid on Solana devnet');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
