#!/bin/bash
echo "Deploying Strategic Proposal System..."

# Stop existing services
docker-compose down

# Build and start
docker-compose up -d --build

echo "Deployment completed!"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:8000"