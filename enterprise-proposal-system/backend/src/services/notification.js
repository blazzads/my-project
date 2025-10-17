/**
 * Enterprise Proposal System - Notification Service
 * Event-Driven Notification System (Bab 7)
 *
 * Features:
 * - Event-driven triggers from application layer
 * - Multiple channels: In-app, Email, Slack/Teams
 * - Smart batching and rate limiting
 * - AI-powered notification prioritization
 * - RabbitMQ/Kafka integration ready
 */

import EventEmitter from 'events';
import winston from 'winston';
import fs from 'fs/promises';
import path from 'path';

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}] [NOTIFICATION]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/notification.log',
      level: 'info'
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Notification Channels
const NotificationChannels = {
  IN_APP: 'in_app',
  EMAIL: 'email',
  SLACK: 'slack',
  TEAMS: 'teams'
};

// Notification Types
const NotificationTypes = {
  PROPOSAL_CREATED: 'proposal_created',
  PROPOSAL_UPDATED: 'proposal_updated',
  PROPOSAL_APPROVED: 'proposal_approved',
  PROPOSAL_SUBMITTED: 'proposal_submitted',
  PROPOSAL_WON: 'proposal_won',
  PROPOSAL_LOST: 'proposal_lost',
  TASK_ASSIGNED: 'task_assigned',
  TASK_COMPLETED: 'task_completed',
  TASK_OVERDUE: 'task_overdue',
  DEADLINE_ALERT: 'deadline_alert',
  COMPLIANCE_LOW: 'compliance_low',
  RFP_PARSED: 'rfp_parsed',
  AI_DRAFT_GENERATED: 'ai_draft_generated',
  AI_COMPLIANCE_CHECKED: 'ai_compliance_checked',
  WEEKLY_REPORT_GENERATED: 'weekly_report_generated',
  DOCUMENT_UPLOADED: 'document_uploaded',
  APPROVAL_REQUIRED: 'approval_required',
  ESCALATION: 'escalation'
};

// Notification Priorities
const NotificationPriorities = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
  CRITICAL: 5
};

class NotificationService extends EventEmitter {
  constructor() {
    super();
    this.notificationQueue = [];
    this.batchSize = 10;
    this.batchTimeout = 5000; // 5 seconds
    this.batchTimer = null;
    this.rateLimiters = new Map();
    this.userPreferences = new Map();
    this.aiPrioritizer = new AIPrioritizer();
    this.channels = new Map();

    // Initialize channels
    this.initializeChannels();

    // Start batch processing
    this.startBatchProcessor();

    logger.info('Notification Service initialized with event-driven architecture');
  }

  /**
   * Initialize notification channels
   */
  initializeChannels() {
    // In-App Channel
    this.channels.set(NotificationChannels.IN_APP, new InAppChannel());

    // Email Channel
    this.channels.set(NotificationChannels.EMAIL, new EmailChannel());

    // Slack Channel
    this.channels.set(NotificationChannels.SLACK, new SlackChannel());

    // Teams Channel
    this.channels.set(NotificationChannels.TEAMS, new TeamsChannel());

    logger.info('All notification channels initialized');
  }

  /**
   * Publish event - Main entry point for notifications
   * Called after successful write transactions to primary database
   */
  async publish(eventType, data) {
    try {
      logger.info(`Publishing event: ${eventType}`, data);

      // Generate notification data
      const notification = await this.generateNotification(eventType, data);

      // AI-powered prioritization
      const prioritizedNotification = await this.aiPrioritizer.prioritize(notification);

      // Check rate limiting
      if (this.isRateLimited(prioritizedNotification)) {
        logger.warn(`Rate limited notification for user: ${prioritizedNotification.userId}`);
        return;
      }

      // Queue for batch processing
      this.notificationQueue.push(prioritizedNotification);

      // Trigger batch processing if not already scheduled
      if (!this.batchTimer) {
        this.scheduleBatchProcessing();
      }

      // Emit event for WebSocket real-time updates
      this.emit('notification', prioritizedNotification);

    } catch (error) {
      logger.error(`Failed to publish event ${eventType}:`, error);
    }
  }

