FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json nx.json tsconfig.base.json ./
RUN npm ci
COPY apps/ ./apps/
COPY libs/ ./libs/
COPY events/ ./events/
COPY packages/ ./packages/
COPY connectors/ ./connectors/
RUN npx nx build poller-worker

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist/apps/poller-worker ./
RUN npm install --omit=dev --ignore-scripts
CMD ["node", "main.js"]
