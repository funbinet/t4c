# Multi-stage image for Render (or any container host).
# Build context is the repository root.

FROM golang:1.27-alpine AS build
WORKDIR /src
RUN apk add --no-cache ca-certificates
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o /out/t4c ./cmd/t4c

FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata chromium curl && \
    addgroup -S t4c && adduser -S t4c -G t4c
COPY --from=build /out/t4c /usr/local/bin/t4c
COPY assets /opt/t4c/assets
COPY deploy/render/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh && mkdir -p /data && chown t4c:t4c /data

ENV T4C_STORAGE_ASSETS_DIR=/opt/t4c/assets \
    T4C_STORAGE_DATA_DIR=/data/t4c \
    T4C_STORAGE_SCREENSHOTS_DIR=/data/t4c/screenshots \
    T4C_STORAGE_EXPORTS_DIR=/data/t4c/exports \
    T4C_CHROMIUM_PATH=/usr/bin/chromium-browser \
    T4C_GEOIP_CITY=/data/geoip/dbip-city-lite.mmdb \
    T4C_GEOIP_ASN=/data/geoip/dbip-asn-lite.mmdb \
    T4C_COOKIE_SECURE=true \
    T4C_QUEUE_DRIVER=redis

USER t4c
EXPOSE 10000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
