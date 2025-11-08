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
const PORT = parseInt(process.env.FACILITATOR_PORT || '5000', 10);
const MODE = process.env.FACILITATOR_MODE || 'mock';
const verifiedPayments = new Map();
function mockVerify(req) {
    console.log(`[MOCK] Verifying payment for ${req.payer}, amount: ${req.amount}`);
    const verificationToken = `mock-sig:${crypto_1.default.randomBytes(8).toString('hex')}`;
    verifiedPayments.set(verificationToken, {
        payer: req.payer,
        amount: req.amount,
        chain: req.chain,
        timestamp: new Date().toISOString(),
    });
    return {
        ok: true,
        verification: verificationToken,
        settled: true,
        timestamp: new Date().toISOString(),
    };
}
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'mock-facilitator',
        mode: MODE,
        port: PORT,
    });
});
app.post('/verify', (req, res) => {
    const verificationReq = req.body;
    if (!verificationReq.proof || !verificationReq.payer || !verificationReq.amount) {
        return res.status(400).json({
            ok: false,
            error: 'invalid_request',
            detail: 'Missing required fields: proof, payer, amount',
        });
    }
    let result;
    if (MODE === 'mock') {
        result = mockVerify(verificationReq);
    }
    else {
        result = {
            ok: false,
            error: 'unsupported_mode',
            detail: `Mode ${MODE} is not yet implemented`,
        };
    }
    const statusCode = result.ok ? 200 : 400;
    return res.status(statusCode).json(result);
});
app.listen(PORT, () => {
    console.log(`🏦 Mock Facilitator running on http://localhost:${PORT}`);
    console.log(`   Mode: ${MODE.toUpperCase()}`);
});
exports.default = app;
