#!/bin/bash
# Backfill full_path for existing titles
#
# This script calls the /api/backfill-fullpath endpoint repeatedly
# until all titles have full_path populated.
#
# Usage:
#   ./scripts/backfill-fullpath.sh

set -e

echo "=== Backfill full_path Script ==="
echo ""

# Check how many titles need backfilling
echo "Checking titles without full_path..."
MISSING=$(npx wrangler d1 execute streamtrack --remote --command \
  "SELECT COUNT(*) as count FROM titles WHERE full_path IS NULL" \
  --json | jq -r '.[0].results[0].count')

if [ "$MISSING" -eq 0 ]; then
  echo "✓ All titles already have full_path!"
  exit 0
fi

echo "Found $MISSING titles without full_path"
echo ""

# Process in batches (endpoint processes 100 at a time)
TOTAL_PROCESSED=0

while [ "$MISSING" -gt 0 ]; do
  echo "Processing batch (up to 100 titles)..."

  # Call backfill endpoint
  RESULT=$(curl -s -X POST https://streamtrack-api.dylanrichardson1996.workers.dev/api/backfill-fullpath)

  echo "$RESULT" | jq -r '.message'

  # Count how many were processed
  PROCESSED=$(echo "$RESULT" | jq -r '.results | length')
  TOTAL_PROCESSED=$((TOTAL_PROCESSED + PROCESSED))

  if [ "$PROCESSED" -eq 0 ]; then
    echo "No more titles to process"
    break
  fi

  # Check remaining
  MISSING=$(npx wrangler d1 execute streamtrack --remote --command \
    "SELECT COUNT(*) as count FROM titles WHERE full_path IS NULL" \
    --json | jq -r '.[0].results[0].count')

  echo "Remaining: $MISSING"
  echo ""

  # Rate limit delay
  if [ "$MISSING" -gt 0 ]; then
    echo "Waiting 5 seconds before next batch..."
    sleep 5
  fi
done

echo ""
echo "✓ Backfill complete! Processed $TOTAL_PROCESSED titles total"
echo ""
echo "Verify results:"
echo "  npx wrangler d1 execute streamtrack --remote --command \"SELECT COUNT(*) as missing FROM titles WHERE full_path IS NULL\""
