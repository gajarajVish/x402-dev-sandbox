"use strict";
/**
 * TypeScript client for the X402 Escrow Solana Program
 *
 * This module provides functions to interact with the on-chain escrow program.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.X402_PROGRAM_ID = void 0;
exports.getPaymentAccountPDA = getPaymentAccountPDA;
exports.initializePayment = initializePayment;
exports.depositPayment = depositPayment;
exports.verifyAndRelease = verifyAndRelease;
exports.refundPayment = refundPayment;
exports.getPaymentAccount = getPaymentAccount;
const web3_js_1 = require("@solana/web3.js");
// Program ID (must match the ID in the Solana program)
exports.X402_PROGRAM_ID = new web3_js_1.PublicKey('X4oZJgFqbY7p8YqV2qh3E5cR6w8N9tA2sK3bL4mD5nE');
/**
 * Derives the payment account PDA (Program Derived Address)
 */
async function getPaymentAccountPDA(seller, requestId, programId = exports.X402_PROGRAM_ID) {
    return web3_js_1.PublicKey.findProgramAddressSync([
        Buffer.from('payment'),
        seller.toBuffer(),
        Buffer.from(requestId),
    ], programId);
}
/**
 * Instruction discriminators for each instruction in the program
 */
var InstructionDiscriminator;
(function (InstructionDiscriminator) {
    InstructionDiscriminator[InstructionDiscriminator["InitializePayment"] = 0] = "InitializePayment";
    InstructionDiscriminator[InstructionDiscriminator["DepositPayment"] = 1] = "DepositPayment";
    InstructionDiscriminator[InstructionDiscriminator["VerifyAndRelease"] = 2] = "VerifyAndRelease";
    InstructionDiscriminator[InstructionDiscriminator["RefundPayment"] = 3] = "RefundPayment";
})(InstructionDiscriminator || (InstructionDiscriminator = {}));
/**
 * Initialize a payment requirement on-chain
 * Called by the seller to create escrow for a payment
 */
async function initializePayment(connection, seller, requestId, amount, expiresAt, programId = exports.X402_PROGRAM_ID) {
    const [paymentAccount] = await getPaymentAccountPDA(seller.publicKey, requestId, programId);
    // Serialize instruction data
    const data = Buffer.concat([
        Buffer.from([InstructionDiscriminator.InitializePayment]),
        serializeString(requestId),
        serializeU64(amount),
        serializeI64(expiresAt),
    ]);
    const instruction = new web3_js_1.TransactionInstruction({
        keys: [
            { pubkey: paymentAccount, isSigner: false, isWritable: true },
            { pubkey: seller.publicKey, isSigner: true, isWritable: true },
            { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId,
        data,
    });
    const transaction = new web3_js_1.Transaction().add(instruction);
    const signature = await (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [seller], { commitment: 'confirmed' });
    console.log(`[Program] Payment requirement initialized: ${paymentAccount.toBase58()}`);
    return signature;
}
/**
 * Deposit payment from buyer to escrow
 * Called by the buyer to pay for the API request
 */
async function depositPayment(connection, payer, seller, requestId, programId = exports.X402_PROGRAM_ID) {
    const [paymentAccount] = await getPaymentAccountPDA(seller, requestId, programId);
    // Serialize instruction data
    const data = Buffer.concat([
        Buffer.from([InstructionDiscriminator.DepositPayment]),
        serializeString(requestId),
    ]);
    const instruction = new web3_js_1.TransactionInstruction({
        keys: [
            { pubkey: paymentAccount, isSigner: false, isWritable: true },
            { pubkey: payer.publicKey, isSigner: true, isWritable: true },
            { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId,
        data,
    });
    const transaction = new web3_js_1.Transaction().add(instruction);
    const signature = await (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [payer], { commitment: 'confirmed' });
    console.log(`[Program] Payment deposited: ${signature}`);
    return signature;
}
/**
 * Verify payment and release funds to seller
 * Called after verification to complete the payment
 */
async function verifyAndRelease(connection, seller, requestId, programId = exports.X402_PROGRAM_ID) {
    const [paymentAccount] = await getPaymentAccountPDA(seller.publicKey, requestId, programId);
    // Serialize instruction data
    const data = Buffer.concat([
        Buffer.from([InstructionDiscriminator.VerifyAndRelease]),
        serializeString(requestId),
    ]);
    const instruction = new web3_js_1.TransactionInstruction({
        keys: [
            { pubkey: paymentAccount, isSigner: false, isWritable: true },
            { pubkey: seller.publicKey, isSigner: false, isWritable: true },
            { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId,
        data,
    });
    const transaction = new web3_js_1.Transaction().add(instruction);
    const signature = await (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [seller], { commitment: 'confirmed' });
    console.log(`[Program] Payment released to seller: ${signature}`);
    return signature;
}
/**
 * Refund an expired payment to the payer
 */
async function refundPayment(connection, payer, seller, requestId, programId = exports.X402_PROGRAM_ID) {
    const [paymentAccount] = await getPaymentAccountPDA(seller, requestId, programId);
    // Serialize instruction data
    const data = Buffer.concat([
        Buffer.from([InstructionDiscriminator.RefundPayment]),
        serializeString(requestId),
    ]);
    const instruction = new web3_js_1.TransactionInstruction({
        keys: [
            { pubkey: paymentAccount, isSigner: false, isWritable: true },
            { pubkey: payer.publicKey, isSigner: true, isWritable: true },
            { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId,
        data,
    });
    const transaction = new web3_js_1.Transaction().add(instruction);
    const signature = await (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [payer], { commitment: 'confirmed' });
    console.log(`[Program] Payment refunded: ${signature}`);
    return signature;
}
/**
 * Fetch payment account data
 */
async function getPaymentAccount(connection, seller, requestId, programId = exports.X402_PROGRAM_ID) {
    const [paymentAccount] = await getPaymentAccountPDA(seller, requestId, programId);
    const accountInfo = await connection.getAccountInfo(paymentAccount);
    if (!accountInfo) {
        return null;
    }
    return deserializePaymentAccount(accountInfo.data);
}
/**
 * Deserialize payment account data
 */
function deserializePaymentAccount(data) {
    // Skip 8-byte discriminator
    let offset = 8;
    // Read seller (32 bytes)
    const seller = new web3_js_1.PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    // Read request_id (4 bytes length + string data)
    const requestIdLen = data.readUInt32LE(offset);
    offset += 4;
    const requestId = data.slice(offset, offset + requestIdLen).toString('utf-8');
    offset += requestIdLen;
    // Read amount (8 bytes)
    const amount = Number(data.readBigUInt64LE(offset));
    offset += 8;
    // Read expires_at (8 bytes)
    const expiresAt = Number(data.readBigInt64LE(offset));
    offset += 8;
    // Read is_paid (1 byte)
    const isPaid = data[offset] === 1;
    offset += 1;
    // Read payer (32 bytes)
    const payer = new web3_js_1.PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    // Read bump (1 byte)
    const bump = data[offset];
    return {
        seller,
        requestId,
        amount,
        expiresAt,
        isPaid,
        payer,
        bump,
    };
}
// Serialization helpers
function serializeString(str) {
    const strBuffer = Buffer.from(str, 'utf-8');
    const lenBuffer = Buffer.alloc(4);
    lenBuffer.writeUInt32LE(strBuffer.length, 0);
    return Buffer.concat([lenBuffer, strBuffer]);
}
function serializeU64(value) {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(BigInt(value), 0);
    return buffer;
}
function serializeI64(value) {
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64LE(BigInt(value), 0);
    return buffer;
}
