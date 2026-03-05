#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
exec .venv/bin/python3 -m granian --interface asgi --host 0.0.0.0 --port 8000 app.main:app
