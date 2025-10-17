/**
 * Enterprise Proposal System - Auto Port Server
 * Automatically finds available port and starts server
 */

import fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';

// Initialize Fastify
const app = fastify({ logger: false });

// Register plugins
app.register(cors);
app.register(jwt, { secret: 'enterprise-proposal-secret-key-2024' });

// Health check endpoint
app.get('/api/health', async (request, reply) => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: { version: '2.0.0', uptime: process.uptime() },
    features: ['JWT Auth', '17 Roles', 'AI Integration', 'Real-time Analytics']
  };
});

// Authentication endpoint
app.post('/api/auth/login', async (request, reply) => {
  const { username, password } = request.body;

  if (username === 'admin' && password === 'admin123') {
    const token = app.jwt.sign({
      id: 'admin',
      username: 'admin',
      role: 'admin',
    });
    return {
      access_token: token,
      token_type: 'bearer',
      user: { id: 'admin', username: 'admin', role: 'admin' },
    };
  }

  reply.code(401).send({ error: 'Invalid credentials' });
});

// Mock proposals endpoint
app.get('/api/proposals', async (request, reply) => {
  const proposals = [
    {
      id: 'PROP_001',
      title: 'Digital Transformation',
      client: 'PT. Enterprise',
      status: 'draft',
      value: 500000,
    },
    {
      id: 'PROP_002',
      title: 'Cloud Migration',
      client: 'PT. TechCo',
      status: 'review',
      value: 750000,
    },
    {
      id: 'PROP_003',
      title: 'AI Platform',
      client: 'PT. Innovation',
      status: 'submitted',
      value: 1200000,
    },
  ];

  return { proposals, total: proposals.length };
});

// Mock dashboard endpoint
app.get('/api/dashboard', async (request, reply) => {
  return {
    pipeline: { total: 3, submitted: 1, won: 0, winRate: 0 },
    funnel: [
      { status: 'draft', count: 1 },
      { status: 'review', count: 1 },
      { status: 'submitted', count: 1 },
    ],
    revenue: { total: 2450000, average: 816667, pipeline: 2450000 },
  };
});

// Mock AI endpoints
app.post('/api/ai/rfp-parser', async (request, reply) => {
  return {
    success: true,
    metadata: {
      title: 'Sample RFP',
      client: 'Sample Client',
      budget: '$500k',
      timeline: '3 months',
    },
    confidence: 85,
  };
});

app.post('/api/ai/generate-draft', async (request, reply) => {
  return {
    success: true,
    draftId: `DRAFT_${Date.now()}`,
    content: 'Sample AI-generated content...',
  };
});

// Root endpoint
app.get('/', (request, reply) => {
  reply.send({
    message: 'Enterprise Proposal System API',
    version: '2.0.0',
    status: 'running',
    features: ['17 Role System', 'Real-time Analytics', 'AI Integration'],
  });
});

// Function to find available port
async function findAvailablePort(startPort = 8000, maxPort = 9000) {
  const net = await import('net');

  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.listen(startPort, '0.0.0.0', () => {
      server.close();
      resolve(startPort);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        if (startPort < maxPort) {
          findAvailablePort(startPort + 1, maxPort).then(resolve);
        } else {
          reject(new Error('No available ports found'));
        }
      } else {
        reject(err);
      }
    });
  });
}

// Start server with auto port detection
const start = async () => {
  try {
    const port = await findAvailablePort(8000, 9000);

    await app.listen({ port, host: '0.0.0.0' });

    console.log('🚀 Enterprise Proposal System Backend Started');
    console.log(`✅ Server: http://localhost:${port}`);
    console.log(`📊 Health Check: http://localhost:${port}/api/health`);
    console.log('🔐 Default Login: admin / admin123');
    console.log(`🌐 Available endpoints:`);
    console.log(`   - GET  http://localhost:${port}/api/health`);
    console.log(`   - POST http://localhost:${port}/api/auth/login`);
    console.log(`   - GET  http://localhost:${port}/api/proposals`);
    console.log(`   - GET  http://localhost:${port}/api/dashboard`);
    console.log(`   - POST http://localhost:${port}/api/ai/rfp-parser`);
    console.log(`   - POST http://localhost:${port}/api/ai/generate-draft`);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Gracefully shutting down...');
  process.exit(0);
});

start();
