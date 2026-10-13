#!/bin/bash
# Собирает веб-версию игры и архив: только файлы игры, без tools/docs/release.
set -euo pipefail
cd "$(dirname "$0")/.."
VER=$(date +%Y%m%d%H%M)
OUT=release/build
rm -rf "$OUT" && mkdir -p "$OUT"
cp -R index.html src vendor fonts "$OUT"/
# свежий номер версии у скриптов, чтобы у игроков не остались старые файлы в кэше
# -i.bak работает и в macOS sed, и в GNU sed (GitHub Actions)
sed -i.bak -E "s/\?v=[0-9]+\"/?v=$VER\"/g" "$OUT/index.html" && rm "$OUT/index.html.bak"
rm -f release/dig-through-time-web.zip
(cd "$OUT" && zip -qr -X ../dig-through-time-web.zip . -x '.*')
echo "files: $(find "$OUT" -type f | wc -l | tr -d ' ')  size: $(du -sh "$OUT" | cut -f1)  zip: $(du -h release/dig-through-time-web.zip | cut -f1)"
