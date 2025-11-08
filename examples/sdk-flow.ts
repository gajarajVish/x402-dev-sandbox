/**
 * SDK Automated Payment Flow Example
 *
 * This example demonstrates using the X402Client SDK which automatically
 * handles the payment flow for you:
 * - Detects 402 responses
 * - Creates payment proofs
 * - Verifies with facilitator
 * - Retries with payment token
 *
 * All in a single method call!
 */

import { X402Client } from '../src/sdk';

// Make sure to start the network first:
// npm run launch

async function sdkPaymentFlowExample() {
  console.log('=== X402 SDK Automated Payment Flow Demo ===\n');

  // Create X402 client
  const client = new X402Client({
    mode: 'mock',
    payerIdentity: 'demo-sdk-wallet-67890',
  });

  const SELLER_URL = 'http://localhost:4000';

  console.log('Making request with automatic payment handling...\n');

  try {
    // The SDK automatically handles the entire payment flow!
    const response = await client.requestWithAutoPay(
      `${SELLER_URL}/inference`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Explain quantum computing in simple terms'
        }),
      }
    );

    console.log(`\nFinal Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json() as any;
      console.log('\n=== SUCCESS! ===');
      console.log('API Response:', JSON.stringify(data, null, 2));
    } else {
      console.log('Request failed:', await response.text());
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

// Run multiple requests to show it works repeatedly
async function multipleRequestsExample() {
  console.log('\n\n=== Multiple Requests Example ===\n');

  const client = new X402Client({
    mode: 'mock',
    payerIdentity: 'demo-multi-wallet',
  });

  const SELLER_URL = 'http://localhost:4000';

  const prompts = [
    'What is machine learning?',
    'Explain blockchain technology',
    'What are neural networks?',
  ];

  for (let i = 0; i < prompts.length; i++) {
    console.log(`\nRequest ${i + 1}/${prompts.length}: "${prompts[i]}"`);

    const response = await client.requestWithAutoPay(
      `${SELLER_URL}/inference`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: prompts[i] }),
      }
    );

    if (response.ok) {
      const data = await response.json() as any;
      console.log(`  ✓ Success! Cost: ${data.cost_charged} USDC`);
    } else {
      console.log(`  ✗ Failed with status ${response.status}`);
    }
  }

  console.log('\n=== All requests completed! ===');
}

// Run the examples
async function main() {
  try {
    await sdkPaymentFlowExample();
    await multipleRequestsExample();
  } catch (error: any) {
    console.error('Error:', error.message);
    console.error('\nMake sure the network is running: npm run launch');
    process.exit(1);
  }
}

main();
