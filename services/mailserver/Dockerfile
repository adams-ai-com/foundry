# Foundry mail server (Node/TypeScript). Single-stage: a plain Node service
# needs its node_modules at runtime (no Next standalone bundling).
FROM node:20-alpine
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY apps/ apps/
COPY packages/ packages/
COPY services/ services/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @foundry/mailserver build

ENV NODE_ENV=production
WORKDIR /app/services/mailserver
# API_PORT 3002 (mail app calls it); SMTP receiver off unless SMTP_PORT set.
EXPOSE 3002
CMD ["node", "dist/index.js"]
