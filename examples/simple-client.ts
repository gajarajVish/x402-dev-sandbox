/**
 * Simple Client Example
 *
 * This example demonstrates basic usage of the X402Client SDK
 * to make API requests with automatic payment handling.
 *
 * Prerequisites:
 * 1. Start the mock network: npm run launch
 * 2. Run this example: tsx examples/simple-client.ts
 */

import { X402Client } from '../src/sdk';

async function main() {
  console.log('🚀 Starting Simple X402 Client Example\n');

  // Create a client instance in mock mode
  const client = new X402Client({
    mode: 'mock',
    payerIdentity: 'example-wallet-123',
  });

  console.log('📞 Making request to seller API...');

  try {
    // The SDK automatically handles the full payment flow:
    // 1. Makes initial request
    // 2. Detects 402 Payment Required response
    // 3. Parses payment requirements
    // 4. Creates payment proof
    // 5. Verifies with facilitator
    // 6. Retries request with payment token
    const response = await client.requestWithAutoPay(
      'http://localhost:4000/inference',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'What is the meaning of life?',
        }),
      }
    );

    console.log(`✅ Response status: ${response.status}\n`);

    const data = await response.json();

    console.log('📦 Response data:');
    console.log('   Result:', data.result);
    console.log('   Model:', data.model);
    console.log('   Cost charged:', data.cost_charged, 'minor units');
    console.log('   Timestamp:', data.timestamp);

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  console.log('\n✨ Example completed successfully!');
}

// Run the example
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
