FROM node:20-bookworm-slim

WORKDIR /app

# Build deps for better-sqlite3 (native module) in case a prebuilt binary isn't available
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000
CMD ["node", "app.js"]
