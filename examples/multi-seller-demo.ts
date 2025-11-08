/**
 * Multi-Seller Network Demo
 *
 * This example demonstrates making requests to multiple seller nodes
 * in a network, showing how the SDK handles different pricing and
 * concurrent requests.
 *
 * Prerequisites:
 * 1. Start the mock network: npm run launch
 * 2. Run this example: tsx examples/multi-seller-demo.ts
 */

import { X402Client } from '../src/sdk';

interface RequestResult {
  seller: number;
  port: number;
  prompt: string;
  result?: string;
  cost?: number;
  error?: string;
}

async function main() {
  console.log('🌐 Starting Multi-Seller Network Demo\n');

  // Create client instance
  const client = new X402Client({
    mode: 'mock',
    payerIdentity: 'multi-seller-demo-wallet',
  });

  // Define seller configuration (matching default launcher setup)
  const sellers = [
    { id: 1, port: 4000 },
    { id: 2, port: 4001 },
    { id: 3, port: 4002 },
  ];

  console.log(`📡 Discovered ${sellers.length} sellers in network\n`);

  // Example 1: Sequential requests to each seller
  console.log('🔄 Example 1: Sequential requests to each seller');
  console.log('─'.repeat(60));

  for (const seller of sellers) {
    try {
      const prompt = `Hello from seller ${seller.id}`;
      console.log(`\n📤 Requesting from Seller #${seller.id} (port ${seller.port})...`);

      const response = await client.requestWithAutoPay(
        `http://localhost:${seller.port}/inference`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt }),
        }
      );

      const data = await response.json();
      console.log(`✅ Success!`);
      console.log(`   Cost: ${data.cost_charged} minor units`);
      console.log(`   Result: ${data.result}`);

    } catch (error) {
      console.error(`❌ Failed for Seller #${seller.id}:`, error instanceof Error ? error.message : error);
    }
  }

  // Example 2: Concurrent requests to all sellers
  console.log('\n\n🚀 Example 2: Concurrent requests to all sellers');
  console.log('─'.repeat(60));

  const prompts = [
    'What is blockchain?',
    'Explain smart contracts',
    'What is Solana?',
  ];

  console.log('\n📤 Sending concurrent requests...');

  const concurrentRequests = sellers.map((seller, index) =>
    client.requestWithAutoPay(
      `http://localhost:${seller.port}/inference`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: prompts[index] }),
      }
    )
  );

  try {
    const responses = await Promise.all(concurrentRequests);
    const results = await Promise.all(responses.map(r => r.json()));

    console.log('\n✅ All requests completed!\n');

    results.forEach((data, index) => {
      console.log(`Seller #${sellers[index].id}:`);
      console.log(`   Prompt: "${prompts[index]}"`);
      console.log(`   Cost: ${data.cost_charged} minor units`);
      console.log(`   Result: ${data.result}\n`);
    });

  } catch (error) {
    console.error('❌ Concurrent request error:', error);
  }

  // Example 3: Check pricing differences
  console.log('\n💰 Example 3: Comparing seller pricing');
  console.log('─'.repeat(60));

  const pricingResults: Array<{ seller: number; port: number; amount: number; currency: string }> = [];

  for (const seller of sellers) {
    try {
      // Make request without payment to get 402 response with pricing
      const response = await fetch(`http://localhost:${seller.port}/inference`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: 'test' }),
      });

      const data = await response.json();

      if (data.payment_requirements) {
        pricingResults.push({
          seller: seller.id,
          port: seller.port,
          amount: data.payment_requirements.amount,
          currency: data.payment_requirements.currency,
        });
      }

    } catch (error) {
      console.error(`Failed to get pricing for Seller #${seller.id}`);
    }
  }

  console.log('\n📊 Pricing comparison:');
  pricingResults.forEach((pricing) => {
    console.log(`   Seller #${pricing.seller} (port ${pricing.port}): ${pricing.amount} ${pricing.currency}`);
  });

  // Example 4: Load distribution simulation
  console.log('\n\n⚖️  Example 4: Load distribution simulation');
  console.log('─'.repeat(60));

  const numRequests = 12;
  console.log(`\n📤 Distributing ${numRequests} requests across ${sellers.length} sellers...\n`);

  const loadResults: RequestResult[] = [];

  const loadRequests = Array(numRequests)
    .fill(null)
    .map((_, i) => {
      const seller = sellers[i % sellers.length];
      return client
        .requestWithAutoPay(`http://localhost:${seller.port}/inference`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: `Load test request ${i + 1}` }),
        })
        .then(async (response) => {
          const data = await response.json();
          return {
            seller: seller.id,
            port: seller.port,
            prompt: `Load test request ${i + 1}`,
            result: data.result,
            cost: data.cost_charged,
          };
        })
        .catch((error) => ({
          seller: seller.id,
          port: seller.port,
          prompt: `Load test request ${i + 1}`,
          error: error.message,
        }));
    });

  try {
    const results = await Promise.all(loadRequests);

    // Count requests per seller
    const requestCounts = new Map<number, number>();
    let totalCost = 0;

    results.forEach((result) => {
      const count = requestCounts.get(result.seller) || 0;
      requestCounts.set(result.seller, count + 1);
      if (result.cost) {
        totalCost += result.cost;
      }
    });

    console.log('✅ Load distribution complete!\n');
    console.log('📊 Statistics:');
    requestCounts.forEach((count, sellerId) => {
      console.log(`   Seller #${sellerId}: ${count} requests (${((count / numRequests) * 100).toFixed(1)}%)`);
    });
    console.log(`\n💵 Total cost: ${totalCost} minor units`);

  } catch (error) {
    console.error('❌ Load distribution error:', error);
  }

  console.log('\n\n✨ Multi-seller demo completed successfully!');
}

// Run the demo
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
