# X402 Sandbox Deployment Guide

This guide covers deploying the X402 Escrow Solana program to devnet and integrating it with the sandbox environment.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Building the Solana Program](#building-the-solana-program)
3. [Deploying to Devnet](#deploying-to-devnet)
4. [Updating Configuration](#updating-configuration)
5. [Testing the Deployment](#testing-the-deployment)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

### 1. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustup --version
```

### 2. Install Solana CLI

```bash
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana --version
```

### 3. Install Anchor Framework

```bash
# Install Anchor Version Manager
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force

# Install Anchor 0.29.0
avm install 0.29.0
avm use 0.29.0

# Verify
anchor --version
```

## Building the Solana Program

### Step 1: Navigate to Program Directory

```bash
cd solana-program
```

### Step 2: Build the Program

```bash
anchor build
```

This will:
- Compile the Rust program
- Generate the program binary at `target/deploy/x402_escrow.so`
- Generate the IDL at `target/idl/x402_escrow.json`

Expected output:
```
Compiling x402_escrow v0.1.0
Finished release [optimized] target(s) in XX.XXs
```

## Deploying to Devnet

### Step 1: Configure Solana CLI

```bash
# Set cluster to devnet
solana config set --url https://api.devnet.solana.com

# Verify configuration
solana config get
```

### Step 2: Create/Load Wallet

**Option A: Create new wallet**
```bash
solana-keygen new --outfile ~/.config/solana/id.json
```

**Option B: Use existing wallet**
```bash
# Make sure your wallet is at ~/.config/solana/id.json
# Or update Anchor.toml to point to your wallet location
```

Get your wallet address:
```bash
solana address
```

### Step 3: Fund Your Wallet

Request devnet SOL (you'll need ~2 SOL for deployment):

```bash
solana airdrop 2

# Check balance
solana balance
```

If airdrop fails, try:
- Requesting smaller amounts: `solana airdrop 1`
- Using the [Solana Faucet](https://faucet.solana.com/)
- Waiting a few minutes between requests

### Step 4: Generate Program Keypair

```bash
# From solana-program directory
solana-keygen new --outfile target/deploy/x402_escrow-keypair.json
```

### Step 5: Get Program ID

```bash
solana address -k target/deploy/x402_escrow-keypair.json
```

Copy this address - you'll need it in the next step.

### Step 6: Update Program ID in Code

Update the program ID in these files:

**1. `programs/x402_escrow/src/lib.rs` (Line 5)**
```rust
declare_id!("YOUR_PROGRAM_ID_HERE");
```

**2. `Anchor.toml` (Lines 8 and 11)**
```toml
[programs.devnet]
x402_escrow = "YOUR_PROGRAM_ID_HERE"

[programs.localnet]
x402_escrow = "YOUR_PROGRAM_ID_HERE"
```

**3. `../src/sdk/solana-program-client.ts` (Line 16)**
```typescript
export const X402_PROGRAM_ID = new PublicKey('YOUR_PROGRAM_ID_HERE');
```

### Step 7: Rebuild with New Program ID

```bash
anchor build
```

### Step 8: Deploy to Devnet

```bash
anchor deploy
```

Or use Solana CLI directly:
```bash
solana program deploy target/deploy/x402_escrow.so
```

Expected output:
```
Program Id: YOUR_PROGRAM_ID

Signature: 5Kj...xyz (transaction signature)
```

### Step 9: Verify Deployment

```bash
# Check program account
solana program show YOUR_PROGRAM_ID

# Expected output should show:
# - Program Id
# - Owner (BPFLoaderUpgradeable)
# - ProgramData Address
# - Authority (your wallet)
# - Last Deployed Slot
# - Data Length
```

## Updating Configuration

### Step 1: Rebuild TypeScript Project

```bash
cd ..  # Back to project root
npm run build
```

### Step 2: Create Environment Configuration

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```bash
# Seller Configuration
SELLER_WALLET_ADDRESS=YOUR_SELLER_WALLET_ADDRESS
PRODUCT_AMOUNT=1000
PRODUCT_CURRENCY=SOL

# Facilitator Configuration
FACILITATOR_MODE=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
```

## Testing the Deployment

### Test 1: Check Program is Callable

```bash
# Monitor program logs
solana logs YOUR_PROGRAM_ID
```

In another terminal:

```bash
# Run devnet example
tsx examples/devnet-client.ts
```

### Test 2: Manual Program Interaction

Create a test script to initialize a payment:

```typescript
import { Connection, Keypair } from '@solana/web3.js';
import { initializePayment } from './src/sdk';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const seller = Keypair.generate();

// Request airdrop for seller
await connection.requestAirdrop(seller.publicKey, 1e9);

// Initialize payment
const signature = await initializePayment(
  connection,
  seller,
  'test_request_123',
  1000, // amount in lamports
  Math.floor(Date.now() / 1000) + 300 // expires in 5 minutes
);

console.log('Payment initialized:', signature);
```

### Test 3: Full Flow Test

Start the services:

```bash
# Terminal 1: Facilitator
FACILITATOR_MODE=devnet npm run dev:facilitator

# Terminal 2: Seller
SELLER_WALLET_ADDRESS=YOUR_ADDRESS PRODUCT_CURRENCY=SOL npm run dev:seller

# Terminal 3: Client
tsx examples/devnet-client.ts
```

## Deployment Costs

Estimated costs on devnet (free SOL from faucet):

- **Program deployment**: ~0.5-2 SOL (one-time)
- **Per payment account**: ~0.002 SOL (rent-exempt reserve)
- **Per transaction**: ~0.000005 SOL

For mainnet, multiply by actual SOL price.

## Upgrading the Program

To upgrade an already deployed program:

```bash
# Make changes to the code
# Rebuild
anchor build

# Upgrade (must be same authority)
solana program deploy target/deploy/x402_escrow.so --program-id YOUR_PROGRAM_ID

# Or with Anchor
anchor upgrade target/deploy/x402_escrow.so --program-id YOUR_PROGRAM_ID
```

## Troubleshooting

### Build Errors

**Error: `anchor: command not found`**
```bash
# Reinstall Anchor
avm install 0.29.0
avm use 0.29.0
```

**Error: `cargo: command not found`**
```bash
# Reinstall Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### Deployment Errors

**Error: `Insufficient funds`**
```bash
# Check balance
solana balance

# Request more SOL
solana airdrop 1
```

**Error: `Program deployment failed`**
```bash
# Verify program keypair exists
ls -la target/deploy/x402_escrow-keypair.json

# Regenerate if needed
solana-keygen new --outfile target/deploy/x402_escrow-keypair.json --force
```

**Error: `Account data too small`**
- The program size exceeds the allocated space
- Increase the buffer size or optimize the program

### Runtime Errors

**Error: `Program XYZ not found`**
- Verify program is deployed: `solana program show YOUR_PROGRAM_ID`
- Check program ID matches in all files
- Rebuild and redeploy if needed

**Error: `Transaction simulation failed`**
```bash
# View detailed logs
solana logs YOUR_PROGRAM_ID -v

# Common causes:
# - Insufficient funds
# - Invalid account data
# - Incorrect PDAs
# - Expired payment
```

### RPC Issues

If devnet RPC is slow or failing:

```bash
# Try alternative RPC endpoints in .env
SOLANA_RPC_URL=https://api.devnet.solana.com
# or
SOLANA_RPC_URL=https://rpc.ankr.com/solana_devnet
```

## Next Steps

After successful deployment:

1. ✅ Program is deployed to devnet
2. ✅ TypeScript client can interact with program
3. ✅ SDK uses escrow program for payments
4. 📝 Document program address for users
5. 📹 Record demo video showing the flow
6. 🚀 Prepare for hackathon submission

## Additional Resources

- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [Solana Developer Docs](https://docs.solana.com/)
- [Program Deployment Guide](https://docs.solana.com/cli/deploy-a-program)

---

For issues or questions, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md) or open a GitHub issue.
