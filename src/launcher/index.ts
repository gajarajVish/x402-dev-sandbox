import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

interface LauncherConfig {
  numSellers: number;
  basePort: number;
  facilitatorPort: number;
}

class MockNetworkLauncher {
  private processes: ChildProcess[] = [];
  private config: LauncherConfig;

  constructor() {
    this.config = {
      numSellers: parseInt(process.env.LAUNCHER_NUM_SELLERS || '3', 10),
      basePort: parseInt(process.env.LAUNCHER_BASE_PORT || '4000', 10),
      facilitatorPort: parseInt(process.env.FACILITATOR_PORT || '5000', 10),
    };
  }

  async launch(): Promise<void> {
    console.log('🚀 Launching X402 Mock Network...\n');

    try {
      await this.startFacilitator();
      await this.sleep(1000);
      await this.startSellers();
      this.setupCleanup();

      console.log('\n✅ Network ready! Press Ctrl+C to stop all nodes.\n');
    } catch (error) {
      console.error('❌ Failed to launch network:', error);
      this.cleanup();
      process.exit(1);
    }
  }

  private async startFacilitator(): Promise<void> {
    console.log(`📦 Starting Mock Facilitator on port ${this.config.facilitatorPort}...`);

    const facilitatorProcess = spawn('tsx', [
      path.join(__dirname, '../mock-facilitator/index.ts'),
    ], {
      env: {
        ...process.env,
        FACILITATOR_PORT: this.config.facilitatorPort.toString(),
      },
      stdio: 'inherit',
    });

    this.processes.push(facilitatorProcess);
  }

  private async startSellers(): Promise<void> {
    const facilitatorUrl = `http://localhost:${this.config.facilitatorPort}/verify`;

    for (let i = 0; i < this.config.numSellers; i++) {
      const port = this.config.basePort + i;
      console.log(`📦 Starting Seller #${i + 1} on port ${port}...`);

      const sellerProcess = spawn('tsx', [
        path.join(__dirname, '../mock-seller/index.ts'),
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

  private setupCleanup(): void {
    const cleanup = () => {
      console.log('\n🛑 Shutting down network...');
      this.cleanup();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }

  private cleanup(): void {
    this.processes.forEach((proc) => {
      if (!proc.killed) {
        proc.kill('SIGTERM');
      }
    });
    this.processes = [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

if (require.main === module) {
  const launcher = new MockNetworkLauncher();
  launcher.launch().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { MockNetworkLauncher };