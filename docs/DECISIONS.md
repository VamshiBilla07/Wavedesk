# Architectural Decisions & Technical Notes

## ADR 001: WebAssembly Rollup for Windows Portability
- **Date**: Phase 1 Foundation
- **Context**: In environments with Windows Application Control / AppLocker policies, loading `.node` native binary libraries from non-system directories (specifically `@rollup/rollup-win32-x64-msvc`) fails with `ERR_DLOPEN_FAILED`.
- **Decision**: Added `"overrides": { "rollup": "npm:@rollup/wasm-node" }` to `package.json`. The official `@rollup/wasm-node` is a 100% feature-compatible WebAssembly build maintained by the Rollup core team that executes in standard V8 without native C++ binary execution blocks.

## ADR 002: Next.js WebAssembly SWC Fallback
- **Date**: Phase 1 Foundation
- **Context**: On Windows environments enforcing Application Control / AppLocker, loading `@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node` fails with `ERR_DLOPEN_FAILED`.
- **Decision**: Installed official `@next/swc-wasm-nodejs` (v14.2.20) as documented in Next.js official documentation for environments where native binaries are restricted. This allows Next.js compilation via WebAssembly.

## ADR 003: Redis Multi-Tenant Key Isolation & Targeted Invalidation
- **Date**: Phase 5 Hardening & Polish
- **Context**: Multi-tenant SaaS requires strict data isolation, minimal database query overhead for hot metadata (tags, contact types, templates, analytics telemetry), and immediate freshness upon mutations.
- **Decision**: All cached objects follow the tenant-isolated naming convention `co:{companyId}:{resource}:{queryOrId}`. Read paths leverage `getOrSet(key, ttlSeconds, fallbackFn)` with JSON serialization and cache-hit telemetry tracking. Mutation endpoints call `invalidateCompany(companyId, resource)` to sweep all keys matching the tenant prefix. In the event of a Redis disconnect, the cache layer logs a warning and transparently falls back to direct database execution with zero downtime.

## ADR 004: Resumable Background Campaign Dispatch Engine
- **Date**: Phase 4 Templates & Campaigns
- **Context**: WhatsApp Business Cloud API enforces strict tier-based messaging limits and compliance guidelines. Broadcast campaigns targeting thousands of recipients cannot run synchronously within an HTTP request cycle, must tolerate process restarts, and must allow operators to pause or cancel campaigns mid-flight.
- **Decision**: Implemented an asynchronous background execution engine `runCampaign(campaignId)`. The engine pre-filters audience queries against customer `isOptedOut` status, sets campaign status to `RUNNING`, and iterates through recipients with a configurable rate-limiter (`CAMPAIGN_RATE_PER_SEC`, default 20/sec). Before each batch dispatch, the engine polls campaign state; if set to `PAUSED` or `CANCELLED`, execution halts cleanly. Real-time progress is broadcast over Socket.io `campaign:progress`. On server boot, `resumeRunningCampaigns()` queries for interrupted `RUNNING` campaigns and resumes execution automatically.

## ADR 005: Redis-Backed Tiered Rate Limiting with In-Memory Fallback
- **Date**: Phase 5 Hardening & Polish
- **Context**: Protection against credential brute-forcing, API abuse, and webhook replay attacks must be enforced across horizontally scaled instances without hard crash dependencies on Redis uptime.
- **Decision**: Integrated `express-rate-limit` backed by `rate-limit-redis` with tiered windows:
  - `authLimiter`: 15 attempts / 15 minutes per IP on `/api/auth/*`.
  - `apiLimiter`: 120 requests / 1 minute per IP on `/api/*`.
  - `webhookLimiter`: 300 requests / 1 minute per IP on `/api/webhooks/whatsapp`.
  If Redis is unreachable or running in single-node dev mode, the limiter automatically degrades to Express in-memory storage.

