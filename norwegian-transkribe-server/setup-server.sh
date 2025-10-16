#!/bin/bash

# Server Setup Script for Norwegian Whisper API
# Run this script on your fresh server to install dependencies

set -e

echo "🚀 Setting up server for Norwegian Whisper API..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install required packages
echo "🛠️ Installing required packages..."
sudo apt install -y \
    curl \
    wget \
    git \
    htop \
    vim \
    unzip \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    jq

# Install Docker
echo "🐳 Installing Docker..."
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Install Docker Compose (standalone)
echo "🐙 Installing Docker Compose..."
DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | jq -r '.tag_name')
sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
echo "👥 Adding user to docker group..."
sudo usermod -aG docker $USER

# Enable Docker service
echo "🔧 Enabling Docker service..."
sudo systemctl enable docker
sudo systemctl start docker

# Create project directory
echo "📁 Creating project directory..."
mkdir -p ~/whisper-api
cd ~/whisper-api

# Set up firewall (optional)
echo "🔥 Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Create necessary directories
echo "📂 Creating application directories..."
mkdir -p uploads cache logs/{nginx,api,whisper} ssl

# Set permissions
echo "🔒 Setting permissions..."
chmod 755 uploads cache logs ssl
chmod -R 755 logs/

echo "✅ Server setup completed!"
echo ""
echo "📝 Next steps:"
echo "1. Upload your project files to ~/whisper-api/"
echo "2. Copy env.example to .env and configure"
echo "3. Run: chmod +x deploy.sh && ./deploy.sh"
echo "4. Log out and log back in for Docker group changes to take effect"
echo ""
echo "🎉 Server is ready for Norwegian Whisper API deployment!" 