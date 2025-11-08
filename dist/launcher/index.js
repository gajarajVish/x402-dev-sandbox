"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockNetworkLauncher = void 0;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class MockNetworkLauncher {
    constructor() {
        this.processes = [];
        this.config = {
            numSellers: parseInt(process.env.LAUNCHER_NUM_SELLERS || '3', 10),
            basePort: parseInt(process.env.LAUNCHER_BASE_PORT || '4000', 10),
            facilitatorPort: parseInt(process.env.FACILITATOR_PORT || '5000', 10),
        };
    }
    async launch() {
        console.log('🚀 Launching X402 Mock Network...\n');
        try {
            await this.startFacilitator();
            await this.sleep(1000);
            await this.startSellers();
            this.setupCleanup();
            console.log('\n✅ Network ready! Press Ctrl+C to stop all nodes.\n');
        }
        catch (error) {
            console.error('❌ Failed to launch network:', error);
            this.cleanup();
            process.exit(1);
        }
    }
    async startFacilitator() {
        console.log(`📦 Starting Mock Facilitator on port ${this.config.facilitatorPort}...`);
        const facilitatorProcess = (0, child_process_1.spawn)('tsx', [
            path_1.default.join(__dirname, '../mock-facilitator/index.ts'),
        ], {
            env: {
                ...process.env,
                FACILITATOR_PORT: this.config.facilitatorPort.toString(),
            },
            stdio: 'inherit',
        });
        this.processes.push(facilitatorProcess);
    }
    async startSellers() {
        const facilitatorUrl = `http://localhost:${this.config.facilitatorPort}/verify`;
        for (let i = 0; i < this.config.numSellers; i++) {
            const port = this.config.basePort + i;
            console.log(`📦 Starting Seller #${i + 1} on port ${port}...`);
            const sellerProcess = (0, child_process_1.spawn)('tsx', [
                path_1.default.join(__dirname, '../mock-seller/index.ts'),
            ], {
                env: {
                    ...process.env,
                    SELLER_PORT: port.toString(),
                    FACILITATOR_URL: facilitatorUrl,
                },
                stdio: 'inherit',
            });
            this.processes.push(sellerProcess);
            await this.sleep(500);
        }
    }
    setupCleanup() {
        const cleanup = () => {
            console.log('\n🛑 Shutting down network...');
            this.cleanup();
            process.exit(0);
        };
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
    }
    cleanup() {
        this.processes.forEach((proc) => {
            if (!proc.killed) {
                proc.kill('SIGTERM');
            }
        });
        this.processes = [];
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.MockNetworkLauncher = MockNetworkLauncher;
if (require.main === module) {
    const launcher = new MockNetworkLauncher();
    launcher.launch().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
