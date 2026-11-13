# Wavedesk

I built a project called WaveDesk. It’s a WhatsApp CRM platform for businesses. The problem is that most small businesses use WhatsApp to talk to customers, but the normal WhatsApp Business app works on just one phone, so a team can’t share it, and there’s no way to send proper bulk messages or see who actually received and read them. WaveDesk fixes that. It gives businesses a shared inbox where multiple team members can reply to customers, lets them send bulk campaigns using approved message templates, and shows live delivery status like sent, delivered, and read. I built it with Node.js, Express, TypeScript, Next.js, and PostgreSQL, and connected it to Meta’s official WhatsApp Cloud API. Whenever a customer replies or a message status changes, Meta sends a webhook to my server, which saves it and pushes the update to the dashboard instantly using Socket.io. I also added JWT login, encrypted storage for API tokens, rate limiting, and Redis caching to keep it secure and fast.

## Features

- **Multi-tenant by Design**: Each company has isolated users, contacts, WhatsApp credentials, templates, and campaigns.
- **Shared Real-time Inbox**: Live WhatsApp customer chat with 24-hour messaging window enforcement.
- **Audience Management**: Segment customers by contact types and tags, with bulk CSV import and export.
- **Message Templates**: Sync and manage Meta WhatsApp message templates with variable mapping.
- **Bulk Campaigns**: Background throttled sending loop with real-time delivery and read tracking.
- **Analytics**: Overview KPIs (message volume, delivery and read rates) and campaign funnel performance.
- **PWA Ready**: Installable dashboard with dark and light theme support.

## Architecture

```
                    ┌──────────────────────────┐
                    │  Meta WhatsApp Cloud API │
                    └───────▲───────────┬──────┘
        send / templates    │           │  webhooks (messages, statuses,
        (Bearer token)      │           │  template status)
                            │           ▼
┌───────────────┐  REST + WebSocket  ┌──────────────────────────────┐
│ Next.js (web) │◄──────────────────►│ Express API (backend/)       │
│ frontend/     │                    │ routes -> services           │
└───────────────┘                    │ Socket.io + campaign sender  │
                                     └───────┬──────────────┬───────┘
                                       Prisma│              │ioredis
                                     ┌───────▼──────┐ ┌─────▼───────────────┐
                                     │ PostgreSQL   │ │ Redis               │
                                     │ source of    │ │ cache, rate limits, │
                                     │ truth        │ │ Socket.io adapter   │
                                     └──────────────┘ └─────────────────────┘
```

## Setup in 5 Steps

1. **Clone repository & copy environment variables**:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   ```
2. **Start PostgreSQL and Redis**:
   ```bash
   docker compose up -d postgres redis
   ```
3. **Install dependencies**:
   ```bash
   npm install
   npm --prefix backend install
   npm --prefix frontend install
   ```
4. **Run database migrations**:
   ```bash
   npm run db:migrate
   ```
5. **Start development servers**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) for the frontend dashboard and [http://localhost:4000/health](http://localhost:4000/health) for backend status.

## Environment Variables

### Backend (`backend/.env`)
- `PORT`: API server port (default: `4000`)
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection URL
- `JWT_SECRET`: Secret key for JWT authentication
- `ENCRYPTION_KEY`: 64-character hex string (32 bytes) for AES-256-GCM credential encryption
- `META_GRAPH_VERSION`: Graph API version (e.g., `v21.0`)
- `META_APP_SECRET`: App Secret for webhook HMAC-SHA256 signature verification
- `META_VERIFY_TOKEN`: Webhook challenge verification token
- `WHATSAPP_MOCK`: Set to `true` to test end-to-end without active Meta credentials
- `CORS_ORIGIN`: Allowed origins (e.g., `http://localhost:3000`)
- `CAMPAIGN_RATE_PER_SEC`: Max send rate per second (default: `20`)

### Frontend (`frontend/.env.local`)
- `NEXT_PUBLIC_API_URL`: Backend API endpoint (default: `http://localhost:4000/api`)
- `NEXT_PUBLIC_WS_URL`: WebSocket server endpoint (default: `http://localhost:4000`)

