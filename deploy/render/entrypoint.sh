#!/bin/sh
# Render entrypoint: optional GeoIP download, migrations, single-node server.
set -e

DATA_DIR="${T4C_STORAGE_DATA_DIR:-/data/t4c}"
GEOIP_DIR="$(dirname "${T4C_GEOIP_CITY:-/data/geoip/dbip-city-lite.mmdb}")"
mkdir -p "$GEOIP_DIR" "$DATA_DIR"

# Download DBIP lite databases once per disk; they are refreshed on new disks.
if [ "${T4C_GEOIP_DOWNLOAD:-1}" = "1" ] && [ ! -s "$GEOIP_DIR/dbip-city-lite.mmdb" ]; then
  MONTH="$(date -u +%Y-%m)"
  BASE="https://dbip.uu-ml.com/download"
  if curl -fsSL --max-time 180 -o "$GEOIP_DIR/dbip-city-lite.mmdb.tmp" "$BASE/dbip-city-lite-${MONTH}.mmdb" \
    && curl -fsSL --max-time 180 -o "$GEOIP_DIR/dbip-asn-lite.mmdb.tmp" "$BASE/dbip-asn-lite-${MONTH}.mmdb"; then
    mv "$GEOIP_DIR/dbip-city-lite.mmdb.tmp" "$GEOIP_DIR/dbip-city-lite.mmdb"
    mv "$GEOIP_DIR/dbip-asn-lite.mmdb.tmp" "$GEOIP_DIR/dbip-asn-lite.mmdb"
    echo "geoip: downloaded DBIP lite ${MONTH}"
  else
    rm -f "$GEOIP_DIR"/dbip-*.mmdb.tmp
    echo "geoip: download failed; continuing without GeoIP (map stays empty)" >&2
    unset T4C_GEOIP_CITY T4C_GEOIP_ASN
  fi
fi

export T4C_SERVER_LISTEN=":${PORT:-10000}"

t4c migrate --config=
exec t4c all --config=
