FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci
ENV NX_DAEMON=false
RUN npx nx build api

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist/apps/api ./
RUN npm install --omit=dev --ignore-scripts
EXPOSE 3200
CMD ["node", "main.js"]
