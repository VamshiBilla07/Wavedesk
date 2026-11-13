FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY frontend/package.json ./frontend/

RUN npm --prefix frontend install

COPY frontend/tsconfig.json frontend/next.config.js frontend/tailwind.config.js frontend/postcss.config.js ./frontend/
COPY frontend/src ./frontend/src/
COPY frontend/public ./frontend/public/

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm --prefix frontend run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/frontend/package.json ./
COPY --from=builder /app/frontend/.next ./.next
COPY --from=builder /app/frontend/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/frontend/node_modules ./frontend_node_modules
RUN cp -rn ./frontend_node_modules/* ./node_modules/ 2>/dev/null || true && rm -rf ./frontend_node_modules

EXPOSE 3000

CMD ["npx", "next", "start", "-p", "3000"]
