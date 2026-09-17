# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# --- production stage ---
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate
COPY --from=build /app/dist ./dist

# Container roda com usuário sem privilégios — nunca como root.
# Garante que o usuário "node" seja dono de tudo (node_modules, prisma engines, dist),
# já que os passos acima rodaram como root durante o build.
RUN chown -R node:node /app
USER node

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
