#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_ROOT="$ROOT_DIR/data/backups/snapshot-$STAMP"

mkdir -p "$BACKUP_ROOT"

if [ -d "$ROOT_DIR/data" ]; then
  cp -R "$ROOT_DIR/data" "$BACKUP_ROOT/parent-harness-data"
fi

if [ -d "$ROOT_DIR/orchestrator/data" ]; then
  cp -R "$ROOT_DIR/orchestrator/data" "$BACKUP_ROOT/orchestrator-data"
fi

echo "Snapshot created at: $BACKUP_ROOT"
