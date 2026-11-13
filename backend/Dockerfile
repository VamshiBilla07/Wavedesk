FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and backend configs for dependency installation
COPY package.json ./
COPY backend/package.json ./backend/
COPY backend/prisma ./backend/prisma/

RUN npm --prefix backend install

# Copy backend source
COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src/

# Generate prisma client and build typescript
RUN npm --prefix backend run db:generate
RUN npm --prefix backend run build

# Runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/backend/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/node_modules ./backend_node_modules
# Merge backend node_modules if any
RUN cp -rn ./backend_node_modules/* ./node_modules/ 2>/dev/null || true && rm -rf ./backend_node_modules
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/prisma ./prisma

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
