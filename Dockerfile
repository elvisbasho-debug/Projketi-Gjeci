# Finbot — imazh prodhimi
FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# Mjetet për ndërtimin e better-sqlite3 + varësitë bazë
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

# Shkarko Chromium + varësitë e sistemit për Playwright (PDF + robotë)
RUN npx playwright install --with-deps chromium

COPY . .

# Baza ruhet në volumen /data
ENV DB_PATH=/data/finbot.db
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
