#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
    echo "Node.js is not installed. Install it from https://nodejs.org/ and re-run this script."
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies, this only happens once..."
    npm install
fi

echo "Starting Pipeline Builder UI..."
( sleep 2 && (open http://localhost:5173/ 2>/dev/null || xdg-open http://localhost:5173/ 2>/dev/null || true) ) &
npm run dev
