/**
 * Manual Payment Flow Example
 *
 * This example demonstrates the step-by-step 402 payment flow
 * WITHOUT using the SDK, showing what happens under the hood.
 *
 * Prerequisites:
 * 1. Start the mock network: npm run launch
 * 2. Run this example: tsx examples/manual-flow.ts
 */

async function main() {
  console.log('🔧 Manual X402 Payment Flow Example\n');
  console.log('This demonstrates the low-level payment flow without the SDK.\n');

  const sellerUrl = 'http://localhost:4000/inference';
  const requestBody = { prompt: 'Manual flow test' };

  // ========================================
  // STEP 1: Make initial request (no payment)
  // ========================================
  console.log('📍 STEP 1: Making initial request without payment');
  console.log('─'.repeat(60));

  let response = await fetch(sellerUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  console.log(`Status: ${response.status} ${response.statusText}`);

  if (response.status !== 402) {
    console.log('❌ Expected 402 Payment Required, but got:', response.status);
    return;
  }

  console.log('✅ Received 402 Payment Required\n');

  // ========================================
  // STEP 2: Parse payment requirements
  // ========================================
  console.log('📍 STEP 2: Parsing payment requirements');
  console.log('─'.repeat(60));

  const responseData = await response.json();
  const paymentRequirements = responseData.payment_requirements;

  console.log('Payment Requirements:');
  console.log('   ID:', paymentRequirements.id);
  console.log('   Product:', paymentRequirements.product);
  console.log('   Amount:', paymentRequirements.amount, paymentRequirements.currency);
  console.log('   Chain:', paymentRequirements.chain);
  console.log('   Facilitator:', paymentRequirements.facilitator);
  console.log('   Expires:', paymentRequirements.expires_at);

  const expiresAt = new Date(paymentRequirements.expires_at);
  const timeUntilExpiry = expiresAt.getTime() - Date.now();
  console.log(`   ⏱  Time until expiry: ${Math.floor(timeUntilExpiry / 1000)} seconds\n`);

  // ========================================
  // STEP 3: Create payment proof (mock)
  // ========================================
  console.log('📍 STEP 3: Creating payment proof');
  console.log('─'.repeat(60));

  const paymentProof = {
    signature: `mock-proof-${paymentRequirements.id}`,
    timestamp: new Date().toISOString(),
    payer: 'manual-demo-wallet',
  };

  console.log('Payment Proof:');
  console.log('   Payer:', paymentProof.payer);
  console.log('   Signature:', paymentProof.signature);
  console.log('   Timestamp:', paymentProof.timestamp);
  console.log('');

  // ========================================
  // STEP 4: Verify payment with facilitator
  // ========================================
  console.log('📍 STEP 4: Verifying payment with facilitator');
  console.log('─'.repeat(60));

  const verificationRequest = {
    proof: paymentProof,
    payer: paymentProof.payer,
    amount: paymentRequirements.amount,
    chain: paymentRequirements.chain,
    request_id: paymentRequirements.id,
  };

  console.log(`Sending verification request to: ${paymentRequirements.facilitator}`);

  const verifyResponse = await fetch(paymentRequirements.facilitator, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(verificationRequest),
  });

  console.log(`Verification status: ${verifyResponse.status}`);

  const verificationResult = await verifyResponse.json();

  if (!verificationResult.ok) {
    console.log('❌ Payment verification failed:', verificationResult.error);
    console.log('   Detail:', verificationResult.detail);
    return;
  }

  console.log('✅ Payment verified!');
  console.log('   Verification token:', verificationResult.verification);
  console.log('   Settled:', verificationResult.settled);
  console.log('   Timestamp:', verificationResult.timestamp);
  console.log('');

  // ========================================
  // STEP 5: Retry request with payment token
  // ========================================
  console.log('📍 STEP 5: Retrying request with payment token');
  console.log('─'.repeat(60));

  response = await fetch(sellerUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-PAYMENT': verificationResult.verification,
    },
    body: JSON.stringify(requestBody),
  });

  console.log(`Status: ${response.status} ${response.statusText}`);

  if (response.status !== 200) {
    console.log('❌ Expected 200 OK, but got:', response.status);
    const errorData = await response.json();
    console.log('   Error:', errorData);
    return;
  }

  const finalResult = await response.json();

  console.log('✅ Request successful!\n');
  console.log('Response Data:');
  console.log('   Result:', finalResult.result);
  console.log('   Model:', finalResult.model);
  console.log('   Cost charged:', finalResult.cost_charged, 'minor units');
  console.log('   Timestamp:', finalResult.timestamp);

  // ========================================
  // Summary
  // ========================================
  console.log('\n\n📊 FLOW SUMMARY');
  console.log('═'.repeat(60));
  console.log('1. ❌ Initial request → 402 Payment Required');
  console.log('2. 📋 Parsed payment requirements');
  console.log('3. 🔐 Created payment proof');
  console.log('4. ✅ Verified payment with facilitator');
  console.log('5. ✅ Retried request with token → 200 OK');
  console.log('');
  console.log('💡 The X402Client SDK automates all these steps for you!');
  console.log('');
  console.log('✨ Manual flow demo completed successfully!');
}

// Run the demo
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
