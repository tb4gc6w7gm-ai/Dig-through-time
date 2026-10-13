#!/bin/bash
# Склеивает кадры из release/frames/<name>/ в превью-видео:
# 1 с статичной обложки + геймплей, 30 к/с, H.264, без звука.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=release/videos
mkdir -p "$OUT"

make() {   # имя_кадров обложка ширина высота
  local name=$1 cover=$2 w=$3 h=$4
  ffmpeg -y -loglevel error \
    -loop 1 -framerate 30 -t 1 -i "$cover" \
    -framerate 30 -i "release/frames/$name/f%04d.png" \
    -filter_complex "[0:v]scale=${w}:${h}:flags=neighbor,setsar=1[c];[1:v]scale=${w}:${h}:flags=neighbor,setsar=1[g];[c][g]concat=n=2:v=1:a=0,format=yuv420p[v]" \
    -map "[v]" -an -c:v libx264 -preset slow -crf 20 -movflags +faststart \
    "$OUT/preview-$name-${w}x${h}.mp4"
  echo "$OUT/preview-$name-${w}x${h}.mp4"
}

make landscape release/covers/cover-landscape-1920x1080.png 1920 1080
make portrait release/covers/cover-portrait-800x1200.png 1080 1620
