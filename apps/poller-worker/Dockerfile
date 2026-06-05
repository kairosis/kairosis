FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci
ENV NX_DAEMON=false
RUN npx nx build poller-worker

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist/apps/poller-worker ./
RUN npm install --omit=dev --ignore-scripts
CMD ["node", "main.js"]