  /**
   * Generate notification data
   */
  async generateNotification(eventType, data) {
    const timestamp = new Date().toISOString();

    const baseNotification = {
      id: `NOTIF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      timestamp,
      data: {
        ...data,
        generatedAt: timestamp
      }
    };

    // Type-specific notification generation
    switch (eventType) {
      case NotificationTypes.PROPOSAL_CREATED:
        return {
          ...baseNotification,
          title: `Proposal Created: ${data.title}`,
          message: `New proposal "${data.title}" created by ${data.createdBy?.full_name || 'Unknown'}`,
          priority: NotificationPriorities.MEDIUM,
          channels: [NotificationChannels.IN_APP, NotificationChannels.EMAIL],
          metadata: {
            proposalId: data.proposalId,
            category: data.category,
            clientName: data.clientName,
            estimatedValue: data.estimatedValue
          }
        };

      case NotificationTypes.PROPOSAL_APPROVED:
        return {
          ...baseNotification,
          title: `Proposal Approved: ${data.title}`,
          message: `Proposal "${data.title}" has been approved by ${data.approvedBy?.full_name || 'Unknown'}`,
          priority: NotificationPriorities.HIGH,
          channels: [NotificationChannels.IN_APP, NotificationChannels.EMAIL, NotificationChannels.SLACK],
          metadata: {
            proposalId: data.proposalId,
            approvedBy: data.approvedBy,
            approvedAt: data.approvedAt
          }
        };

      case NotificationTypes.PROPOSAL_SUBMITTED:
        return {
          ...baseNotification,
          title: `Proposal Submitted: ${data.title}`,
          message: `Proposal "${data.title}" has been submitted to client`,
          priority: NotificationPriorities.HIGH,
          channels: [NotificationChannels.IN_APP, NotificationChannels.EMAIL, NotificationChannels.TEAMS],
          metadata: {
            proposalId: data.proposalId,
            submittedAt: data.submittedAt
          }
        };

      case NotificationTypes.TASK_ASSIGNED:
        return {
          ...baseNotification,
          title: `Task Assigned: ${data.title}`,
          message: `Task "${data.title}" assigned to ${data.assignedTo?.full_name || 'Unknown'}`,
          priority: NotificationPriorities.MEDIUM,
          channels: [NotificationChannels.IN_APP, NotificationChannels.EMAIL],
          metadata: {
            taskId: data.taskId,
            assignedTo: data.assignedTo,
            dueDate: data.dueDate,
            priority: data.priority
          }
        };

      case NotificationTypes.DEADLINE_ALERT:
        return {
          ...baseNotification,
          title: `Deadline Alert: ${data.taskTitle}`,
          message: `Task "${data.taskTitle}" is due soon or overdue!`,
          priority: NotificationPriorities.URGENT,
          channels: [NotificationChannels.IN_APP, NotificationChannels.EMAIL, NotificationChannels.SLACK],
          metadata: {
            taskId: data.taskId,
            dueDate: data.dueDate,
            overdue: data.overdue
          }
        };

      case NotificationTypes.COMPLIANCE_LOW:
        return {
          ...baseNotification,
          title: `Low Compliance Score: ${data.proposalTitle}`,
          message: `Proposal "${data.proposalTitle}" has low compliance score: ${data.score}/100`,
          priority: NotificationPriorities.HIGH,
          channels: [NotificationChannels.IN_APP, NotificationChannels.EMAIL],
          metadata: {
            proposalId: data.proposalId,
            score: data.score,
            issues: data.issues
          }
        };

      case NotificationTypes.AI_DRAFT_GENERATED:
        return {
          ...baseNotification,
          title: `AI Draft Generated: ${data.proposalTitle}`,
          message: `AI draft generated for proposal "${data.proposalTitle}"`,
          priority: NotificationPriorities.MEDIUM,
          channels: [NotificationChannels.IN_APP, NotificationChannels.EMAIL],
          metadata: {
            proposalId: data.proposalId,
            aiModel: data.aiModel,
            confidence: data.confidence
          }
        };

      case NotificationTypes.ESCALATION:
        return {
          ...baseNotification,
          title: `Escalation Required: ${data.title}`,
          message: `Escalation required for: ${data.description}`,
          priority: NotificationPriorities.CRITICAL,
          channels: [NotificationChannels.IN_APP, NotificationChannels.EMAIL, NotificationChannels.SLACK, NotificationChannels.TEAMS],
          metadata: {
            escalationType: data.escalationType,
            reason: data.reason,
            escalatedTo: data.escalatedTo
          }
        };

      default:
        return {
          ...baseNotification,
          title: `Notification: ${eventType}`,
          message: `Event occurred: ${eventType}`,
          priority: NotificationPriorities.LOW,
          channels: [NotificationChannels.IN_APP],
          metadata: data
        };
    }
  }

  /**
   * Check if notification is rate limited
   */
  isRateLimited(notification) {
    const userId = notification.userId || notification.data?.userId;
    if (!userId) return false;

    const now = Date.now();
    const userLimit = this.rateLimiters.get(userId);

    if (userLimit) {
      const timeSinceLastNotification = now - userLimit.lastNotification;
      const minInterval = this.getMinInterval(notification.priority);

      if (timeSinceLastNotification < minInterval) {
        return true;
      }
    }

    // Update rate limit tracker
    this.rateLimiters.set(userId, {
      lastNotification: now,
      count: (userLimit?.count || 0) + 1
    });

    return false;
  }

  /**
   * Get minimum interval based on priority
   */
  getMinInterval(priority) {
    const intervals = {
      [NotificationPriorities.LOW]: 60000,      // 1 minute
      [NotificationPriorities.MEDIUM]: 30000,    // 30 seconds
      [NotificationPriorities.HIGH]: 15000,     // 15 seconds
      [NotificationPriorities.URGENT]: 5000,    // 5 seconds
      [NotificationPriorities.CRITICAL]: 1000    // 1 second
    };

    return intervals[priority] || intervals[NotificationPriorities.LOW];
  }

  /**
   * Schedule batch processing
   */
  scheduleBatchProcessing() {
    this.batchTimer = setTimeout(() => {
      this.processBatch();
      this.batchTimer = null;
    }, this.batchTimeout);
  }

  /**
   * Process notification batch
   */
  async processBatch() {
    if (this.notificationQueue.length === 0) {
      return;
    }

    try {
      const batch = this.notificationQueue.splice(0, this.batchSize);
      logger.info(`Processing notification batch: ${batch.length} notifications`);

      // Smart batching - group by channel and priority
      const batchedByChannel = this.groupBatchByChannel(batch);

      // Process each channel's batch
      for (const [channel, notifications] of batchedByChannel) {
        await this.processChannelBatch(channel, notifications);
      }

      // Check if more notifications need processing
      if (this.notificationQueue.length > 0) {
        this.scheduleBatchProcessing();
      }
    } catch (error) {
      logger.error('Error processing notification batch:', error);
    }
  }

  /**
   * Group batch by channel
   */
  groupBatchByChannel(batch) {
    const grouped = new Map();

    for (const notification of batch) {
      for (const channel of notification.channels) {
        if (!grouped.has(channel)) {
          grouped.set(channel, []);
        }
        grouped.get(channel).push(notification);
      }
    }

    return grouped;
  }

  /**
   * Process batch for specific channel
   */
  async processChannelBatch(channel, notifications) {
    const channelInstance = this.channels.get(channel);

    if (!channelInstance) {
      logger.warn(`Channel ${channel} not found`);
      return;
    }

    try {
      // Sort by priority for proper processing order
      notifications.sort((a, b) => b.priority - a.priority);

      await channelInstance.sendBatch(notifications);
      logger.info(`Sent ${notifications.length} notifications via ${channel}`);
    } catch (error) {
      logger.error(`Error processing batch for channel ${channel}:`, error);
    }
  }

  /**
   * Start batch processor
   */
  startBatchProcessor() {
    setInterval(() => {
      if (this.notificationQueue.length > 0) {
        this.processBatch();
      }
    }, this.batchTimeout);
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId) {
    if (this.userPreferences.has(userId)) {
      return this.userPreferences.get(userId);
    }

    // Load from database or cache
    const preferences = await this.loadUserPreferences(userId);
    this.userPreferences.set(userId, preferences);

    return preferences;
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId, preferences) {
    this.userPreferences.set(userId, preferences);
    await this.saveUserPreferences(userId, preferences);
  }

  /**
   * Load user preferences from database
   */
  async loadUserPreferences(userId) {
    try {
      // In production, load from database
      return {
        userId,
        channels: {
          [NotificationChannels.IN_APP]: true,
          [NotificationChannels.EMAIL]: true,
          [NotificationChannels.SLACK]: false,
          [NotificationChannels.TEAMS]: false
        },
        types: {
          [NotificationTypes.PROPOSAL_CREATED]: true,
          [NotificationTypes.PROPOSAL_APPROVED]: true,
          [NotificationTypes.DEADLINE_ALERT]: true
        },
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00'
        },
        doNotDisturb: {
          enabled: false
        }
      };
    } catch (error) {
      logger.error(`Error loading preferences for user ${userId}:`, error);
      return {};
    }
  }

  /**
   * Save user preferences to database
   */
  async saveUserPreferences(userId, preferences) {
    try {
      // In production, save to database
      logger.info(`Saved preferences for user ${userId}`);
    } catch (error) {
      logger.error(`Error saving preferences for user ${userId}:`, error);
    }
  }

  /**
   * Get notification statistics
   */
  getStatistics() {
    return {
      queueLength: this.notificationQueue.length,
      batchSize: this.batchSize,
      batchTimeout: this.batchTimeout,
      activeChannels: Array.from(this.channels.keys()),
      rateLimitedUsers: this.rateLimiters.size,
      totalProcessed: this.getTotalProcessed()
    };
  }

  /**
   * Get total processed notifications count
   */
  getTotalProcessed() {
    // In production, track in database
    return Math.floor(Math.random() * 10000); // Mock for now
  }
}

/**
 * AI-Powered Notification Prioritizer
 */
class AIPrioritizer {
  constructor() {
    this.rules = [
      {
        condition: (notification) => notification.priority === NotificationPriorities.CRITICAL,
        adjustment: 2,
        reason: 'Critical priority escalation'
      },
      {
        condition: (notification) => notification.type === NotificationTypes.ESCALATION,
        adjustment: 2,
        reason: 'Escalation event'
      },
      {
        condition: (notification) => notification.type === NotificationTypes.DEADLINE_ALERT,
        adjustment: 1,
        reason: 'Deadline alert'
      },
      {
        condition: (notification) => notification.type === NotificationTypes.COMPLIANCE_LOW,
        adjustment: 1,
        reason: 'Low compliance score'
      },
      {
        condition: (notification) => notification.data?.estimatedValue > 1000000,
        adjustment: 1,
        reason: 'High value proposal'
      },
      {
        condition: (notification) => notification.metadata?.clientName?.includes('Strategic'),
        adjustment: 1,
        reason: 'Strategic client'
      }
    ];
  }

  async prioritize(notification) {
    let adjustedNotification = { ...notification };

    for (const rule of this.rules) {
      if (rule.condition(notification)) {
        adjustedNotification.priority = Math.min(
          adjustedNotification.priority + rule.adjustment,
          NotificationPriorities.CRITICAL
        );

        adjustedNotification.metadata = {
          ...adjustedNotification.metadata,
          prioritizationReason: rule.reason,
          originalPriority: notification.priority
        };

        break; // Apply first matching rule
      }
    }

    return adjustedNotification;
  }
}

/**
 * In-App Notification Channel
 */
class InAppChannel {
  constructor() {
    this.connectedClients = new Map();
  }

  async sendBatch(notifications) {
    for (const notification of notifications) {
      // Broadcast to connected clients via WebSocket
      this.broadcast(notification);
    }
  }

  broadcast(notification) {
    // WebSocket implementation would go here
    this.emit('notification', {
      type: 'in_app',
      notification
    });
  }

  // WebSocket connection management
  addConnection(clientId, ws) {
    this.connectedClients.set(clientId, ws);
  }

  removeConnection(clientId) {
    this.connectedClients.delete(clientId);
  }

  emit(event, data) {
    // Emit to all connected clients
    for (const [clientId, ws] of this.connectedClients) {
      try {
        ws.send(JSON.stringify({
          event,
          data,
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        logger.error(`Error sending to client ${clientId}:`, error);
        this.removeConnection(clientId);
      }
    }
  }
}

/**
 * Email Notification Channel
 */
class EmailChannel {
  constructor() {
    this.smtpConfig = {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    };
  }

  async sendBatch(notifications) {
    try {
      // Group notifications by recipient
      const groupedByRecipient = this.groupByRecipient(notifications);

      for (const [recipient, recipientNotifications] of groupedByRecipient) {
        await this.sendEmail(recipient, recipientNotifications);
      }
    } catch (error) {
      logger.error('Error sending email batch:', error);
    }
  }

  groupByRecipient(notifications) {
    const grouped = new Map();

    for (const notification of notifications) {
      const recipient = this.getRecipient(notification);

      if (!grouped.has(recipient)) {
        grouped.set(recipient, []);
      }
      grouped.get(recipient).push(notification);
    }

    return grouped;
  }

  getRecipient(notification) {
    // Extract recipient from notification data
    return notification.data?.assignedTo?.email ||
           notification.data?.createdBy?.email ||
           notification.userId;
  }

  async sendEmail(recipient, notifications) {
    try {
      // Aggregate notifications into single email
      const emailData = this.aggregateNotifications(notifications);

      const emailHtml = this.generateEmailHTML(emailData);

      // Send email using SMTP service
      await this.sendSMTP({
        to: recipient,
        subject: emailData.subject,
        html: emailHtml,
        text: emailData.text
      });

      logger.info(`Email sent to ${recipient} with ${notifications.length} notifications`);
    } catch (error) {
      logger.error(`Error sending email to ${recipient}:`, error);
    }
  }

  aggregateNotifications(notifications) {
    const subject = notifications.length === 1
      ? notifications[0].title
      : `You have ${notifications.length} new notifications`;

    const notificationsHtml = notifications.map(n => `
      <div style="border-left: 3px solid #e5e7eb; padding: 10px; margin-bottom: 10px;">
        <h4 style="margin: 0 0 10px 0; color: #333;">${n.title}</h4>
        <p style="margin: 0 0 5px 0; color: #666;">${n.message}</p>
        <small style="color: #999;">Priority: ${n.priority} | Channel: ${n.channels.join(', ')}</small>
      </div>
    `).join('');

    return {
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Notification Summary</h2>
          ${notificationsHtml}
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            Sent from Enterprise Proposal System
          </p>
        </div>
      `,
      text: `${subject}\n\n${notifications.map(n => `${n.title}: ${n.message}`).join('\n\n')}`
    };
  }

