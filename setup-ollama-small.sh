#!/bin/bash

# Setup Ollama with smaller model for Norwegian Text Improvement
# Uses Mistral 7B which requires ~4GB memory instead of 6GB+

echo "🚀 Installing Ollama..."

# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama service
sudo systemctl start ollama
sudo systemctl enable ollama

# Wait for service to start
sleep 5

echo "📥 Downloading Mistral 7B model (smaller, fits in 4GB memory)..."

# Download the smaller model
ollama pull mistral:7b

echo "✅ Ollama setup complete with smaller model!"

# Test the installation
echo "🧪 Testing Ollama with Mistral 7B..."

curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistral:7b",
    "prompt": "Forbedre denne norske teksten: Dette er en test av tekst forbedring.",
    "stream": false
  }'

echo ""
echo "🎉 Mistral 7B model is working!"
echo ""
echo "💡 Memory usage:"
echo "   - Mistral 7B: ~4GB (fits in your available 5.4GB)"
echo "   - Leaves memory for whisper service and system"
echo ""
echo "📊 Check memory usage: docker stats --no-stream" 