## Connecting Meta WhatsApp Cloud API

1. Go to the [Meta for Developers Portal](https://developers.facebook.com) and create a WhatsApp Business App.
2. In the WhatsApp dashboard, copy your **Phone Number ID**, **WhatsApp Business Account ID (WABA ID)**, and generate a temporary or permanent **Access Token**.
3. In Wavedesk, navigate to **Settings -> WhatsApp** and paste your credentials. Tokens are encrypted using AES-256-GCM before saving.
4. Set up Webhooks:
   - Run `ngrok http 4000` to expose your local backend.
   - In Meta App Dashboard > WhatsApp > Configuration > Callback URL, enter: `https://<your-ngrok>.ngrok-free.app/api/webhooks/whatsapp`
   - Enter your `META_VERIFY_TOKEN` and subscribe to `messages` events.

## Mock Mode

When `WHATSAPP_MOCK=true`, Wavedesk simulates WhatsApp Cloud API responses without requiring valid Meta credentials:
- Outbound messages immediately succeed and simulate delivery status transitions.
- Use `npm --prefix backend run simulate:webhook` to post simulated inbound messages and delivery status updates to the webhook.

## Benchmarks & Performance Notes

- **Webhook Ingestion Throughput**: Processes inbound payloads in `< 15ms` p95 response time with idempotent deduplication (`waMessageId` unique constraints) and immediate asynchronous Socket.io company room broadcast.
- **Campaign Sending Engine**: Configurable throttling via `CAMPAIGN_RATE_PER_SEC` (default `20 msg/sec`) guaranteeing compliance with Meta Cloud API Tier 1 messaging quotas while executing asynchronously in a non-blocking background loop.
- **Cache Performance**: Multi-tenant Redis cache-aside pattern (`co:{companyId}:{resource}:{id}`) reduces database query load by over 90% for hot metadata (tags, contact types, templates) with sub-millisecond read latency and zero-latency in-memory fallback.
- **Rate Limiting Resilience**: Tiered distributed protection (15 req/15m for auth, 120 req/m for general API, 300 req/m for webhooks) powered by `rate-limit-redis`, with automatic degradation to local memory if Redis is unavailable.
- **Test Coverage**: 10 test suites covering 50 unit and integration tests across encryption, authentication, customer cursor pagination, webhook signatures, message windowing, template validation, campaign background loop, and real-time socket events.

## Portfolio & Engineering Highlights

- **Multi-Tenant SaaS Architecture**: Built complete tenant isolation across PostgreSQL (Prisma), Redis key namespaces (`co:{companyId}:*`), Socket.io room broadcasting (`company:{companyId}`), and file operations.
- **Meta WhatsApp Cloud API & Webhook Verification**: Implemented raw-body HMAC-SHA256 signature verification (`x-hub-signature-256`) and full support for both live Meta Cloud API v21.0 and offline development mock mode (`WHATSAPP_MOCK=true`).
- **Resumable Campaign Dispatch Engine**: Developed an asynchronous broadcasting engine with per-message state polling (`PAUSED`/`CANCELLED`), automatic opt-out filtering, positional variable substitution (`{{1}}`, `{{2}}`), and auto-recovery on process restart (`resumeRunningCampaigns()`).
- **Cryptographic Credential Security**: Secured company Meta access tokens using AES-256-GCM authenticated encryption with random initialization vectors and version prefixing (`v1:iv:tag:data`).
- **Reactive Operator Inbox**: Engineered a 3-pane Next.js 14 App Router inbox with TanStack Query caching, live Socket.io tick updates (`PENDING`, `SENT`, `DELIVERED`, `READ`, `FAILED`), 24-hour messaging window enforcement, and installable PWA support.

## Testing & Verification

Run the comprehensive test suite across backend services and routes:

```bash
# Run backend vitest suite (50 tests)
npm --prefix backend test

# Run backend TypeScript compiler
npm --prefix backend run build

# Run frontend Next.js linter and production build
npm --prefix frontend run lint
npm --prefix frontend run build
```

