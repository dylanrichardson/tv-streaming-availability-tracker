#!/bin/bash
# agent.sh - Launch Claude in an isolated worktree with automatic cleanup
#
# Usage: ./agent.sh [claude arguments]
#
# This script:
# - Finds or creates an available worktree (streamtrack-worktree-0, 1, 2, ...)
# - Claims it with a .agent-lock file
# - Launches Claude in that worktree
# - Automatically cleans up the lockfile on exit (even if Claude crashes)

set -e

BASE_DIR="/Users/dylan.richardson/toast/git-repos"
REPO_NAME="streamtrack-worktree"
STALE_LOCK_HOURS=2

# Function to check if a lock is stale (older than N hours)
is_lock_stale() {
  local lockfile="$1"
  if [ ! -f "$lockfile" ]; then
    return 1  # Not stale if doesn't exist
  fi

  # Get lock file modification time in seconds since epoch
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    lock_time=$(stat -f %m "$lockfile")
  else
    # Linux
    lock_time=$(stat -c %Y "$lockfile")
  fi

  current_time=$(date +%s)
  age_hours=$(( (current_time - lock_time) / 3600 ))

  [ "$age_hours" -gt "$STALE_LOCK_HOURS" ]
}

# Find or create available worktree
WORKTREE_FOUND=false
for i in {0..20}; do
  WORKTREE_PATH="$BASE_DIR/$REPO_NAME-$i"
  LOCKFILE="$WORKTREE_PATH/.agent-lock"

  if [ -d "$WORKTREE_PATH" ]; then
    if [ ! -f "$LOCKFILE" ]; then
      # Found available worktree
      echo "Found available worktree: $REPO_NAME-$i"
      cd "$WORKTREE_PATH"
      WORKTREE_FOUND=true
      break
    elif is_lock_stale "$LOCKFILE"; then
      # Stale lock, claim it
      echo "Found stale lock in worktree-$i (>$STALE_LOCK_HOURS hours old), claiming it"
      cd "$WORKTREE_PATH"
      WORKTREE_FOUND=true
      break
    fi
  else
    # Worktree doesn't exist, create it
    echo "Creating new worktree: $REPO_NAME-$i"
    cd "$BASE_DIR/$REPO_NAME-0"
    git worktree add "$WORKTREE_PATH" -b "worktree-$i-$(date +%s)"
    cd "$WORKTREE_PATH"
    WORKTREE_FOUND=true
    break
  fi
done

if [ "$WORKTREE_FOUND" = false ]; then
  echo "ERROR: All worktrees (0-20) are locked. Please wait or clean up stale locks."
  exit 1
fi

# Create lockfile with metadata
cat > .agent-lock <<EOF
Locked at $(date -Iseconds)
PID: $$
Worktree: $(basename "$PWD")
EOF

# Set up cleanup trap (removes lockfile on exit, even if crashed)
cleanup() {
  echo ""
  echo "Cleaning up lockfile..."
  rm -f .agent-lock
  echo "Lockfile removed. Worktree ready for reuse."
}
trap cleanup EXIT INT TERM

# Launch Claude with all arguments passed through
echo "Launching Claude in $(basename "$PWD")..."
echo "Press Ctrl+C to exit and automatically clean up the lockfile."
echo ""

exec claude "$@"
