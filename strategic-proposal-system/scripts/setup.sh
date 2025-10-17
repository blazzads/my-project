#!/bin/bash
echo "Setting up Strategic Proposal System..."

# Create environment files
cp .env.example .env

# Install dependencies
if [ -d "frontend" ]; then
    cd frontend && npm install && cd ..
fi

if [ -d "backend" ]; then
    cd backend && pip install -r requirements.txt && cd ..
fi

echo "Setup completed!"