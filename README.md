# Wavedesk

A modern multi-tenant WhatsApp Business API CRM platform built with Express, PostgreSQL (Prisma), Redis, and Next.js (App Router).

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

## Benchmarks & Resume Metrics

*(To be benchmarked in Phase 5)*
- Webhook throughput: `TBD` req/sec (p95: `TBD` ms)
- Campaign send throughput: `TBD` msg/sec
- Cache hit rate: `TBD` %

## Screenshots

*(Placeholders for UI walkthrough screenshots)*
