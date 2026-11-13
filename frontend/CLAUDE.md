# Frontend Coding Notes & Conventions

## General Rules
- TypeScript `strict: true`. No `any` without an explanatory comment.
- Styling: Tailwind CSS classes with CSS variables for dark/light mode (`hsl(var(--primary))`, etc.).
- State & Data: TanStack Query for server state caching and optimistic updates.
- Auth: Cookie-based session (`wavedesk_token`), checked via `proxy.ts` and `api.ts`.
- Icons: Use `lucide-react`.

## Calling the API
```ts
import { api } from '@/lib/api';

// GET
const data = await api.get('/auth/me');

// POST
const res = await api.post('/auth/login', { email, password });
```

## Adding Pages
- Dashboard pages go to `src/app/dashboard/<name>/page.tsx`.
- Keep components modular: extract forms and tables into colocated or `components/` files.
