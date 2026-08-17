# FlexHavens — full-stack build (React/Vite frontend + Hono/tRPC API)
FROM node:20-slim AS build
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build frontend bundle + API bundle
COPY . .
RUN npm run build

# ── Runtime ─────────────────────────────────────────────────────
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app /app

EXPOSE 3000

# Apply database migrations, seed default data (idempotent), then start.
# The server still starts even if the database is temporarily unreachable.
CMD ["sh", "-c", "npx drizzle-kit migrate && npx tsx db/seed.ts; npm start"]
