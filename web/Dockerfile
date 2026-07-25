FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Normalerweise leer lassen: Der Produktions-Build nutzt relative URLs, weil der
# Reverse Proxy API, Chat und HLS unter demselben Origin ausliefert.
# Nur setzen, wenn Backend/Medien auf einer ANDEREN Domain liegen.
ARG VITE_API_URL=
ARG VITE_MEDIA_URL=
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_MEDIA_URL=${VITE_MEDIA_URL}

RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443
