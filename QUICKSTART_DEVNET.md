# Quick Start: Deploy to Solana Devnet

This guide will get you from zero to deployed in 15 minutes.

## Prerequisites

- macOS/Linux (or WSL on Windows)
- Node.js >= 18
- 15 minutes of your time

## Step 1: Install Solana Tools (5 minutes)

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.29.0
avm use 0.29.0

# Verify installations
rustc --version
solana --version
anchor --version
```

## Step 2: Configure Solana for Devnet (2 minutes)

```bash
# Set cluster to devnet
solana config set --url https://api.devnet.solana.com

# Create wallet (or use existing)
solana-keygen new --outfile ~/.config/solana/id.json

# Get your address
solana address

# Request airdrop (2 SOL for deployment)
solana airdrop 2

# Check balance
solana balance
```

## Step 3: Build and Deploy Program (5 minutes)

```bash
# Navigate to program directory
cd solana-program

# Generate program keypair
solana-keygen new --outfile target/deploy/x402_escrow-keypair.json

# Get the program ID
PROGRAM_ID=$(solana address -k target/deploy/x402_escrow-keypair.json)
echo "Your Program ID: $PROGRAM_ID"

# Update program ID in lib.rs
sed -i '' "s/X4oZJgFqbY7p8YqV2qh3E5cR6w8N9tA2sK3bL4mD5nE/$PROGRAM_ID/g" programs/x402_escrow/src/lib.rs

# Update program ID in Anchor.toml
sed -i '' "s/X4oZJgFqbY7p8YqV2qh3E5cR6w8N9tA2sK3bL4mD5nE/$PROGRAM_ID/g" Anchor.toml

# Update program ID in TypeScript client
cd ..
sed -i '' "s/X4oZJgFqbY7p8YqV2qh3E5cR6w8N9tA2sK3bL4mD5nE/$PROGRAM_ID/g" src/sdk/solana-program-client.ts

# Build the program
cd solana-program
anchor build

# Deploy to devnet
anchor deploy

# Verify deployment
solana program show $PROGRAM_ID
```

Expected output:
```
Program Id: <YOUR_PROGRAM_ID>
Owner: BPFLoaderUpgradea...
ProgramData Address: ...
Authority: <YOUR_WALLET>
Last Deployed In Slot: ...
Data Length: ... bytes
Balance: ... SOL
```

## Step 4: Build TypeScript Project (1 minute)

```bash
# Go back to project root
cd ..

# Install dependencies (if not already done)
npm install

# Build TypeScript
npm run build
```

## Step 5: Test the Deployment (2 minutes)

### Option A: Quick Test with Devnet Client

```bash
# Run devnet example
tsx examples/devnet-client.ts
```

Expected output:
```
🚀 Starting Devnet X402 Client Example

👛 Payer wallet: <WALLET_ADDRESS>

💰 Requesting airdrop from Solana devnet...
✅ Airdrop successful: <TX_SIGNATURE>

📞 Making request to seller API...

[SDK] Payment required: 1000 SOL
[SDK] Creating Solana payment: 1000 SOL to <SELLER_ADDRESS>
[SDK] Payment transaction sent: <TX_SIGNATURE>
[SDK] Payment verified
✅ Response status: 200

📦 Response data:
   Result: Processed inference for: "Explain how Solana devnet payments work..."
   Model: mock-model-v1
   Cost charged: 1000 minor units
   Timestamp: ...

✨ Example completed successfully!
```

### Option B: Full Network Test

```bash
# Terminal 1: Start facilitator in devnet mode
FACILITATOR_MODE=devnet npm run dev:facilitator

# Terminal 2: Start seller with your wallet address
SELLER_WALLET_ADDRESS=$(solana address) PRODUCT_CURRENCY=SOL npm run dev:seller

# Terminal 3: Run client
tsx examples/devnet-client.ts
```

## Verification

### Check Your Program

```bash
# View program info
solana program show $PROGRAM_ID

# Monitor program logs
solana logs $PROGRAM_ID
```

### Check Transactions

```bash
# View transaction details
solana confirm <TX_SIGNATURE> -v

# View in Solana Explorer
echo "https://explorer.solana.com/tx/<TX_SIGNATURE>?cluster=devnet"
```

## Troubleshooting

### Airdrop Failed

```bash
# Try smaller amount
solana airdrop 1

# Or use web faucet
open https://faucet.solana.com/
```

### Build Failed

```bash
# Clean and rebuild
cd solana-program
anchor clean
anchor build
```

### Deployment Failed

```bash
# Check balance
solana balance

# Request more SOL
solana airdrop 2

# Retry deployment
anchor deploy
```

### Program Not Found

```bash
# Verify program ID is updated in all files
grep -r "X4oZJgFqbY7p8YqV2qh3E5cR6w8N9tA2sK3bL4mD5nE" .

# Should return no results if updated correctly
```

## What You've Accomplished

✅ Installed Solana development tools
✅ Created a Solana devnet wallet
✅ Built a Solana smart contract (program)
✅ Deployed program to Solana devnet
✅ Integrated program with TypeScript SDK
✅ Tested end-to-end payment flow

## Next Steps

### 1. Document Your Program ID

Add to README:
```markdown
## Deployed Program

**Devnet Program ID**: `<YOUR_PROGRAM_ID>`

View on Explorer: https://explorer.solana.com/address/<YOUR_PROGRAM_ID>?cluster=devnet
```

### 2. Push to GitHub

```bash
git add .
git commit -m "Add Solana program integration"
git push origin main
```

### 3. Record Demo Video

Show:
- Project overview (30 sec)
- Mock mode demo (1 min)
- Devnet mode with real transactions (1 min)
- On-chain program interaction (30 sec)

Tools:
- Screen recording: QuickTime (Mac), OBS (all platforms)
- Video editing: iMovie, DaVinci Resolve
- Upload: YouTube, Loom

### 4. Prepare Submission

Checklist:
- [ ] Code pushed to public GitHub repo
- [ ] README has clear setup instructions
- [ ] Program deployed to devnet
- [ ] Program ID documented
- [ ] Demo video recorded (max 3 min)
- [ ] All requirements met (see SOLANA_INTEGRATION.md)

## Useful Commands

```bash
# Check program info
solana program show <PROGRAM_ID>

# Monitor logs
solana logs <PROGRAM_ID>

# Check wallet balance
solana balance

# View transaction
solana confirm <TX_SIGNATURE> -v

# Switch RPC endpoint
solana config set --url https://api.devnet.solana.com

# Upgrade program
anchor upgrade target/deploy/x402_escrow.so --program-id <PROGRAM_ID>
```

## Resources

- **Deployment Guide**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Integration Summary**: [SOLANA_INTEGRATION.md](SOLANA_INTEGRATION.md)
- **Program Docs**: [solana-program/README.md](solana-program/README.md)
- **Solana Explorer**: https://explorer.solana.com/?cluster=devnet
- **Anchor Docs**: https://www.anchor-lang.com/
- **Solana Docs**: https://docs.solana.com/

## Support

- Check [DEPLOYMENT.md](DEPLOYMENT.md) for detailed troubleshooting
- View [SOLANA_INTEGRATION.md](SOLANA_INTEGRATION.md) for architecture details
- Open GitHub issue for bugs

---

**Estimated Time**: 15 minutes
**Difficulty**: Intermediate
**Cost**: Free (using devnet SOL from faucet)

Good luck with your hackathon submission! 🚀
