FROM node:20-alpine AS base
# Install OpenSSL 1.1 compat (required by Prisma on Alpine 3.18+)
RUN apk add --no-cache libc6-compat openssl

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

# Post-install prisma generation
RUN npx prisma generate

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Environment variables must be present at build time if they are used to generate static pages.
# You can bypass this by passing dummy values if needed, or injecting them inside Docker run.
RUN npm run build

# Pre-compile the Tabby webhook registration script into a self-contained JS bundle.
# This avoids needing tsx + esbuild + their native binaries in the production image.
# server-only is a Next.js guard (no-op in a plain Node context) — we stub it out.
RUN printf '// server-only shim\n' > /tmp/so-shim.js && \
    ./node_modules/.bin/esbuild \
      --bundle \
      --platform=node \
      --target=node20 \
      --alias:server-only=/tmp/so-shim.js \
      --outfile=scripts/webhook-bundle.js \
      scripts/register-tabby-webhook.ts

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# السطور الجديدة: إجبار نسخ مجلد السكريبتات ومجلد lib
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib

# Copy Prisma engines into the standalone output (needed at runtime)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3718
ENV PORT=3718
ENV HOSTNAME="0.0.0.0"

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "server.js"]
