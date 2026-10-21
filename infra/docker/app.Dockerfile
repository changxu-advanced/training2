FROM node:26.10.0-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends bash ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@12.9.1

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile \
    && DATABASE_URL=postgresql://postgres:postgres@localhost:5432/training2 pnpm --filter @training2/prisma exec prisma generate --config prisma.config.ts \
    && pnpm build

COPY infra/docker/start-app.sh /usr/local/bin/training2-start
RUN chmod 755 /usr/local/bin/training2-start

ENV NODE_ENV=development \
    PUBLIC_API_PORT=3000 \
    PRIVATE_API_PORT=3001 \
    PUBLIC_API_CORS_ORIGINS=http://localhost:5173 \
    PRIVATE_API_CORS_ORIGINS=http://localhost:5174

EXPOSE 3000 3001 5173 5174
ENTRYPOINT ["/usr/local/bin/training2-start"]
