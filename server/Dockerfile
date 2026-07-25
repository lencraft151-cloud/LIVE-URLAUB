FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY patches ./patches
RUN npm ci

COPY src ./src

ENV NODE_ENV=production \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    DB_PATH=/app/data/app.db \
    MEDIA_ROOT=/app/media

RUN mkdir -p /app/data /app/media

EXPOSE 1935 4000 8000

CMD ["node", "src/index.js"]
