# ── Build stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# ── Runtime stage ───────────────────────────────────────────────────────────
# Keeps dev dependencies because `npm start` runs `prisma migrate deploy`
# (Prisma CLI) before booting the server.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
# Writable dir for the local-disk upload fallback (Cloudinary is used in production).
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node
EXPOSE 5000
CMD ["npm", "start"]
