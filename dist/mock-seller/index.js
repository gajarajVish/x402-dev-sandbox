"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const crypto_1 = __importDefault(require("crypto"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const PORT = parseInt(process.env.SELLER_PORT || '4000', 10);
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'http://localhost:5000/verify';
const PRODUCT_AMOUNT = parseInt(process.env.PRODUCT_AMOUNT || '1000', 10);
const PRODUCT_CURRENCY = process.env.PRODUCT_CURRENCY || 'USDC';
const SELLER_WALLET_ADDRESS = process.env.SELLER_WALLET_ADDRESS; // Optional for devnet mode
function generatePaymentRequirements() {
    const reqId = `req_${crypto_1.default.randomBytes(8).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const requirements = {
        id: reqId,
        product: 'api_inference_v1',
        amount: PRODUCT_AMOUNT,
        currency: PRODUCT_CURRENCY,
        chain: 'solana',
        facilitator: FACILITATOR_URL,
        expires_at: expiresAt.toISOString(),
    };
    // Include recipient address if configured (for devnet payments)
    if (SELLER_WALLET_ADDRESS) {
        requirements.recipient = SELLER_WALLET_ADDRESS;
    }
    return requirements;
}
function isValidPaymentToken(token) {
    // Accept mock tokens and devnet tokens
    return token.startsWith('mock-sig:') || token.startsWith('devnet-sig:');
}
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'mock-seller', port: PORT });
});
app.post('/inference', (req, res) => {
    const paymentHeader = req.header('X-PAYMENT');
    // Check if payment header is completely missing (undefined)
    if (paymentHeader === undefined) {
        const requirements = generatePaymentRequirements();
        console.log(`[402] Payment required for request. ID: ${requirements.id}`);
        return res.status(402).json({
            error: 'payment_required',
            message: 'Payment is required to access this resource',
            payment_requirements: requirements,
        });
    }
    // If header is present but empty or invalid, return 403
    if (!paymentHeader || paymentHeader.trim() === '' || !isValidPaymentToken(paymentHeader)) {
        console.log(`[403] Invalid payment token`);
        return res.status(403).json({
            error: 'invalid_payment',
            message: 'The provided payment token is invalid',
        });
    }
    const { prompt } = req.body;
    console.log(`[200] Request authorized. Processing: ${prompt}`);
    const result = {
        result: `Processed inference for: "${prompt}"`,
        model: 'mock-model-v1',
        cost_charged: PRODUCT_AMOUNT,
        timestamp: new Date().toISOString(),
    };
    return res.status(200).json(result);
});
app.listen(PORT, () => {
    console.log(`🚀 Mock Seller running on http://localhost:${PORT}`);
    console.log(`   Price: ${PRODUCT_AMOUNT} ${PRODUCT_CURRENCY}`);
});
exports.default = app;
