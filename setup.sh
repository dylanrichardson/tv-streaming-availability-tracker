#!/bin/bash
set -e

echo "🚀 StreamTrack Self-Serve Setup"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
  echo -e "${RED}❌ Wrangler not found${NC}"
  echo "Install with: npm install -g wrangler"
  exit 1
fi

# Check if logged in
echo "🔐 Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
  echo -e "${YELLOW}⚠️  Not logged in to Cloudflare${NC}"
  echo "Please log in:"
  wrangler login
fi

echo -e "${GREEN}✓ Authenticated with Cloudflare${NC}"
echo ""

# Get worker name from user
echo "📝 Worker Configuration"
read -p "Enter your worker name (default: streamtrack-api): " WORKER_NAME
WORKER_NAME=${WORKER_NAME:-streamtrack-api}
echo ""

# Create D1 database
echo "📦 Creating D1 database..."
echo "Running: wrangler d1 create streamtrack"
DB_OUTPUT=$(wrangler d1 create streamtrack 2>&1) || true

if echo "$DB_OUTPUT" | grep -q "already exists"; then
  echo -e "${YELLOW}⚠️  Database 'streamtrack' already exists${NC}"
  echo "Retrieving existing database ID..."
  DB_ID=$(wrangler d1 list | grep streamtrack | awk '{print $2}')
  if [ -z "$DB_ID" ]; then
    echo -e "${RED}❌ Could not find database ID${NC}"
    echo "Please run: wrangler d1 list"
    echo "And manually update worker/wrangler.toml"
    exit 1
  fi
else
  # Extract database_id from output
  DB_ID=$(echo "$DB_OUTPUT" | grep "database_id" | sed -E 's/.*database_id = "([^"]+)".*/\1/')
  if [ -z "$DB_ID" ]; then
    echo -e "${RED}❌ Failed to create database${NC}"
    echo "$DB_OUTPUT"
    exit 1
  fi
fi

echo -e "${GREEN}✓ Database ID: $DB_ID${NC}"
echo ""

# Update wrangler.toml
echo "📝 Updating worker/wrangler.toml..."
cd worker

if [ ! -f wrangler.toml ]; then
  echo -e "${YELLOW}⚠️  wrangler.toml not found, copying from example${NC}"
  cp wrangler.toml.example wrangler.toml
fi

# Update worker name and database_id
sed -i.bak "s/name = \".*\"/name = \"$WORKER_NAME\"/" wrangler.toml
sed -i.bak "s/database_id = \".*\"/database_id = \"$DB_ID\"/" wrangler.toml
rm wrangler.toml.bak

echo -e "${GREEN}✓ Updated wrangler.toml${NC}"
echo ""

# Install dependencies
echo "📦 Installing worker dependencies..."
npm install
echo ""

# Run migrations
echo "🗄️  Running database migrations..."
wrangler d1 execute streamtrack --remote --file=./schema.sql
echo -e "${GREEN}✓ Database schema created${NC}"
echo ""

# Deploy worker
echo "☁️  Deploying worker..."
wrangler deploy
WORKER_URL="https://$WORKER_NAME.$(wrangler whoami 2>/dev/null | grep 'Account Name' | awk '{print $NF}').workers.dev"
echo -e "${GREEN}✓ Worker deployed${NC}"
echo ""

cd ..

# Configure frontend
echo "🎨 Configuring frontend..."
cd frontend

if [ ! -f .env.production ]; then
  cp .env.production.example .env.production
fi

echo "VITE_API_URL=$WORKER_URL" > .env.production
echo -e "${GREEN}✓ Frontend configured${NC}"
echo ""

# Install and build frontend
echo "📦 Installing frontend dependencies..."
npm install
echo ""

echo "🏗️  Building frontend..."
npm run build
echo -e "${GREEN}✓ Frontend built${NC}"
echo ""

cd ..

# Deployment options
echo ""
echo "================================"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo "================================"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Deploy Frontend:"
echo "   Option A - Cloudflare Pages (recommended):"
echo "     cd frontend"
echo "     npx wrangler pages deploy dist --project-name=streamtrack"
echo ""
echo "   Option B - GitHub Pages:"
echo "     - Push to GitHub"
echo "     - Enable Pages in repo settings"
echo "     - Set build command: cd frontend && npm run build"
echo "     - Set publish directory: frontend/dist"
echo ""
echo "2. Your Worker is live at:"
echo "   $WORKER_URL"
echo ""
echo "3. Test the API:"
echo "   curl $WORKER_URL/api/titles"
echo ""
echo "4. Import titles and wait for cron to run, or trigger manually:"
echo "   curl -X POST $WORKER_URL/api/trigger-check"
echo ""
echo "5. Configure cron schedule (optional):"
echo "   Edit worker/wrangler.toml [triggers] section"
echo ""
