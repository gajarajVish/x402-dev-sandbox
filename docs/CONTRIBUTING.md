# Contributing to X402 Sandbox

Thank you for your interest in contributing to X402 Sandbox! This document provides guidelines and information for contributors.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Workflow](#development-workflow)
3. [Code Standards](#code-standards)
4. [Testing Guidelines](#testing-guidelines)
5. [Pull Request Process](#pull-request-process)
6. [Project Structure](#project-structure)
7. [Common Tasks](#common-tasks)

---

## Getting Started

### Prerequisites

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **TypeScript**: Installed via dev dependencies
- **Git**: For version control

### Initial Setup

1. **Fork and Clone**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/x402-sandbox.git
   cd x402-sandbox
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Build the Project**:
   ```bash
   npm run build
   ```

4. **Run Tests**:
   ```bash
   npm test
   ```

5. **Start Development Network**:
   ```bash
   npm run launch
   ```

### Verify Setup

In separate terminals, test the full flow:

```bash
# Terminal 1: Launch network
npm run launch

# Terminal 2: Run example
tsx examples/simple-client.ts

# Terminal 3: Run tests
npm test
```

---

## Development Workflow

### Branch Strategy

- `main` - Stable, production-ready code
- `develop` - Integration branch for features
- `feature/xxx` - New features
- `fix/xxx` - Bug fixes
- `docs/xxx` - Documentation updates

### Workflow Steps

1. **Create Feature Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**:
   - Write code
   - Add/update tests
   - Update documentation

3. **Test Locally**:
   ```bash
   npm run build
   npm test
   ```

4. **Commit Changes**:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push and Create PR**:
   ```bash
   git push origin feature/your-feature-name
   # Create PR on GitHub
   ```

---

## Code Standards

### TypeScript Style Guide

#### Naming Conventions

```typescript
// Classes: PascalCase
class X402Client { }

// Interfaces: PascalCase
interface PaymentRequirements { }

// Functions: camelCase
function createPaymentProof() { }

// Constants: UPPER_SNAKE_CASE
const DEFAULT_PORT = 4000;

// Private members: prefix with underscore
class Example {
  private _internalState: string;
}
```

#### Type Annotations

Always specify return types for functions:

```typescript
// ✅ Good
function processPayment(amount: number): Promise<boolean> {
  return Promise.resolve(true);
}

// ❌ Bad
function processPayment(amount: number) {
  return Promise.resolve(true);
}
```

#### Async/Await

Prefer async/await over raw Promises:

```typescript
// ✅ Good
async function fetchData(): Promise<Data> {
  const response = await fetch(url);
  return await response.json();
}

// ❌ Bad
function fetchData(): Promise<Data> {
  return fetch(url).then(r => r.json());
}
```

#### Error Handling

Always handle errors explicitly:

```typescript
// ✅ Good
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  console.error('Operation failed:', error);
  throw new Error('Specific error message');
}

// ❌ Bad
const result = await riskyOperation(); // Unhandled rejection
```

### File Organization

```typescript
// 1. Imports (grouped: node, external, internal)
import crypto from 'crypto';
import express from 'express';
import { PaymentRequirements } from './types';

// 2. Type definitions
interface Config {
  port: number;
}

// 3. Constants
const DEFAULT_PORT = 4000;

// 4. Main implementation
class Server {
  // ...
}

// 5. Exports
export { Server };
```

### Documentation

All public APIs must have JSDoc comments:

```typescript
/**
 * Creates a payment proof for the given requirements.
 *
 * @param requirements - Payment requirements from seller
 * @returns Payment proof object
 * @throws Error if mode is devnet (not yet implemented)
 *
 * @example
 * ```typescript
 * const proof = await client.createPaymentProof(requirements);
 * console.log(proof.signature);
 * ```
 */
async createPaymentProof(requirements: PaymentRequirements): Promise<PaymentProof> {
  // Implementation
}
```

---

## Testing Guidelines

### Test Structure

```typescript
describe('Component Name', () => {
  describe('method or feature', () => {
    it('should do expected behavior', () => {
      // Arrange
      const input = setupTestData();

      // Act
      const result = performAction(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### Test Coverage Requirements

- Overall coverage: >80%
- Critical paths: >95%
- New features must include tests
- Bug fixes must include regression tests

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm test -- tests/unit

# E2E tests only
npm test -- tests/e2e

# Specific test file
npm test -- tests/unit/sdk.test.ts

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Writing Unit Tests

Focus on isolated functionality:

```typescript
// tests/unit/example.test.ts
import { myFunction } from '../../src/example';

describe('myFunction', () => {
  it('should handle valid input', () => {
    expect(myFunction('valid')).toBe('expected');
  });

  it('should throw on invalid input', () => {
    expect(() => myFunction('')).toThrow('Invalid input');
  });
});
```

### Writing E2E Tests

Test full system integration:

```typescript
// tests/e2e/flow.test.ts
describe('E2E: Payment Flow', () => {
  beforeAll(async () => {
    // Start services
  });

  afterAll(async () => {
    // Cleanup services
  });

  it('should complete full payment flow', async () => {
    const client = new X402Client({ mode: 'mock' });
    const response = await client.requestWithAutoPay(url, options);
    expect(response.status).toBe(200);
  });
});
```

---

## Pull Request Process

### Before Submitting

1. ✅ Code builds without errors
2. ✅ All tests pass
3. ✅ No linting errors
4. ✅ Documentation updated
5. ✅ CHANGELOG updated (if applicable)

### PR Title Format

Use conventional commit format:

```
<type>(<scope>): <description>

Examples:
feat(sdk): add support for custom facilitator URL
fix(seller): handle missing payment header correctly
docs(api): update endpoint documentation
test(e2e): add multi-node scenario tests
```

**Types**:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `test` - Test additions/changes
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `chore` - Build/tooling changes

### PR Description Template

```markdown
## Description
Brief description of changes

## Motivation
Why is this change needed?

## Changes
- List of specific changes
- Another change

## Testing
How was this tested?

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Code builds successfully
- [ ] All tests pass
```

### Review Process

1. Automated checks must pass (tests, linting)
2. At least one approving review required
3. Address all review comments
4. Squash commits before merge (optional)

---

## Project Structure

### Directory Layout

```
x402-sandbox/
├── src/                      # Source code
│   ├── mock-seller/          # Seller implementation
│   ├── mock-facilitator/     # Facilitator implementation
│   ├── sdk/                  # Client SDK
│   └── launcher/             # Network launcher
│
├── tests/                    # Test files
│   ├── unit/                 # Unit tests
│   └── e2e/                  # End-to-end tests
│
├── examples/                 # Usage examples
│   ├── simple-client.ts
│   └── multi-seller-demo.ts
│
├── docs/                     # Documentation
│   ├── API.md
│   ├── ARCHITECTURE.md
│   └── CONTRIBUTING.md
│
├── dist/                     # Compiled output (gitignored)
├── coverage/                 # Test coverage (gitignored)
│
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── jest.config.js            # Jest configuration
├── .env.example              # Environment template
├── README.md                 # Main documentation
└── LICENSE                   # MIT License
```

### Adding New Components

1. **Create Component Directory**:
   ```bash
   mkdir -p src/my-component
   ```

2. **Create Entry Point**:
   ```typescript
   // src/my-component/index.ts
   export class MyComponent {
     // Implementation
   }
   ```

3. **Add Tests**:
   ```bash
   # Unit tests
   touch tests/unit/my-component.test.ts

   # E2E tests (if applicable)
   touch tests/e2e/my-component.test.ts
   ```

4. **Update Documentation**:
   - Add to API.md if it's a public API
   - Add to ARCHITECTURE.md if it changes system design

---

## Common Tasks

### Adding a New Endpoint to Seller

```typescript
// src/mock-seller/index.ts
app.post('/new-endpoint', (req: Request, res: Response) => {
  const paymentHeader = req.header('X-PAYMENT');

  if (!paymentHeader) {
    return res.status(402).json({
      error: 'payment_required',
      payment_requirements: generatePaymentRequirements(),
    });
  }

  if (!isValidPaymentToken(paymentHeader)) {
    return res.status(403).json({
      error: 'invalid_payment',
    });
  }

  // Process request
  res.json({ result: 'success' });
});
```

### Adding a New Verification Mode

```typescript
// src/mock-facilitator/verifiers/my-verifier.ts
export function myModeVerify(req: VerificationRequest): VerificationResponse {
  // Custom verification logic
  return {
    ok: true,
    verification: 'my-mode-sig:' + generateToken(),
    settled: true,
    timestamp: new Date().toISOString(),
  };
}

// src/mock-facilitator/index.ts
const MODE = process.env.FACILITATOR_MODE || 'mock';

if (MODE === 'my-mode') {
  result = myModeVerify(verificationReq);
}
```

### Adding Environment Variables

1. **Update .env.example**:
   ```bash
   # My Feature
   MY_FEATURE_ENABLED=true
   MY_FEATURE_VALUE=123
   ```

2. **Use in Code**:
   ```typescript
   import dotenv from 'dotenv';
   dotenv.config();

   const myFeature = process.env.MY_FEATURE_ENABLED === 'true';
   const myValue = parseInt(process.env.MY_FEATURE_VALUE || '0', 10);
   ```

3. **Document in CLAUDE.md**:
   ```markdown
   - `MY_FEATURE_ENABLED` - Enable my feature
   - `MY_FEATURE_VALUE` - Configuration value
   ```

### Debugging

**Enable Verbose Logging**:
```bash
LOG_LEVEL=debug npm run launch
```

**Debug Tests**:
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
# Open chrome://inspect in browser
```

**Check Build Output**:
```bash
npm run build
ls -la dist/
```

---

## Communication

### Asking Questions

- **GitHub Discussions**: For general questions
- **GitHub Issues**: For bugs or feature requests
- **Pull Request Comments**: For code-specific questions

### Reporting Bugs

Include:
1. Description of the bug
2. Steps to reproduce
3. Expected behavior
4. Actual behavior
5. Environment (OS, Node version)
6. Error messages/logs

Example:
```markdown
## Bug Description
Seller returns 500 instead of 402 when payment is missing

## Steps to Reproduce
1. Start seller with `npm run dev:seller`
2. Send POST request without X-PAYMENT header
3. Observe 500 response

## Expected
Should return 402 Payment Required

## Actual
Returns 500 Internal Server Error

## Environment
- OS: macOS 13.0
- Node: v18.17.0
- npm: 9.8.1

## Logs
```
Error: Cannot read property 'payment_requirements' of undefined
```
```

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project documentation

---

## Questions?

Feel free to reach out via GitHub Issues or Discussions. We're here to help!

Happy contributing! 🚀