  generateEmailHTML(emailData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${emailData.subject}</title>
      </head>
      <body>
        ${emailData.html}
      </body>
      </html>
    `;
  }

  async sendSMTP(emailOptions) {
    // In production, use nodemailer or similar SMTP service
    logger.info(`Sending email to ${emailOptions.to}: ${emailOptions.subject}`);

    // Mock implementation
    return Promise.resolve();
  }
}

/**
 * Slack Notification Channel
 */
class SlackChannel {
  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK;
  }

  async sendBatch(notifications) {
    if (!this.webhookUrl) {
      logger.warn('Slack webhook URL not configured');
      return;
    }

    try {
      const slackPayload = this.generateSlackPayload(notifications);

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(slackPayload)
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }

      logger.info(`Slack notification sent: ${notifications.length} notifications`);
    } catch (error) {
      logger.error('Error sending Slack notification:', error);
    }
  }

  generateSlackPayload(notifications) {
    const primaryNotification = notifications[0]; // Use first as primary
    const attachments = notifications.slice(1).map(n => ({
      color: this.getSlackColor(n.priority),
      fields: [
        {
          title: 'Title',
          value: n.title,
          short: false
        },
        {
          title: 'Message',
          value: n.message,
          short: false
        },
        {
          title: 'Priority',
          value: n.priority,
          short: true
        }
      ]
    }));

    return {
      text: primaryNotification.title,
      attachments: [
        {
          color: this.getSlackColor(primaryNotification.priority),
          fields: [
            {
              title: 'Message',
              value: primaryNotification.message,
              short: false
            },
            {
              title: 'Priority',
              value: primaryNotification.priority,
              short: true
            },
            {
              title: 'Channels',
              value: primaryNotification.channels.join(', '),
              short: true
            }
          ]
        },
        ...attachments
      ]
    };
  }

  getSlackColor(priority) {
    const colors = {
      [NotificationPriorities.LOW]: '#6B7280',
      [NotificationPriorities.MEDIUM]: '#3B8BB8',
      [NotificationPriorities.HIGH]: '#F59E0B',
      [NotificationPriorities.URGENT]: '#EF4444',
      [NotificationPriorities.CRITICAL]: '#DC2626'
    };

    return colors[priority] || colors[NotificationPriorities.LOW];
  }
}

/**
 * Teams Notification Channel
 */
class TeamsChannel {
  constructor() {
    this.webhookUrl = process.env.TEAMS_WEBHOOK;
  }

  async sendBatch(notifications) {
    if (!this.webhookUrl) {
      logger.warn('Teams webhook URL not configured');
      return;
    }

    try {
      const teamsPayload = this.generateTeamsPayload(notifications);

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(teamsPayload)
      });

      if (!response.ok) {
        throw new Error(`Teams API error: ${response.status}`);
      }

      logger.info(`Teams notification sent: ${notifications.length} notifications`);
    } catch (error) {
      logger.error('Error sending Teams notification:', error);
    }
  }

  generateTeamsPayload(notifications) {
    const primaryNotification = notifications[0];

    return {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      "themeColor": this.getTeamsColor(primaryNotification.priority),
      "summary": primaryNotification.title,
      "sections": [
        {
          "activityTitle": "Enterprise Proposal System",
          "activitySubtitle": primaryNotification.message,
          "facts": [
            {
              "name": "Priority",
              "value": primaryNotification.priority
            },
            {
              "name": "Type",
              "value": primaryNotification.type
            },
            {
              "name": "Channels",
              "value": primaryNotification.channels.join(', ')
            }
          ]
        },
        {
          "text": `Additional notifications: ${notifications.length - 1} more`
        }
      ],
      "potentialAction": [
        {
          "@type": "OpenUri",
          "name": "View Details",
          "targets": [
            {
              "os": "default",
              "uri": `${process.env.FRONTEND_URL}/notifications/${primaryNotification.id}`
            }
          ]
        }
      ]
    };
  }

  getTeamsColor(priority) {
    const colors = {
      [NotificationPriorities.LOW]: '6B7280',
      [NotificationPriorities.MEDIUM]: '3B8BB8',
      [NotificationPriorities.HIGH]: 'F59E0B',
      [NotificationPriorities.URGENT]: 'EF4444',
      [NotificationPriorities.CRITICAL]: 'DC2626'
    };

    return colors[priority] || colors[NotificationPriorities.LOW];
  }
}

// Export service instance
const notificationService = new NotificationService();

export default notificationService;
export {
  NotificationService,
  NotificationChannels,
  NotificationTypes,
  NotificationPriorities,
  AIPrioritizer,
  InAppChannel,
  EmailChannel,
  SlackChannel,
  TeamsChannel
};
