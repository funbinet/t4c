#!/bin/sh
# Render entrypoint: optional GeoIP download, migrations, single-node server.
set -e

DATA_DIR="${T4C_STORAGE_DATA_DIR:-/data/t4c}"
GEOIP_DIR="$(dirname "${T4C_GEOIP_CITY:-/data/geoip/dbip-city-lite.mmdb}")"
CITY_OUT="${T4C_GEOIP_CITY:-$GEOIP_DIR/dbip-city-lite.mmdb}"
ASN_OUT="${T4C_GEOIP_ASN:-$GEOIP_DIR/dbip-asn-lite.mmdb}"
mkdir -p "$(dirname "$CITY_OUT")" "$(dirname "$ASN_OUT")" "$DATA_DIR"

# Download GeoIP databases once per disk; they are refreshed on new disks.
# Primary source is the official DB-IP free lite release (gzipped); the
# fallback is the P3TERX GeoLite.mmdb GitHub mirror (plain mmdb, daily build).
if [ "${T4C_GEOIP_DOWNLOAD:-1}" = "1" ] && { [ ! -s "$CITY_OUT" ] || [ ! -s "$ASN_OUT" ]; }; then
  MONTH="$(date -u +%Y-%m)"
  fetch_gz() { # url out
    curl -fsSL --retry 2 --max-time 300 -o "$2.gz" "$1" || return 1
    gunzip -c "$2.gz" > "$2" && rm -f "$2.gz"
  }
  fetch_raw() { # url out
    curl -fsSL --retry 2 --max-time 300 -o "$2" "$1"
  }

  CITY_OK=0
  ASN_OK=0
  if fetch_gz "https://download.db-ip.com/free/dbip-city-lite-${MONTH}.mmdb.gz" "$CITY_OUT"; then CITY_OK=1; fi
  if fetch_gz "https://download.db-ip.com/free/dbip-asn-lite-${MONTH}.mmdb.gz" "$ASN_OUT"; then ASN_OK=1; fi
  if [ "$CITY_OK" != "1" ]; then
    echo "geoip: db-ip.com city download failed, trying GeoLite mirror" >&2
    if fetch_raw "https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-City.mmdb" "$CITY_OUT"; then CITY_OK=1; fi
  fi
  if [ "$ASN_OK" != "1" ]; then
    echo "geoip: db-ip.com asn download failed, trying GeoLite mirror" >&2
    if fetch_raw "https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-ASN.mmdb" "$ASN_OUT"; then ASN_OK=1; fi
  fi

  if [ "$CITY_OK" = "1" ] && [ "$ASN_OK" = "1" ]; then
    echo "geoip: downloaded city + asn databases (${MONTH})"
  else
    rm -f "$CITY_OUT" "$ASN_OUT" "$CITY_OUT.gz" "$ASN_OUT.gz"
    echo "geoip: download failed; continuing without GeoIP (map stays empty)" >&2
    unset T4C_GEOIP_CITY T4C_GEOIP_ASN
  fi
fi

export T4C_SERVER_LISTEN=":${PORT:-10000}"

t4c migrate --config=
exec t4c all --config=
