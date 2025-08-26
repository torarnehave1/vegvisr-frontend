#!/bin/bash

# Password Worker Deployment Script
# This script sets up and deploys the password worker

echo "🔒 Password Worker Deployment Script"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the password-worker directory."
    exit 1
fi

# Step 1: Install dependencies
print_status "Installing dependencies..."
npm install
if [ $? -eq 0 ]; then
    print_success "Dependencies installed"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Step 2: Check if wrangler is available
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI not found. Please install it with: npm install -g wrangler"
    exit 1
fi

# Step 3: Check authentication
print_status "Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    print_warning "Not authenticated with Cloudflare. Please run: wrangler login"
    read -p "Do you want to authenticate now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        wrangler login
    else
        print_error "Authentication required to deploy worker"
        exit 1
    fi
fi

print_success "Authenticated with Cloudflare"

# Step 4: Create D1 database if it doesn't exist
print_status "Setting up D1 database..."
read -p "Do you want to create a new D1 database? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Creating D1 database 'vegvisr_passwords'..."
    DB_OUTPUT=$(wrangler d1 create vegvisr_passwords 2>&1)
    if [ $? -eq 0 ]; then
        print_success "D1 database created"
        echo "$DB_OUTPUT"
        print_warning "Please update the database_id in wrangler.toml with the ID shown above"
        read -p "Press Enter after updating wrangler.toml..."
    else
        if echo "$DB_OUTPUT" | grep -q "already exists"; then
            print_warning "Database already exists"
        else
            print_error "Failed to create D1 database"
            echo "$DB_OUTPUT"
            exit 1
        fi
    fi
fi

# Step 5: Run database migration
print_status "Running database migration..."
if [ -f "schema.sql" ]; then
    wrangler d1 execute vegvisr_passwords --file=schema.sql
    if [ $? -eq 0 ]; then
        print_success "Database schema applied"
    else
        print_error "Failed to apply database schema"
        exit 1
    fi
else
    print_warning "schema.sql not found, skipping migration"
fi

# Step 6: Set up secrets
print_status "Setting up secrets..."
read -p "Do you want to set the ADMIN_KEY secret? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Setting ADMIN_KEY secret..."
    print_warning "Choose a strong, random admin key for security"
    wrangler secret put ADMIN_KEY
    if [ $? -eq 0 ]; then
        print_success "ADMIN_KEY secret set"
    else
        print_error "Failed to set ADMIN_KEY secret"
        exit 1
    fi
fi

# Step 7: Deploy the worker
print_status "Deploying password worker..."
wrangler deploy
if [ $? -eq 0 ]; then
    print_success "Password worker deployed successfully!"
    echo ""
    echo "🎉 Deployment Complete!"
    echo "======================"
    echo ""
    echo "Your password worker is now deployed and ready to use."
    echo ""
    echo "Next steps:"
    echo "1. Test the worker with the demo graphs:"
    echo "   - demo-protected (password: demo123)"
    echo "   - private-graph-123 (password: secret456)"
    echo ""
    echo "2. Update your frontend to use the worker endpoints"
    echo ""
    echo "3. Use the admin endpoints to manage graph passwords"
    echo ""
    print_warning "Keep your ADMIN_KEY secure and don't share it!"
else
    print_error "Failed to deploy worker"
    exit 1
fi

# Step 8: Test deployment
print_status "Testing deployment..."
WORKER_URL=$(wrangler whoami | grep -o "password-worker.*workers.dev" || echo "your-worker-domain.workers.dev")
print_status "Testing health endpoint..."
curl -s "https://$WORKER_URL/health" | grep -q "healthy"
if [ $? -eq 0 ]; then
    print_success "Worker is responding correctly"
else
    print_warning "Worker might not be responding correctly"
fi

echo ""
print_success "Deployment script completed!"
echo "Worker URL: https://$WORKER_URL"
