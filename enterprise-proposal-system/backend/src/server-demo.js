/**
 * Enterprise Proposal System - Demo Server
 * FastAPI/Node.js Microservice for Demo
 */

import fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import winston from 'winston';

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}] [SERVER]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Initialize Fastify
const app = fastify({
  logger: false,
  trustProxy: true
});

// Register plugins
app.register(cors);
app.register(jwt, {
  secret: 'enterprise-proposal-secret-key-2024'
});

// Health check endpoint
app.get('/api/health', async (request, reply) => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: {
      version: '2.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage()
    },
    features: {
      authentication: 'JWT',
      notifications: 'RabbitMQ/Kafka',
      ai: 'GPT-4/Claude',
      dms: 'MinIO/S3',
      analytics: 'Real-time',
      rbac: '17 roles'
    }
  };
});

// Authentication routes
app.post('/api/auth/login', async (request, reply) => {
  try {
    const { username, password } = request.body;

    if (username === 'admin' && password === 'admin123') {
      const token = app.jwt.sign({
        id: 'admin-001',
        username: 'admin',
        email: 'admin@enterprise.com',
        full_name: 'System Administrator',
        role: 'admin'
      });

      return {
        access_token: token,
        token_type: 'bearer',
        user: {
          id: 'admin-001',
          username: 'admin',
          email: 'admin@enterprise.com',
          full_name: 'System Administrator',
          role: 'admin'
        }
      };
    } else {
      reply.code(401).send({ error: 'Invalid credentials' });
    }
  } catch (error) {
    logger.error('Login error:', error);
    reply.code(500).send({ error: 'Internal server error' });
  }
});

// Mock proposals data
const mockProposals = [
  {
    id: 'PROP_001',
    title: 'Digital Transformation Project',
    client_name: 'PT. Enterprise Client',
    status: 'draft',
    estimated_value: 500000,
    created_at: '2024-01-15T10:00:00Z'
  },
  {
    id: 'PROP_002',
    title: 'Cloud Migration Initiative',
    client_name: 'PT. Tech Company',
    status: 'in_review',
    estimated_value: 750000,
    created_at: '2024-01-14T14:30:00Z'
  },
  {
    id: 'PROP_003',
    title: 'AI Implementation Platform',
    client_name: 'PT. Innovation Hub',
    status: 'submitted',
    estimated_value: 1200000,
    created_at: '2024-01-13T09:15:00Z'
  }
];

// Mock dashboard data
const mockDashboard = {
  pipeline: {
    total: 3,
    submitted: 1,
    won: 0,
    lost: 0,
    winRate: 0
  },
  funnel: [
    { status: 'draft', count: 1 },
    { status: 'in_review', count: 1 },
    { status: 'submitted', count: 1 }
  ],
  revenue: {
    totalRevenue: 2450000,
    avgValue: 816667,
    totalValuePipeline: 2450000
  }
};

// API Routes
app.get('/api/proposals', async (request, reply) => {
  try {
    return {
      proposals: mockProposals,
      total: mockProposals.length,
      filtered: mockProposals.length
    };
  } catch (error) {
    logger.error('Get proposals error:', error);
    reply.code(500).send({ error: 'Internal server error' });
  }
});

app.get('/api/dashboard', async (request, reply) => {
  try {
    return mockDashboard;
  } catch (error) {
    logger.error('Dashboard error:', error);
    reply.code(500).send({ error: 'Internal server error' });
  }
});

// Mock AI endpoints
app.post('/api/ai/rfp-parser', async (request, reply) => {
  try {
    return {
      success: true,
      metadata: {
        title: 'Sample RFP',
        clientName: 'Sample Client',
        budget: '$500,000',
        timeline: '3 months',
        requirements: ['Web Development', 'Mobile App', 'Database']
      },
      confidence: 85,
      message: 'RFP parsed successfully'
    };
  } catch (error) {
    logger.error('RFP parser error:', error);
    reply.code(500).send({ error: 'RFP parsing failed' });
  }
});

app.post('/api/ai/generate-draft', async (request, reply) => {
  try {
    return {
      success: true,
      draftId: `DRAFT_${Date.now()}`,
      content: 'Sample AI-generated draft content...',
      message: 'AI draft generated successfully'
    };
  } catch (error) {
    logger.error('AI draft builder error:', error);
    reply.code(500).send({ error: 'AI draft generation failed' });
  }
});

// Root endpoint
app.get('/', (request, reply) => {
  reply.send({
    message: 'Enterprise Proposal System API',
    version: '2.0.0',
    architecture: 'FastAPI/Node.js Microservice',
    database: 'SQLite3 Multi-Database',
    features: [
      '17 Role System',
      'Real-time Analytics',
      'AI Integration',
      'DMS with MinIO/S3',
      'WebSocket Updates',
      'Audit Trail',
      'Compliance Engine'
    ],
    status: 'running'
  });
});

// Start server
const start = async () => {
  try {
    logger.info('🚀 Starting Enterprise Proposal System Backend Demo...');
    logger.info('📊 Features:');
    logger.info('  - 17 Role System');
    logger.info('  - Real-time Analytics');
    logger.info('  - AI Integration');
    logger.info('  - Multi-Database Architecture');
    logger.info('  - Event-Driven Notifications');
    logger.info('  - Document Management System');

    const port = 8000;
    const host = '0.0.0.0';

    await app.listen({ port, host });

    logger.info(`✅ Server running on http://localhost:${port}`);
    logger.info('📊 API Health Check: http://localhost:8000/api/health');
    logger.info('🔐 Default Login: admin / admin123');

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Gracefully shutting down...');
  process.exit(0);
});

start();
```

Sekarang mari saya update package.json untuk menggunakan server-demo.js:
