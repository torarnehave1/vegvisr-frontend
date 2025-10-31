#!/usr/bin/env python3
"""
Fast deployment script for Hugging Face Inference Endpoints
Usage: python deploy-to-hf.py
"""

import os
from huggingface_hub import HfApi, login

# Configuration
REPO_ID = "torarnehave/speaker-diarization-endpoint"  # Your HF repo
ENDPOINT_URL = "https://dgedcs9mp2ocf9jk.us-east-1.aws.endpoints.huggingface.cloud"

def deploy():
    """Upload files to HF repository (endpoint will auto-pull)"""
    
    # Get token from environment
    token = os.environ.get("HF_TOKEN")
    if not token:
        print("❌ HF_TOKEN environment variable not set")
        return
    
    # Initialize HF API
    api = HfApi()
    
    print("🚀 Deploying to Hugging Face...")
    
    try:
        # Upload handler
        print("📤 Uploading handler.py...")
        api.upload_file(
            path_or_fileobj="handler-fixed.py",
            path_in_repo="handler.py",
            repo_id=REPO_ID,
            repo_type="model",  # or "space" depending on your setup
            token=token,
        )
        
        # Upload requirements
        print("📤 Uploading requirements.txt...")
        api.upload_file(
            path_or_fileobj="requirements-stable.txt",
            path_in_repo="requirements.txt",
            repo_id=REPO_ID,
            repo_type="model",
            token=token,
        )
        
        print("✅ Files uploaded successfully!")
        print(f"🔄 Endpoint will auto-redeploy: {ENDPOINT_URL}")
        print("\n⏳ Wait 2-3 minutes for deployment to complete")
        
    except Exception as e:
        print(f"❌ Deployment failed: {e}")

if __name__ == "__main__":
    deploy()
