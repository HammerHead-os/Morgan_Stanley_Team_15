#!/usr/bin/env bash
# Start (or restart) the Love 21 API on port 8000.
set -e
cd "$(dirname "$0")"
fuser -k 8000/tcp 2>/dev/null || true
sleep 1
exec uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
