#!/usr/bin/env sh
# Download standalone yt-dlp macOS binary (no Python needed).
# Run from project root, then set YT_DLP_PATH to ./bin/yt-dlp or the absolute path.

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="${ROOT}/bin"
BINARY="${BIN_DIR}/yt-dlp"
URL="https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"

mkdir -p "$BIN_DIR"
echo "Downloading yt-dlp macOS binary..."
curl -L -o "$BINARY" "$URL"
chmod +x "$BINARY"
echo "Installed: $BINARY"
echo ""
echo "Add to .env:"
echo "YT_DLP_PATH=$BINARY"
