#!/bin/bash

# InkPad GitHub Repository Setup Script
# This script helps you create and configure your GitHub repository for InkPad

echo "🎨 InkPad GitHub Repository Setup"
echo "================================="

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "Please install it first: https://cli.github.com/"
    echo ""
    echo "Or create your repository manually:"
    echo "1. Go to https://github.com"
    echo "2. Click 'New repository'"
    echo "3. Name it 'InkPad'"
    echo "4. Don't initialize with README (we already have one)"
    echo "5. Create the repository"
    echo "6. Follow the instructions to push existing code"
    exit 1
fi

# Get user confirmation
echo ""
echo "This will create: https://github.com/mmolarskybeck/InkPad"
read -p "Do you want to create this GitHub repository? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi

# Check if already has remote
if git remote get-url origin &> /dev/null; then
    echo "⚠️  Git remote 'origin' already exists."
    echo "Current remote:"
    git remote get-url origin
    echo ""
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 0
    fi
fi

# Create the GitHub repository
echo "📦 Creating GitHub repository..."
gh repo create InkPad --public --description "A modern, browser-based IDE for writing and testing Ink stories"

if [ $? -eq 0 ]; then
    echo "✅ Repository created successfully!"
    
    # Add remote if it doesn't exist
    if ! git remote get-url origin &> /dev/null; then
        git remote add origin https://github.com/mmolarskybeck/InkPad.git
    else
        # Update existing remote to correct URL
        git remote set-url origin https://github.com/mmolarskybeck/InkPad.git
    fi
    
    # Push to GitHub
    echo "📤 Pushing code to GitHub..."
    git push -u origin main
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 Success! Your InkPad repository is ready!"
        echo ""
        echo "🔗 Repository URL: https://github.com/mmolarskybeck/InkPad"
        echo ""
        echo "✨ Repository is set up and ready for future deployment when you're ready!"
        echo ""
    else
        echo "❌ Failed to push to GitHub. Please check your setup and try again."
        exit 1
    fi
else
    echo "❌ Failed to create repository. Please check your GitHub CLI setup."
    exit 1
fi
