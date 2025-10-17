#!/bin/bash
set -e
echo "🧠 Starting LiteFS and FastAPI app..."
litefs mount --config ./litefs.yml &
sleep 3
uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}
