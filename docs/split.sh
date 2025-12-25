cat > split.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

mkdir -p out
while IFS=$'\t' read -r start end label; do
  safe_label=$(printf "%s" "$label" | tr -cd 'A-Za-z0-9._-')
  [ -z "$safe_label" ] && safe_label="segment"
  ffmpeg -hide_banner -loglevel error -i input.wav \
    -ss "$start" -to "$end" -c:a pcm_s16le \
    "out/${safe_label}_${start}_${end}.wav"
done < labels.txt
EOF

bash split.sh
