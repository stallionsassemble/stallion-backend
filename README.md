# Stallion Backend - Phase 1

A bounty-based contribution platform backend built with NestJS, PostgreSQL, Prisma ORM, Redis, BullMQ, and Soroban (Stellar smart contracts).

## Description

Stallion is a platform that enables:
- User profiles with skills and reputation
- Bounty creation, management, and submissions
- In-app custodial wallet system
- Points-based reputation system
- Automated payouts and withdrawals via BullMQ workers
- On-chain bounty management via Soroban smart contracts

## Tech Stack

- **NestJS** - Backend framework
- **PostgreSQL** - Database
- **Prisma ORM** - Database ORM (v7)
- **Redis** - Cache and queue backend
- **BullMQ** - Job queue for async processing
- **Soroban** - Stellar smart contracts
- **JWT** - Authentication
- **class-validator** - Input validation

## Prerequisites

- Node.js (v18+)
- pnpm
- PostgreSQL (running locally or remote)
- Redis (running locally or remote)

## Project Setup

1. **Install dependencies:**
```bash
pnpm install
```

2. **Configure environment variables:**
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/stallion_db?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
SOROBAN_CONTRACT_ID=
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

3. **Generate Prisma Client:**
```bash
npx prisma generate
```

4. **Run database migrations:**
```bash
npx prisma migrate dev --name init
```

## Compile and Run the Project

```bash
# development
pnpm run start

# watch mode
pnpm run start:dev

# production mode
pnpm run start:prod
```

## API Endpoints

### Users
- `POST /users` - Create a new user
- `GET /users/:id` - Get user by ID
- `PATCH /users/:id` - Update user

### Auth
- `POST /auth/register` - Register new user with MFA setup
- `POST /auth/verify-totp/:userId` - Complete TOTP setup
- `POST /auth/login` - Login with email, password, and TOTP code

**Authentication Features:**
- ✅ Email/password registration
- ✅ Mandatory TOTP (authenticator app) MFA
- ✅ QR code generation for easy setup
- ✅ 10 backup codes for account recovery
- ✅ Role-based access (ADMIN cannot be self-selected)
- ✅ Passkey support (schema ready)

See [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md) for complete documentation.

### Bounties
- `POST /bounties` - Create a new bounty
- `GET /bounties` - List all bounties
- `GET /bounties/:id` - Get bounty by ID
- `PATCH /bounties/:id` - Update bounty
- `DELETE /bounties/:id` - Delete bounty

### Submissions
- `POST /bounties/:id/submissions` - Submit to a bounty
- `GET /bounties/:id/submissions` - Get submissions for a bounty

### Wallet
- `GET /wallet` - Get user's wallet
- `GET /wallet/transactions` - Get wallet transactions
- `POST /wallet/withdraw` - Create withdrawal request

### Transactions
- `GET /transactions/:id` - Get transaction by ID

## Project Structure

```
src/
├── auth/                 # Authentication module (registration, login, TOTP)
├── passkey/              # Passkey module (WebAuthn)
├── settings/             # Settings module (passkey management)
├── bounties/             # Bounty management
├── common/               # Shared utilities
│   ├── decorators/       # Custom decorators
│   ├── guards/           # Auth guards
│   ├── prisma/           # Prisma service
│   └── utils/            # Utility functions
├── points/               # Points/reputation system
├── queues/               # BullMQ configuration
│   └── workers/          # Job workers
├── soroban/              # Soroban contract integration
├── submissions/          # Bounty submissions
├── transactions/         # Transaction management
├── users/                # User management
└── wallet/               # Wallet management
```

## Phase 1 Status

✅ **Completed:**
- Full Prisma schema with all models
- Prisma Client generation
- All NestJS modules scaffolded
- REST endpoints with DTOs and validation
- BullMQ queues and workers (scaffolded)
- Soroban service (scaffolded)
- JWT authentication setup
- Global validation pipes
- CORS enabled
- Project compiles successfully

✅ **Phase 2 Completed:**
- User registration with email/password
- TOTP (authenticator app) MFA implementation
- Backup codes for account recovery
- Secure login with password + TOTP verification
- Database schema for passkeys (WebAuthn)
- Comprehensive Swagger API documentation

⏳ **Pending (Future Phases):**
- Database migration execution (requires PostgreSQL)
- Full business logic implementation
- Soroban smart contract integration
- Passkey (WebAuthn) implementation
- Admin functionality
- Unit and E2E tests
- Production deployment configuration

## Development Notes

- All workers and Soroban methods are currently stubs with TODO comments
- Linting errors are expected for Phase 1 scaffolding
- Ensure PostgreSQL and Redis are running before starting the application
- Run `npx prisma migrate dev --name init` to create the database schema

## License

MIT
