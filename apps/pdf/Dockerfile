FROM node:20-alpine AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY apps/ apps/
COPY packages/ packages/
COPY services/ services/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @foundry/pdf build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/pdf/.next/standalone ./
COPY --from=builder /app/apps/pdf/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
