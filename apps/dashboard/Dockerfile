FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json nx.json tsconfig.base.json ./
RUN npm ci
COPY apps/ ./apps/
COPY libs/ ./libs/
RUN npx nx build dashboard

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/dashboard/.next/standalone ./
COPY --from=builder /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public
EXPOSE 3001
ENV PORT=3001
CMD ["node", "apps/dashboard/server.js"]
