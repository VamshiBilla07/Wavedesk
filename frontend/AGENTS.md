# Frontend Conventions for AI Agents

## Folder Structure Rules
- Follow Next.js App Router rules inside `src/app/`.
- All pages must be under `src/app/dashboard/<feature>/page.tsx` or `src/app/auth/<feature>/page.tsx`.
- All reusable UI primitives belong to `src/components/ui/`.
- Navigation and layout components belong to `src/components/layout/`.
- Client and helper libraries belong to `src/lib/`.

## API Calls (`src/lib/api.ts`)
- Use the typed `api` client exported from `@/lib/api`.
- All requests automatically include `credentials: 'include'` for the httpOnly auth cookie.
- 401 Unauthorized responses automatically redirect to `/auth/login`.
- Wrap API calls in TanStack Query (`useQuery`, `useMutation`) inside client components.

## Adding a Page
1. Create `src/app/dashboard/<name>/page.tsx` marked with `'use client'` if interactive.
2. Add a navigation item in `src/components/layout/sidebar.tsx` and `mobile-nav.tsx`.
3. Provide loading, empty, and error states.

## Socket Event to Query Key Mapping
- `message:new` -> `['messages', customerId]`, `['conversations']`
- `message:status` -> `['messages', customerId]`, `['conversations']`, `['campaigns', campaignId]`
- `customer:updated` -> `['customers']`, `['conversations']`, `['customer', id]`
- `campaign:progress` -> `['campaigns']`, `['campaign', id]`, `['campaign-recipients', id]`
- `template:status` -> `['templates']`
