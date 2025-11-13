# X402 Escrow Solana Program

This directory contains the on-chain Solana program (smart contract) for the X402 payment protocol. The program provides escrow functionality for payment-gated API requests.

## Features

- **Initialize Payment**: Sellers create payment requirements on-chain
- **Deposit Payment**: Buyers deposit funds into escrow
- **Verify & Release**: After verification, funds are released to seller
- **Refund**: Expired payments can be refunded to buyer

## Program Architecture

### Accounts

**PaymentRequirement** - Stores payment details:
- `seller`: Seller's public key
- `request_id`: Unique identifier for the request
- `amount`: Payment amount in lamports
- `expires_at`: Unix timestamp when payment expires
- `is_paid`: Whether payment has been deposited
- `payer`: Buyer's public key (after payment)
- `bump`: PDA bump seed

### Instructions

1. **initialize_payment** - Create a new payment requirement
   - Called by: Seller
   - Creates a PDA to store payment details

2. **deposit_payment** - Deposit funds to escrow
   - Called by: Buyer
   - Transfers SOL from buyer to payment PDA

3. **verify_and_release** - Release funds to seller
   - Called by: Seller (or facilitator)
   - Transfers SOL from PDA to seller
   - Closes the PDA account

4. **refund_payment** - Refund expired payment
   - Called by: Buyer
   - Only works after payment expires
   - Returns SOL to buyer

## Prerequisites

### Install Rust and Solana CLI

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Add Solana to PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Verify installation
solana --version
```

### Install Anchor Framework

```bash
# Install Anchor Version Manager (AVM)
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force

# Install Anchor 0.29.0
avm install 0.29.0
avm use 0.29.0

# Verify installation
anchor --version
```

## Building the Program

```bash
cd solana-program

# Build the program
anchor build

# The compiled program will be in:
# target/deploy/x402_escrow.so
```

## Deploying to Devnet

### Step 1: Configure Solana CLI for Devnet

```bash
# Set cluster to devnet
solana config set --url https://api.devnet.solana.com

# Create a new keypair (or use existing)
solana-keygen new --outfile ~/.config/solana/id.json

# Get your public key
solana address

# Request airdrop for deployment fees
solana airdrop 2

# Check balance
solana balance
```

### Step 2: Update Program ID

The program ID in the code is a placeholder. You need to:

1. Generate a new program keypair:
```bash
solana-keygen new --outfile target/deploy/x402_escrow-keypair.json
```

2. Get the program ID:
```bash
solana address -k target/deploy/x402_escrow-keypair.json
```

3. Update the program ID in these files:
   - `programs/x402_escrow/src/lib.rs` - Line 5: `declare_id!("YOUR_PROGRAM_ID")`
   - `Anchor.toml` - Update program IDs under `[programs.devnet]` and `[programs.localnet]`
   - `../../src/sdk/solana-program-client.ts` - Update `X402_PROGRAM_ID`

4. Rebuild after updating:
```bash
anchor build
```

### Step 3: Deploy

```bash
# Deploy the program to devnet
anchor deploy

# Or use Solana CLI directly
solana program deploy target/deploy/x402_escrow.so

# Verify deployment
solana program show YOUR_PROGRAM_ID
```

### Step 4: Verify Deployment

```bash
# Check program account
solana account YOUR_PROGRAM_ID

# View program logs
solana logs YOUR_PROGRAM_ID
```

## Testing the Program

### Run Anchor Tests

```bash
# Run all tests
anchor test

# Run tests without deploying (if already deployed)
anchor test --skip-deploy
```

### Manual Testing with Solana CLI

```bash
# Monitor program logs in real-time
solana logs YOUR_PROGRAM_ID

# In another terminal, run your TypeScript client
cd ../..
tsx examples/devnet-client-program.ts
```

## Program Upgrade

To upgrade an already deployed program:

```bash
# Make your changes to the code

# Rebuild
anchor build

# Upgrade the program
solana program deploy target/deploy/x402_escrow.so --program-id YOUR_PROGRAM_ID

# Or use Anchor
anchor upgrade target/deploy/x402_escrow.so --program-id YOUR_PROGRAM_ID
```

## Cost Estimation

Deploying a Solana program costs:
- **Program deployment**: ~0.5-2 SOL (depends on program size)
- **Per payment account**: ~0.002 SOL rent-exempt reserve
- **Transaction fees**: ~0.000005 SOL per transaction

Get devnet SOL from faucet:
```bash
solana airdrop 2
```

## Security Considerations

1. **PDA Seeds**: Payment accounts use PDAs with seeds `[b"payment", seller, request_id]`
2. **Signer Checks**: All sensitive operations require proper signers
3. **Expiration**: Payments expire and can be refunded
4. **Close Account**: Verified payments close the account to reclaim rent
5. **Amount Validation**: Zero amounts are rejected

## Troubleshooting

### Program not deploying
```bash
# Check balance
solana balance

# Request more SOL
solana airdrop 2

# Verify RPC connection
solana cluster-version
```

### Build errors
```bash
# Clean and rebuild
anchor clean
anchor build

# Update Anchor
avm install latest
avm use latest
```

### Transaction failing
```bash
# View detailed logs
solana logs YOUR_PROGRAM_ID -v

# Check transaction
solana confirm TRANSACTION_SIGNATURE -v
```

## IDL (Interface Definition Language)

After building, the IDL is generated at:
```
target/idl/x402_escrow.json
```

This IDL can be used by client libraries to automatically generate typed interfaces.

## Architecture Integration

```
┌──────────┐
│  Buyer   │
└────┬─────┘
     │ 1. Call API
     ▼
┌──────────┐
│  Seller  │
└────┬─────┘
     │ 2. Return 402 + create payment requirement on-chain
     ▼
┌──────────────────┐
│ Solana Program   │ ◄── PaymentRequirement PDA created
└──────────────────┘
     ▲
     │ 3. Buyer deposits payment
     │
┌────┴─────┐
│  Buyer   │
└────┬─────┘
     │ 4. Verify payment
     ▼
┌──────────────┐
│ Facilitator  │
└──────┬───────┘
       │ 5. Verify transaction on-chain
       ▼
┌──────────────────┐
│ Solana Program   │ ◄── Release funds to seller
└──────────────────┘
       │
       ▼
┌──────────┐
│  Seller  │ ◄── Receives payment
└──────────┘
```

## Resources

- [Anchor Framework Docs](https://www.anchor-lang.com/)
- [Solana Developer Docs](https://docs.solana.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [Anchor Examples](https://github.com/coral-xyz/anchor/tree/master/tests)

## License

MIT License - See LICENSE file in project root
