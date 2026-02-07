#!/bin/bash
# Cleanup old Claude session data
# Runs on startup and keeps last 7 days of data

CLAUDE_DIR="$HOME/.claude"
DAYS_TO_KEEP=7

echo "🧹 Cleaning up old Claude session data..."

# Count before
BEFORE_SIZE=$(du -sh "$CLAUDE_DIR" 2>/dev/null | cut -f1)

# Clean session-env directories older than DAYS_TO_KEEP days
find "$CLAUDE_DIR/session-env/" -maxdepth 1 -type d -mtime +$DAYS_TO_KEEP -exec rm -rf {} \; 2>/dev/null || true

# Clean debug logs older than DAYS_TO_KEEP days
find "$CLAUDE_DIR/debug/" -type f -mtime +$DAYS_TO_KEEP -delete 2>/dev/null || true

# Clean todo files older than DAYS_TO_KEEP days
find "$CLAUDE_DIR/todos/" -type f -mtime +$DAYS_TO_KEEP -delete 2>/dev/null || true

# Clean shell snapshots older than DAYS_TO_KEEP days
find "$CLAUDE_DIR/shell-snapshots/" -type f -mtime +$DAYS_TO_KEEP -delete 2>/dev/null || true

# Count after
AFTER_SIZE=$(du -sh "$CLAUDE_DIR" 2>/dev/null | cut -f1)

echo "📊 Claude cache: $BEFORE_SIZE → $AFTER_SIZE"
echo "✅ Cleanup complete (kept last $DAYS_TO_KEEP days)"
