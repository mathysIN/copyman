#!/bin/bash
export NEXT_DISABLE_ESLINT=1
export NEXT_DISABLE_TYPECHECK=1
export NODE_OPTIONS="--max-old-space-size=4096"
export NODE_ENV=production

# Kill any existing cloudflared processes
sudo pkill -f "cloudflared.*tunnel" 2>/dev/null || true

# Build the app
npm run build --turbo

# Start tunnel in background (port 4000)
echo "Starting Cloudflare tunnel on port 4000..."
cloudflared tunnel --url http://localhost:4000 &
TUNNEL_PID=$!

# Give tunnel time to start
sleep 3

# Start the server
npm run start-socket

# Cleanup tunnel on exit
trap "kill $TUNNEL_PID 2>/dev/null; exit" INT TERM EXIT