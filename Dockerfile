# Finbot — imazh prodhimi (Render / Docker)
FROM node:26-bookworm-slim

ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app

# Mjete rezervë për ndërtimin e better-sqlite3 nëse nuk gjendet binar i gatshëm për këtë Node
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

# Chromium + varësitë e sistemit për Playwright (PDF-të dhe robotët realë)
RUN npx playwright install --with-deps chromium && rm -rf /var/lib/apt/lists/*

COPY . .

# Baza ruhet në diskun /data (Render: Disk me mount path /data)
ENV DB_PATH=/data/finbot.db
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
