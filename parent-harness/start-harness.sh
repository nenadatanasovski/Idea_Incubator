#!/bin/bash
cd /home/ned-atanasovski/Documents/Idea_Incubator/Idea_Incubator/parent-harness/orchestrator

# Kill any existing harness
pkill -f "tsx src/server" 2>/dev/null
sleep 1

# Export env vars from .env file
set -a
source /home/ned-atanasovski/Documents/Idea_Incubator/Idea_Incubator/.env
set +a

# Start harness with spawning enabled
export HARNESS_SPAWN_AGENTS=true
export HARNESS_RUN_QA=true

echo "Starting harness..."
echo "OAuth Token: ${ANTHROPIC_OAUTH_TOKEN:0:30}..."
echo "Spawn Agents: $HARNESS_SPAWN_AGENTS"

npm run dev
