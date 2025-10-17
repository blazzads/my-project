/**
 * Enterprise Proposal System - Simple Demo Server
 * FastAPI/Node.js Microservice for Demo
 */

import fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}] [SERVER]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/server.log',
      level: 'info'
    }),
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
  secret: process.env.JWT_SECRET || 'enterprise-proposal-secret-key-2024'
});

// Middleware
app.addHook('preHandler', async (request, reply) => {
  // Log all incoming requests
  logger.info(`${request.method} ${request.url} - ${request.headers['user-agent']}`);

  // Add response headers
  reply.header('X-Powered-By', 'Enterprise Proposal System v2.0');
  reply.header('X-Server-Time', new Date().toISOString());
});

// Health check endpoint
app.get('/api/health', async (request, reply) => {
  try {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      server: {
        version: '2.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
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
  } catch (error) {
    logger.error('Health check failed:', error);
    reply.code(500).send({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Authentication routes
app.post('/api/auth/login', async (request, reply) => {
  try {
    const { username, password } = request.body;

    if (!username || !password) {
      reply.code(400).send({ error: 'Username and password required' });
      return;
    }

    // Mock authentication (in production, use bcrypt)
    if (username === 'admin' && password === 'admin123') {
      const token = app.jwt.sign({
        id: 'admin-001',
        username: 'admin',
        email: 'admin@enterprise.com',
        full_name: 'System Administrator',
        role: 'admin',
        department: 'IT'
      });

      return {
        access_token: token,
        token_type: 'bearer',
        user: {
          id: 'admin-001',
          username: 'admin',
          email: 'admin@enterprise.com',
          full_name: 'System Administrator',
          role: 'admin',
          department: 'IT'
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
    logger.info('🚀 Starting Enterprise Proposal System Backend...');
    logger.info('📊 Layer Teknologi:');
    logger.info('  - Backend: FastAPI/Node.js (Microservice)');
    logger.info('  - Data Layer: SQLite3 (Multi-Database)');
    logger.info('  - Frontend: Next.js (React), TypeScript, Tailwind CSS');

    // Load environment variables
    if (!process.env.JWT_SECRET) {
      logger.warn('⚠️ JWT_SECRET not set in environment variables. Using default.');
    }

    // Start server
    const port = process.env.PORT || 8000;
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });

    logger.info(`✅ Server running on http://${host}:${port}`);
    logger.info('📊 API Documentation: http://localhost:${port}/api/health');

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

Sekarang mari kita update package.json untuk menggunakan server-simple.js:
