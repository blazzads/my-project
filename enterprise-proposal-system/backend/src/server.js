/**
 * Enterprise Proposal System - Main Server
 * FastAPI/Node.js Microservice with Multi-Database Architecture
 *
 * Layer Teknologi:
 * - Backend: FastAPI/Node.js (Microservice)
 * - Data Layer: SQLite3 (Multi-Database Setup)
 * - Frontend: Next.js (React), TypeScript, Tailwind CSS
 */

import fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import winston from 'winston';

// Import modules
import databaseManager from './config/database.js';
import notificationService from './services/notification.js';
import aiService from './services/ai.js';
import rbacMiddleware from './middleware/rbac.js';
import auditLogger from './middleware/audit.js';

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
app.register(websocket);
app.register(multipart);

// Static files serving
app.register(require('@fastify/static'), {
  root: path.join(__dirname, '../public'),
  prefix: '/static'
});

// Middleware
app.addHook('preHandler', async (request, reply) => {
  // Log all incoming requests
  logger.info(`${request.method} ${request.url} - ${request.headers['user-agent']}`);

  // Add response headers
  reply.header('X-Powered-By', 'Enterprise Proposal System v2.0');
  reply.header('X-Server-Time', new Date().toISOString());
});

// JWT authentication
app.addHook('onRequest', async (request, reply) => {
  if (request.url.startsWith('/api/') &&
      request.url !== '/api/health' &&
      request.url !== '/api/auth/login') {

    const token = request.headers.authorization;
    if (!token) {
      reply.code(401).send({ error: 'Authentication required' });
      return;
    }

    try {
      const decoded = request.jwtVerify(token.replace('Bearer ', ''));
      request.user = decoded;
    } catch (err) {
      reply.code(401).send({ error: 'Invalid token' });
      return;
    }
  }
});

// Health check endpoint
app.get('/api/health', async (request, reply) => {
  try {
    // Test all database connections
    const primaryConn = databaseManager.getPrimaryConnection();
    const analyticsConn = databaseManager.getAnalyticsConnection();
    const dashboardConn = databaseManager.getDashboardConnection();
    const dmsConn = databaseManager.getDMSConnection();
    const auditConn = databaseManager.getAuditConnection();

    // Get database stats
    const userCount = primaryConn.prepare('SELECT COUNT(*) as count FROM users').get();
    const proposalCount = primaryConn.prepare('SELECT COUNT(*) as count FROM proposals').get();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      server: {
        version: '2.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
      databases: {
        primary: 'connected',
        analytics: 'connected',
        dashboard: 'connected',
        dms: 'connected',
        audit: 'connected'
      },
      statistics: {
        users: userCount.count,
        proposals: proposalCount.count,
        currentWPS: databaseManager.getCurrentWPS(),
        maxWPS: 95
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

    const primaryConn = databaseManager.getPrimaryConnection();
    const user = primaryConn.prepare(
      'SELECT id, username, email, full_name, password_hash, role, department FROM users WHERE username = ?'
    ).get(username);

    if (!user) {
      reply.code(401).send({ error: 'Invalid credentials' });
      return;
    }

    // Verify password (in production, use bcrypt)
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(password).digest('hex');

    if (hash !== user.password_hash) {
      reply.code(401).send({ error: 'Invalid credentials' });
      return;
    }

    // Generate JWT token
    const token = app.jwt.sign({
      id: user.id,
      username: user.username,
      role: user.role,
      department: user.department
    });

    // Log audit
    await auditLogger.log({
      action: 'LOGIN',
      entity_type: 'USER',
      entity_id: user.id,
      user_id: user.id,
      user_role: user.role,
      ip_address: request.ip,
      user_agent: request.headers['user-agent']
    });

    reply.send({
      access_token: token,
      token_type: 'bearer',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    reply.code(500).send({ error: 'Internal server error' });

        SELECT p.*, o.client_name, o.title as opportunity_title, u.full_name as created_by_name
        FROM proposals p
        JOIN opportunities o ON p.opportunity_id = o.id
        LEFT JOIN users u ON p.created_by = u.id
        ORDER BY p.created_at DESC
      `).all();

      reply.send({
        proposals: proposals,
        total: proposals.length,
        filtered: proposals.length
      });
    } catch (error) {
      logger.error('Get proposals error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create proposal
  fastify.post('/api/proposals', {
    preHandler: [rbacMiddleware.requireRole(['admin', 'sales', 'sales_manager'])]
  }, async (request, reply) => {
    try {
      databaseManager.incrementWriteWPS();

      const { title, description, category, client_name, estimated_value, opportunity_id } = request.body;
      const proposalId = `PROP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const conn = databaseManager.getPrimaryConnection();

      const stmt = conn.prepare(`
        INSERT INTO proposals (
          id, title, description, category, status, client_name,
          estimated_value, currency, opportunity_id, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        proposalId, title, description, category, 'draft', client_name,
        estimated_value || 0, 'USD', opportunity_id, request.user.id,
        new Date().toISOString(), new Date().toISOString()
      );

      // Trigger notification to PO and BS
      await notificationService.notify({
        type: 'PROPOSAL_CREATED',
        proposalId,
        title,
        category,
        assignedTo: ['po', 'bs'],
        message: `New proposal "${title}" created by ${request.user.full_name}`
      });

      reply.code(201).send({
        id: proposalId,
        status: 'created',
        message: 'Proposal created successfully'
      });
    } catch (error) {
      logger.error('Create proposal error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get proposal by ID
  fastify.get('/api/proposals/:id', {
    preHandler: [rbacMiddleware.requireRole(['admin', 'sales_manager', 'po', 'bs', 'bs_manager', 'pm', 'bidding', 'gm'])]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const conn = databaseManager.getDashboardConnection();

      const proposal = conn.prepare(`
        SELECT p.*, o.client_name, o.title as opportunity_title, u.full_name as created_by_name
        FROM proposals p
        JOIN opportunities o ON p.opportunity_id = o.id
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.id = ?
      `).get(id);

      if (!proposal) {
        reply.code(404).send({ error: 'Proposal not found' });
        return;
      }

      reply.send({ proposal });
    } catch (error) {
      logger.error('Get proposal error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update proposal status
  fastify.patch('/api/proposals/:id/status', {
    preHandler: [rbacMiddleware.requireRole(['admin', 'sales_manager', 'bs_manager'])]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { status, comment } = request.body;

      databaseManager.incrementWriteWPS();

      const conn = databaseManager.getPrimaryConnection();

      const stmt = conn.prepare(`
        UPDATE proposals
        SET status = ?, updated_at = ?
        WHERE id = ?
      `);

      stmt.run(status, new Date().toISOString(), id);

      // Log audit
      await auditLogger.log({
        action: 'STATUS_UPDATE',
        entity_type: 'PROPOSAL',
        entity_id: id,
        user_id: request.user.id,
        user_role: request.user.role,
        old_values: JSON.stringify({ status: 'draft' }),
        new_values: JSON.stringify({ status }),
        comment
      });

      reply.send({
        id,
        status,
        message: 'Proposal status updated successfully'
      });
    } catch (error) {
      logger.error('Update proposal status error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  return fastify;
});

// Routes for AI Modules (Bab 9 & 15)
app.register(async (fastify) => {
  const fastify = fastify;

  // RFP Parser
  fastify.post('/api/ai/rfp-parser', {
    preHandler: [rbacMiddleware.requireRole(['admin', 'sales', 'sales_manager'])]
  }, async (request, reply) => {
    try {
      const { rfpFile, opportunityId } = request.body;

      // Process RFP file
      const parsedData = await aiService.parseRFP(rfpFile);

      // Store metadata in primary database
      databaseManager.incrementWriteWPS();

      const conn = databaseManager.getPrimaryConnection();
      const stmt = conn.prepare(`
        INSERT INTO opportunities (
          id, title, client_name, rfp_file_path, metadata, status, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        opportunityId || `OPP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        parsedData.title,
        parsedData.clientName,
        rfpFile.filename,
        JSON.stringify(parsedData.metadata),
        'rfp_parsed',
        request.user.id,
        new Date().toISOString()
      );

      // Trigger notification to PO and BS
      await notificationService.notify({
        type: 'RFP_PARSED',
        opportunityId,
        parsedData,
        assignedTo: ['po', 'bs']
      });

      reply.send({
        opportunityId,
        metadata: parsedData.metadata,
        message: 'RFP parsed successfully'
      });
    } catch (error) {
      logger.error('RFP parser error:', error);
      reply.code(500).send({ error: 'RFP parsing failed' });
    }
  });

  // AI Draft Builder
  fastify.post('/api/ai/generate-draft', {
    preHandler: [rbacMiddleware.requireRole(['bs'])]
  }, async (request, reply) => {
    try {
      const { proposalId, template, requirements } = request.body;

      // Generate AI draft
      const draft = await aiService.generateDraft({
        proposalId,
        template,
        requirements,
        user: request.user
      });

      // Store draft as new version
      databaseManager.incrementWriteWPS();

      const conn = databaseManager.getPrimaryConnection();
      const stmt = conn.prepare(`
        INSERT INTO proposal_versions (
          id, proposal_id, version, title, content, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        `VERSION_${proposalId}_${Date.now()}`,
        proposalId,
        1,
        `Draft: ${template}`,
        JSON.stringify(draft),
        request.user.id,
        new Date().toISOString()
      );

      reply.send({
        draftId: draft.id,
        content: draft.content,
        message: 'AI draft generated successfully'
      });
    } catch (error) {
      logger.error('AI draft builder error:', error);
      reply.code(500).send({ error: 'AI draft generation failed' });
    }
  });

  // AI Compliance Checker
  fastify.post('/api/ai/compliance-check', {
    preHandler: [rbacMiddleware.requireRole(['bs', 'bs_manager'])]
  }, async (request, reply) => {
    try {
      const { proposalId, clientDocuments } = request.body;

      // Perform compliance check
      const complianceResult = await aiService.checkCompliance({
        proposalId,
        clientDocuments,
        user: request.user
      });

      // Store compliance score
      databaseManager.incrementWriteWPS();

      const conn = databaseManager.getPrimaryConnection();
      const stmt = conn.prepare(`
        INSERT INTO compliance_checks (
          id, proposal_id, check_type, score, issues, recommendations, checked_by, checked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        `COMP_${proposalId}_${Date.now()}`,
        proposalId,
        'ai_compliance',
        complianceResult.score,
        JSON.stringify(complianceResult.issues),
        JSON.stringify(complianceResult.recommendations),
        request.user.id,
        new Date().toISOString()
      );

      reply.send({
        complianceScore: complianceResult.score,
        issues: complianceResult.issues,
        recommendations: complianceResult.recommendations,
        message: 'Compliance check completed'
      });
    } catch (error) {
      logger.error('AI compliance checker error:', error);
      reply.code(500).send({ error: 'Compliance check failed' });
    }
  });

  // AI Weekly Report Generator
  fastify.post('/api/ai/generate-weekly-report', {
    preHandler: [rbacMiddleware.requireRole(['admin', 'gm'])]
  }, async (request, reply) => {
    try {
      const report = await aiService.generateWeeklyReport(request.user);

      // Store report
      databaseManager.incrementWriteWPS();

      // Trigger notification to GM/Directors
      await notificationService.notify({
        type: 'WEEKLY_REPORT',
        report,
        assignedTo: ['gm', 'director'],
        scheduled: true
      });

      reply.send({
        reportId: report.id,
        reportUrl: report.url,
        message: 'Weekly report generated and scheduled for delivery'
      });
    } catch (error) {
      logger.error('AI weekly report error:', error);
      reply.code(500).send({ error: 'Weekly report generation failed' });
    }
  });

  return fastify;
});

// Routes for Dashboard & Analytics (Bab 7 & 13)
app.register(async (fastify) => {
  const fastify = fastify;

  // Main Dashboard with Pipeline & Funnel
  fastify.get('/api/dashboard', {
    preHandler: [rbacMiddleware.requireRole(['admin', 'sales_manager', 'po', 'bs', 'bs_manager', 'pm', 'bidding', 'gm'])]
  }, async (request, reply) => {
    try {
      // Use analytics replica for read-heavy operations
      const conn = databaseManager.getAnalyticsConnection();

      // Pipeline data
      const pipelineData = conn.prepare(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted,
          COUNT(CASE WHEN status = 'won' THEN 1 END) as won,
          COUNT(CASE WHEN status = 'lost' THEN 1 END) as lost
        FROM proposals
      `).get();

      // Funnel data
      const funnelData = conn.prepare(`
        SELECT status, COUNT(*) as count
        FROM proposals
        GROUP BY status
        ORDER BY
          CASE
            WHEN status = 'draft' THEN 1
            WHEN status = 'in_review' THEN 2
            WHEN status = 'approved' THEN 3
            WHEN status = 'submitted' THEN 4
            WHEN status = 'won' THEN 5
            WHEN status = 'lost' THEN 6
          END
      `).all();

      // Revenue data
      const revenueData = conn.prepare(`
        SELECT
          SUM(CASE WHEN status = 'won' THEN estimated_value ELSE 0 END) as total_revenue,
          AVG(CASE WHEN status = 'won' THEN estimated_value ELSE 0 END) as avg_value,
          SUM(estimated_value) as total_value_pipeline
        FROM proposals
      `).get();

      // Team performance
      const teamData = conn.prepare(`
        SELECT
          u.role,
          COUNT(*) as total_proposals,
          COUNT(CASE WHEN status = 'won' THEN 1 END) as won_proposals,
          AVG(p.compliance_score) as avg_compliance
        FROM proposals p
        LEFT JOIN users u ON p.created_by = u.id
        GROUP BY u.role
      `).all();

      reply.send({
        pipeline: {
          total: pipelineData.total,
          submitted: pipelineData.submitted,
          won: pipelineData.won,
          lost: pipelineData.lost,
          winRate: pipelineData.total > 0 ? (pipelineData.won / pipelineData.total * 100) : 0
        },
        funnel: funnelData,
        revenue: revenueData,
        teamPerformance: teamData,
        wps: databaseManager.getCurrentWPS()
      });
    } catch (error) {
      logger.error('Dashboard error:', error);
      reply.code(500).send({ error: 'Dashboard data retrieval failed' });
    }
  });

  // Drill-down for KPI cards
  fastify.get('/api/dashboard/drilldown/:metric', {
    preHandler: [rbacMiddleware.requireRole(['admin', 'sales_manager', 'po', 'bs', 'bs_manager', 'pm', 'bidding', 'gm'])]
  }, async (request, reply) => {
    try {
      const { metric } = request.params;
      const { startDate, endDate, filters } = request.query;

      // Use analytics replica
      const conn = databaseManager.getAnalyticsConnection();

      let query = '';
      let params = [];

      switch (metric) {
        case 'submitted':
          query = `
            SELECT p.*, u.full_name as created_by_name, o.title as opportunity_title
            FROM proposals p
            JOIN opportunities o ON p.opportunity_id = o.id
            LEFT JOIN users u ON p.created_by = u.id
            WHERE p.status = 'submitted'
          `;
          break;
        case 'won':
          query = `
            SELECT p.*, u.full_name as created_by_name, o.title as opportunity_title
            FROM proposals p
            JOIN opportunities o ON p.opportunity_id = o.id
            LEFT JOIN users u ON p.created_by = u.id
            WHERE p.status = 'won'
          `;
          break;
        case 'lost':
          query = `
            SELECT p.*, u.full_name as created_by_name, o.title as opportunity_title
            FROM proposals p
            JOIN opportunities o ON p.opportunity_id = o.id
            LEFT JOIN users u ON p.created_by = u.id
            WHERE p.status = 'lost'
          `;
          break;
        default:
          reply.code(400).send({ error: 'Invalid metric' });
          return;
      }

      if (startDate && endDate) {
        query += ` AND p.created_at BETWEEN ? AND ?`;
        params = [startDate, endDate];
      }

      query += ' ORDER BY p.created_at DESC';

      const stmt = conn.prepare(query);
      const results = stmt.all(...params);

      reply.send({
        metric,
        filters,
        data: results,
        total: results.length
      });
    } catch (error) {
      logger.error('Drill-down error:', error);
      reply.code(500).send({ error: 'Drill-down failed' });
    }
  });

  return fastify;
});

// Routes for Kanban Board (Bab 10)
app.register(async (fastify) => {
  const fastify = fastify;

  // Get kanban lanes and cards
  fastify.get('/api/kanban/:team', {
    preHandler: [rbacMiddleware.requireRole(['bs_manager', 'bs'])]
  }, async (request, reply) => {
    try {
      const { team } = request.params;

      // Use dashboard replica with WebSocket support
      const conn = databaseManager.getDashboardConnection();

      // Get lanes
      const lanes = conn.prepare(`
        SELECT * FROM kanban_lanes
        WHERE team = ?
        ORDER BY position
      `).all(team);

      // Get cards for this team
      const cards = conn.prepare(`
        SELECT c.*, p.title as proposal_title, p.status as proposal_status
        FROM kanban_cards c
        LEFT JOIN proposals p ON c.proposal_id = p.id
        WHERE c.lane_id IN (SELECT id FROM kanban_lanes WHERE team = ?)
        ORDER BY c.position ASC
      `).all(team);

      reply.send({
        lanes,
        cards,
        team
      });
    } catch (error) {
      logger.error('Kanban error:', error);
      reply.code(500).send({ error: 'Kanban data retrieval failed' });
    }
  });

  // Update card position
  fastify.put('/api/kanban/:team/card/:cardId', {
    preHandler: [rbacMiddleware.requireRole(['bs_manager', 'bs'])]
  }, async (request, reply) => {
    try {
      const { team, cardId } = request.params;
      const { laneId, position } = request.body;

      databaseManager.incrementWriteWPS();

      const conn = databaseManager.getDashboardConnection();

      const stmt = conn.prepare(`
        UPDATE kanban_cards
        SET lane_id = ?, position = ?, updated_at = ?
        WHERE id = ?
      `);

      stmt.run(laneId, position, new Date().toISOString(), cardId);

      // Broadcast real-time update via WebSocket
      await databaseManager.getDashboardConnection().prepare(`
        INSERT INTO real_time_updates (update_type, entity_type, entity_id, data, room_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)('card_moved', 'kanban_card', cardId, JSON.stringify({ laneId, position }), team, new Date().toISOString());

      reply.send({
        cardId,
        laneId,
        position,
        message: 'Card position updated successfully'
      });
    } catch (error) {
      logger.error('Kanban card update error:', error);
      reply.code(500).send({ error: 'Card update failed' });
    }
  });

  return fastify;
});

// WebSocket support for real-time updates
fastify.register(require('@fastify/websocket'), (instance) => {
  instance.get('/ws/:team', { websocket: true }, (connection, req) => {
    const { team } = req.params;

    logger.info(`WebSocket connected for team: ${team}`);

    connection.socket.on('message', async (message) => {
      try {
        const data = JSON.parse(message);

        // Broadcast real-time updates to team members
        instance.server.io?.to(team).emit('kanban_update', {
          type: data.type,
          data: data.data,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('WebSocket message error:', error);
      }
    });

    connection.socket.on('close', () => {
      logger.info(`WebSocket disconnected for team: ${team}`);
    });
  });
});

// Routes for Bidding Module (Bab 11)
app.register(async (fastify) => {
  const fastify = fastify;

  // Upload bidding documents
  fastify.post('/api/bidding/upload', {
    preHandler: [rbacMiddleware.requireRole(['bidding'])]
  }, async (request, reply) => {
    try {
      const file = await request.file();
      const { proposalId } = request.body;

      // Handle file upload
      const uploadResult = await file.toBuffer();

      // Store in DMS metadata
      const dmsConn = databaseManager.getDMSConnection();
      const fileId = `DOC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const stmt = dmsConn.prepare(`
        INSERT INTO dms_files (
          id, folder_id, filename, file_path, file_type, file_size,
          mime_type, checksum, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        fileId,
        `PROJECT_${proposalId}/bidding_docs`,
        file.filename,
        `projects/PROJECT_${proposalId}/bidding_docs/${file.filename}`,
        file.type,
        uploadResult.length,
        file.mimetype,
        require('crypto').createHash('md5').update(uploadResult).digest('hex'),
        request.user.id,
        new Date().toISOString()
      );

      // AI Document Indexer
      const indexingResult = await aiService.indexDocument(fileId, proposalId);

      reply.send({
        fileId,
        filename: file.filename,
        indexingResult,
        message: 'Document uploaded and indexed successfully'
      });
    } catch (error) {
      logger.error('Bidding upload error:', error);
      reply.code(500).send({ error: 'Document upload failed' });
    }
  });

  // Get bidding documents
  fastify.get('/api/bidding/documents/:proposalId', {
    preHandler: [rbacMiddleware.requireRole(['bidding', 'bs_manager'])]
  }, async (request, reply) => {
    try {
      const { proposalId } = request.params;

      const dmsConn = databaseManager.getDMSConnection();

      const stmt = dmsConn.prepare(`
        SELECT f.*, u.full_name as uploaded_by_name
        FROM dms_files f
        LEFT JOIN users u ON f.created_by = u.id
        WHERE f.folder_id = ?
        ORDER BY f.created_at DESC
      `);

      const documents = stmt.all(`PROJECT_${proposalId}/bidding_docs`);

      reply.send({
        proposalId,
        documents,
        total: documents.length
      });
    } catch (error) {
      logger.error('Get bidding documents error:', error);
      reply.code(500).send({ error: 'Document retrieval failed' });
    }
  });

  // Download proposal final
  fastify.get('/api/bidding/download/:proposalId', {
    preHandler: [rbacMiddleware.requireRole(['bidding', 'bs_manager'])]
  }, async (request, reply) => {
    try {
      const { proposalId } = request.params;

      // Get proposal file path from primary database
      const conn = databaseManager.getPrimaryConnection();
      const proposal = conn.prepare(
        'SELECT file_path FROM proposals WHERE id = ?'
      ).get(proposalId);

      if (!proposal || !proposal.file_path) {
        reply.code(404).send({ error: 'Proposal file not found' });
        return;
      }

      // Check if file exists and serve it
      if (fs.existsSync(proposal.file_path)) {
        const fileBuffer = fs.readFileSync(proposal.file_path);
        reply.type('application/octet-stream').send(fileBuffer);
      } else {
        reply.code(404).send({ error: 'File not found' });
      }
    } catch (error) {
      logger.error('Download error:', error);
      reply.code(500).send({ error: 'Download failed' });
    }
  });

  return fastify;
});

// Routes for DMS (Bab 8)
app.register(async (fastify) => {
  const fastify = fastify;

  // Create folder
  fastify.post('/api/dms/folders', {
    preHandler: [rbacMiddleware.requireRole(['admin', 'bs_manager'])]
  }, async (request, reply) => {
    try {
      const { name, parentId, projectId } = request.body;

      const folderId = `FOLDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const dmsConn = databaseManager.getDMSConnection();

      const stmt = dmsConn.prepare(`
        INSERT INTO dms_folders (
          id, project_id, parent_id, name, path, folder_type, permissions, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        folderId,
        projectId,
        parentId || null,
        name,
        `/projects/PROJECT_${projectId}/${name}`,
        'custom',
        JSON.stringify({ read: ['all'], write: ['bs', 'bidding'] }),
        request.user.id,
        new Date().toISOString()
      );

      reply.send({
        folderId,
        name,
        path: `/projects/PROJECT_${projectId}/${name}`,
        message: 'Folder created successfully'
      });
    } catch (error) {
      logger.error('Create folder error:', error);
      reply.code(500).send({ error: 'Folder creation failed' });
    }
  });

  // Upload file
  fastify.post('/api/dms/upload', {
    preHandler: [rbacMiddleware.requireRole(['admin', 'bs', 'bidding'])]
  }, async (request, reply) => {
    try {
      const file = await request.file();
      const { folderId } = request.body;

      const uploadResult = await file.toBuffer();
      const fileId = `FILE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const dmsConn = databaseManager.getDMSConnection();

      const stmt = dmsConn.prepare(`
        INSERT INTO dms_files (
          id, folder_id, filename, file_path, file_type, file_size,
          mime_type, checksum, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        fileId,
        folderId,
        file.filename,
        `${folderId}/${file.filename}`,
        file.type,
        uploadResult.length,
        file.mimetype,
        require('crypto').createHash('md5').update(uploadResult).digest('hex'),
        request.user.id,
        new Date().toISOString()
      );

      reply.send({
        fileId,
        filename: file.filename,
        message: 'File uploaded successfully'
      });
    } catch (error) {
      logger.error('DMS upload error:', error);
      reply.code(500).send({ error: 'File upload failed' });
    }
  });

  // Get folder contents
  fastify.get('/api/dms/folders/:folderId', {
    preHandler: [rbacMiddleware.requireRole(['admin', 'bs', 'bidding'])]
  }, async (request, reply) => {
    try {
      const { folderId } = request.params;

      const dmsConn = databaseManager.getDMSConnection();

      // Get folders
      const folders = dmsConn.prepare(`
        SELECT * FROM dms_folders WHERE parent_id = ? ORDER BY name
      `).all(folderId);

      // Get files
      const files = dmsConn.prepare(`
        SELECT * FROM dms_files WHERE folder_id = ? ORDER BY filename
      `).all(folderId);

      reply.send({
        folderId,
        folders,
        files,
        total: folders.length + files.length
      });
    } catch (error) {
      logger.error('Get DMS contents error:', error);
      reply.code(500).send({ error: 'DMS retrieval failed' });
    }
  });

  // Download file with signed URL
  fastify.get('/api/dms/download/:fileId', {
    preHandler: [rbacMiddleware.requireRole(['admin', 'bs', 'bidding'])]
  }, async (request, reply) => {
    try {
      const { fileId } = request.params;

      const dmsConn = databaseManager.getDMSConnection();
      const file = dmsConn.prepare(
        'SELECT * FROM dms_files WHERE id = ?'
      ).get(fileId);

      if (!file) {
        reply.code(404).send({ error: 'File not found' });
        return;
      }

      // Generate signed URL (in production, use object storage signed URLs)
      const signedUrl = `/api/dms/file/${fileId}/download?token=${generateSignedToken(fileId)}`;

      // Update access log
      await databaseManager.getAuditConnection().prepare(`
        INSERT INTO dms_access_logs (file_id, user_id, action, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(fileId, request.user.id, 'download', request.ip, request.headers['user-agent'], new Date().toISOString());

      reply.send({
        fileId,
        filename: file.filename,
        signedUrl,
        message: 'Signed URL generated'
      });
    } catch (error) {
      logger.error('DMS download error:', error);
      reply.code(500).send({ error: 'Download failed' });
    }
  });

  // Download file with token
  fastify.get('/api/dms/file/:fileId/download', {
    preHandler: [rbacMiddleware.requireRole(['admin', 'bs', 'bidding'])]
  }, async (request, reply) => {
    try {
      const { fileId } = request.params;
      const { token } = request.query;

      // Verify token
      if (!verifySignedToken(fileId, token)) {
        reply.code(401).send({ error: 'Invalid download token' });
        return;
      }

      const dmsConn = databaseManager.getDMSConnection();
      const file = dmsConn.prepare(
        'SELECT * FROM dms_files WHERE id = ?'
      ).get(fileId);

      if (!file || !fs.existsSync(file.file_path)) {
        reply.code(404).send({ error: 'File not found' });
        return;
      }

      const fileBuffer = fs.readFileSync(file.file_path);
      reply.type(file.mime_type).send(fileBuffer);
    } catch (error) {
      logger.error('File download error:', error);
      reply.code(500).send({ error: 'Download failed' });
    }
  });

  return fastify;
});

// Routes for Settings & Admin (Bab 13)
app.register(async (fastify) => {
  const fastify = fastify;

  // Get system settings
  fastify.get('/api/settings', {
    preHandler: [rbacMiddleware.requireRole(['admin'])]
  }, async (request, reply) => {
    try {
      // Get all system parameters
      const settings = {
        general: {
          systemName: 'Enterprise Proposal System',
          version: '2.0.0',
          maxUsers: 1000,
          defaultRole: 'user',
          sessionTimeout: 3600
        },
        sla: {
          approvalTimeLimit: 48, // hours
          complianceScoreThreshold: 80,
          maxFileSize: 10 // MB
        },
        notifications: {
          smtpHost: process.env.SMTP_HOST,
          smtpPort: process.env.SMTP_PORT,
          slackWebhook: process.env.SLACK_WEBHOOK,
          teamsWebhook: process.env.TEAMS_WEBHOOK
        },
        templates: {
          defaultTemplate: 'standard',
          templateCount: 13,
          customTemplatesEnabled: true
        }
      };

      reply.send({ settings });
    } catch (error) {
      logger.error('Get settings error:', error);
      reply.code(500).send({ error: 'Settings retrieval failed' });
    }
  });

  // Update system settings
  fastify.put('/api/settings', {
    preHandler: [rbacMiddleware.requireRole(['admin'])]
  }, async (request, reply) => {
    try {
      const { settings } = request.body;

      // Log audit
      await auditLogger.log({
        action: 'SETTINGS_UPDATE',
        entity_type: 'SYSTEM',
        entity_id: 'system_settings',
        user_id: request.user.id,
        user_role: request.user.role,
        old_values: JSON.stringify({}),
        new_values: JSON.stringify(settings)
      });

      reply.send({
        message: 'Settings updated successfully',
        settings
      });
    } catch (error) {
      logger.error('Update settings error:', error);
      reply.code(500).send({ error: 'Settings update failed' });
    }
  });

  return fastify;
});

// Routes for Progress Tracking (Bab 14)
app.register(async (fastify) => {
  const fastify = fastify;

  // Create milestone
  fastify.post('/api/proposals/:proposalId/milestones', {
    preHandler: [rbacMiddleware.requireRole(['pm', 'bs', 'bs_manager'])]
  }, async (request, reply) => {
    try {
      const { proposalId } = request.params;
      const { milestones } = request.body;

      databaseManager.incrementWriteWPS();

      const conn = databaseManager.getPrimaryConnection();

      for (const milestone of milestones) {
        const stmt = conn.prepare(`
          INSERT INTO milestones (id, proposal_id, title, description, due_date, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          `MILESTONE_${proposalId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          proposalId,
          milestone.title,
          milestone.description,
          milestone.dueDate,
          milestone.status || 'pending',
          new Date().toISOString(),
          new Date().toISOString()
        );
      }

      reply.send({
        message: 'Milestones created successfully',
        count: milestones.length
      });
    } catch (error) {
      logger.error('Create milestones error:', error);
      reply.code(500).send({ error: 'Milestone creation failed' });
    }
  });

  // Get milestones
  fastify.get('/api/proposals/:proposalId/milestones', {
    preHandler: [rbacMiddleware.requireRole(['pm', 'bs', 'bs_manager', 'admin'])]
  }, async (request, reply) => {
    try {
      const { proposalId } = request.params;

      const conn = databaseManager.getDashboardConnection();
      const milestones = conn.prepare(`
        SELECT * FROM milestones
        WHERE proposal_id = ?
        ORDER BY due_date ASC
      `).all(proposalId);

      reply.send({
        proposalId,
        milestones,
        total: milestones.length
      });
    } catch (error) {
      logger.error('Get milestones error:', error);
      reply.code(500).send({ error: 'Milestone retrieval failed' });
    }
  });

  // Update milestone
  fastify.put('/api/milestones/:milestoneId', {
    preHandler: [rbacMiddleware.requireRole(['pm', 'bs', 'bs_manager'])]
  }, async (request, reply) => {
    try {
      const { milestoneId } = request.params;
      const { status, notes } = request.body;

      databaseManager.incrementWriteWPS();

      const conn = databaseManager.getPrimaryConnection();

      const stmt = conn.prepare(`
        UPDATE milestones
        SET status = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `);

      stmt.run(status, notes, new Date().toISOString(), milestoneId);

      reply.send({
        milestoneId,
        status,
        message: 'Milestone updated successfully'
      });
    } catch (error) {
      logger.error('Update milestone error:', error);
      reply.code(500).send({ error: 'Milestone update failed' });
    }
  });

  // Get Gantt chart data
  fastify.get('/api/proposals/:proposalId/gantt', {
    preHandler: [rbacMiddleware.requireRole(['pm', 'bs', 'bs_manager', 'admin'])]
  }, async (request, reply) => {
    try {
      const { proposalId } = request.params;

      const conn = databaseManager.getDashboardConnection();

      // Get milestones
      const milestones = conn.prepare(`
        SELECT * FROM milestones
        WHERE proposal_id = ?
        ORDER BY due_date ASC
      `).all(proposalId);

      // Get tasks
      const tasks = conn.prepare(`
        SELECT * FROM tasks
        WHERE proposal_id = ?
        ORDER BY due_date ASC
      `).all(proposalId);

      reply.send({
        proposalId,
        milestones,
        tasks,
        total: milestones.length + tasks.length
      });
    } catch (error) {
      logger.error('Get Gantt data error:', error);
      reply.code(500).send({ error: 'Gantt data retrieval failed' });
    }
  });

  return fastify;
});

// Routes for Issue Tracking (Bab 14)
app.register(async (fastify) => {
  const fastify = fastify;

  // Create issue
  fastify.post('/api/issues', {
    preHandler: [rbacMiddleware.requireRole(['pm', 'bs', 'bs_manager', 'admin'])]
  }, async (request, reply) => {
    try {
      const { title, description, severity, assignedTo, proposalId } = request.body;

      databaseManager.incrementWriteWPS();

      const conn = databaseManager.getPrimaryConnection();

      const stmt = conn.prepare(`
        INSERT INTO issues (id, title, description, severity, assigned_to, proposal_id, status, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        `ISSUE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title,
        description,
        severity || 'medium',
        assignedTo,
        proposalId,
        'open',
        request.user.id,
        new Date().toISOString()
      );

      // Notify assigned user
      await notificationService.notify({
        type: 'ISSUE_ASSIGNED',
        issueId: `ISSUE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title,
        assignedTo,
        severity,
        message: `New issue assigned: ${title}`
      });

      reply.send({
        message: 'Issue created successfully'
      });
    } catch (error) {
      logger.error('Create issue error:', error);
      reply.code(500).send({ error: 'Issue creation failed' });
    }
  });

  // Get issues
  fastify.get('/api/issues', {
    preHandler: [rbacMiddleware.requireRole(['pm', 'bs', 'bs_manager', 'admin'])]
  }, async (request, reply) => {
    try {
      const { status, severity, assignedTo } = request.query;

      let query = 'SELECT * FROM issues';
      const params = [];

      if (status) {
        query += ' WHERE status = ?';
        params.push(status);
      }

      if (severity) {
        query += status ? ' AND severity = ?' : ' WHERE severity = ?';
        params.push(severity);
      }

      if (assignedTo) {
        query += (status || severity) ? ' AND assigned_to = ?' : ' WHERE assigned_to = ?';
        params.push(assignedTo);
      }

      query += ' ORDER BY created_at DESC';

      const conn = databaseManager.getDashboardConnection();
      const stmt = conn.prepare(query);
      const issues = stmt.all(...params);

      reply.send({
        issues,
        total: issues.length
      });
    } catch (error) {
      logger.error('Get issues error:', error);
      reply.code(500).send({ error: 'Issue retrieval failed' });
    }
  });

  return fastify;
});

// Routes for Reporting & Export (Bab 7)
app.register(async (fastify) => {
  const fastify = fastify;

  // Export to Excel
  fastify.get('/api/reports/proposals/excel', {
    preHandler: [rbacMiddleware.requireRole(['admin', 'sales_manager', 'gm'])]
  }, async (request, reply) => {
    try {
      const { startDate, endDate, filters } = request.query;

      // Use analytics replica for read-heavy operation
      const conn = databaseManager.getAnalyticsConnection();

      let query = `
        SELECT
          p.id, p.title, p.status, p.client_name, p.estimated_value, p.currency,
          p.created_at, p.submitted_at, p.approved_at,
          u.full_name as created_by_name,
          o.title as opportunity_title
        FROM proposals p
        LEFT JOIN users u ON p.created_by = u.id
        LEFT JOIN opportunities o ON p.opportunity_id = o.id
      `;

      const params = [];

      if (startDate && endDate) {
        query += ' WHERE p.created_at BETWEEN ? AND ?';
        params.push(startDate, endDate);
      }

      query += ' ORDER BY p.created_at DESC';

      const stmt = conn.prepare(query);
      const proposals = stmt.all(...params);

      // Convert to Excel format (using exceljs)
      const ExcelJS = await import('exceljs');

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Proposals Report');

      worksheet.columns = [
        'ID', 'Title', 'Client', 'Status', 'Value', 'Currency',
        'Created By', 'Opportunity', 'Created At', 'Submitted At', 'Approved At'
      ];

      proposals.forEach(proposal => {
        worksheet.addRow([
          proposal.id,
          proposal.title,
          proposal.client_name,
          proposal.status,
          proposal.estimated_value,
          proposal.currency,
          proposal.created_by_name,
          proposal.opportunity_title,
          proposal.created_at,
          proposal.submitted_at,
          proposal.approved_at
        ]);
      });

      const buffer = await workbook.xlsx.writeBuffer();

      reply.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      reply.send(buffer);
    } catch (error) {
      logger.error('Excel export error:', error);
      reply.code(500).send({ error: 'Export failed' });
    }
  });

  // Export to CSV
  fastify.get('/api/reports/proposals/csv', {
    preHandler: [rbacMiddleware.requireRole(['admin', 'sales_manager', 'gm'])]
  }, async (request, reply) => {
    try {
      const { startDate, endDate, filters } = request.query;

      const conn = databaseManager.getAnalyticsConnection();

      let query = `
        SELECT
          p.id, p.title, p.status, p.client_name, p.estimated_value, p.currency,
          p.created_at, p.submitted_at, p.approved_at,
          u.full_name as created_by_name,
          o.title as opportunity_title
        FROM proposals p
        LEFT JOIN users u ON p.created_by = u.id
        LEFT JOIN opportunities o ON p.opportunity_id = o.id
      `;

      const params = [];

      if (startDate && endDate) {
        query += ' WHERE p.created_at BETWEEN ? AND ?';
        params.push(startDate, endDate);
      }

      query += ' ORDER BY p.created_at DESC';

      const stmt = conn.prepare(query);
      const proposals = stmt.all(...params);

      // Convert to CSV
      const csvHeader = [
        'ID', 'Title', 'Client', 'Status', 'Value', 'Currency',
        'Created By', 'Opportunity', 'Created At', 'Submitted At', 'Approved At'
      ];

      const csvRows = proposals.map(proposal => [
        proposal.id,
        proposal.title,
        proposal.client_name,
        proposal.status,
        proposal.estimated_value,
        proposal.currency,
        proposal.created_by_name,
        proposal.opportunity_title,
        proposal.created_at,
        proposal.submitted_at,
        proposal.approved_at
      ]);

      const csvContent = [csvHeader, ...csvRows].map(row => row.join(',')).join('\n');

      reply.type('text/csv');
      reply.send(csvContent);
    } catch (error) {
      logger.error('CSV export error:', error);
      reply.code(500).send({ error: 'Export failed' });
    }
  });

  return fastify;
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

    // Initialize databases
    await databaseManager.initialize();

    // Load environment variables
    if (!process.env.JWT_SECRET) {
      logger.warn('⚠️ JWT_SECRET not set in environment variables. Using default.');
    }

    // Start server
    const port = process.env.PORT || 8000;
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });

    logger.info(`✅ Server running on http://${host}:${port}`);
    logger.info('📊 API Documentation: http://localhost:${port}/api/documentation');

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Gracefully shutting down...');
  await databaseManager.close();
  process.exit(0);
});

start();
```

## 🚀 **3. Notification Service - Event-Driven System**
