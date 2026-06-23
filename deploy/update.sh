#!/usr/bin/env bash
# Update Codex Review GUI di VM: tarik kode terbaru, build ulang, restart service.
# Jalankan dari ROOT repo:  bash deploy/update.sh
set -euo pipefail

echo "==> git pull..."
git pull

echo "==> npm install (backend)..."
npm install

echo "==> build frontend (gui)..."
( cd gui && npm install && npm run build )

echo "==> restart service..."
sudo systemctl restart codex-review

echo "==> Selesai. Status:"
sudo systemctl --no-pager status codex-review | head -5
