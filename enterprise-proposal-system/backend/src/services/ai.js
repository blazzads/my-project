/**
 * Enterprise Proposal System - AI Integration Service
 * AI Modules Integration (Bab 9 & 15)
 *
 * Features:
 * - RFP Parser: Extract metadata from RFP documents
 * - AI Draft Builder: Generate proposal drafts using LLM
 * - AI Compliance Checker: Validate proposal against requirements
 * - AI Weekly Report Generator: Generate executive reports
 * - Win Probability Estimator: Predict proposal success
 * - Integration with cloud AI services (OpenAI, Claude, etc.)
 */

import winston from 'winston';
import fs from 'fs/promises';
import path from 'path';

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}] [AI]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/ai.log',
      level: 'info'
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// AI Service Configuration
const AI_CONFIG = {
  // AI Providers
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4-turbo',
      maxTokens: 4000,
      temperature: 0.7
    },
    claude: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: 'https://api.anthropic.com/v1',
      model: 'claude-3-sonnet-20240229',
      maxTokens: 4000,
      temperature: 0.7
    },
    custom: {
      baseURL: process.env.AI_CUSTOM_BASE_URL,
      apiKey: process.env.AI_CUSTOM_API_KEY,
      model: 'custom-model'
    }
  },

  // RFP Parser Configuration
  rfpParser: {
    supportedFormats: ['pdf', 'docx', 'txt', 'rtf'],
    extractionFields: [
      'title',
      'clientName',
      'submissionDate',
      'submissionTime',
      'budgetRange',
      'requirements',
      'evaluationCriteria',
      'technicalSpecs',
      'businessSpecs',
      'timeline',
      'contactInfo'
    ],
    confidenceThreshold: 0.8
  },

  // Draft Builder Configuration
  draftBuilder: {
    templates: {
      'digital-transformation': {
        sections: [
          'executive_summary',
          'understanding',
          'proposed_solution',
          'technical_approach',
          'implementation_plan',
          'timeline',
          'team_structure',
          'pricing',
          'conclusion'
        ]
      },
      'cloud-services': {
        sections: [
          'executive_summary',
          'current_state_analysis',
          'proposed_cloud_solution',
          'migration_strategy',
          'security_compliance',
          'cost_analysis',
          'timeline',
          'team_expertise',
          'conclusion'
        ]
      },
      'ai-implementation': {
        sections: [
          'executive_summary',
          'project_overview',
          'ai_solution_architecture',
          'data_strategy',
          'model_development',
          'implementation_phases',
          'risk_mitigation',
          'governance',
          'team_skills',
          'pricing',
          'conclusion'
        ]
      },
      'consulting': {
        sections: [
          'executive_summary',
          'client_challenges',
          'proposed_solution',
          'methodology',
          'deliverables',
          'timeline',
          'team_composition',
          'pricing_structure',
          'value_proposition',
          'conclusion'
        ]
      }
    },
    defaultTemplate: 'digital-transformation',
    maxTokens: 3500
  },

  // Compliance Checker Configuration
  complianceChecker: {
    complianceAreas: [
      {
        name: 'technical_requirements',
        weight: 0.3,
        checks: [
          'architecture_completeness',
          'technology_stack',
          'scalability',
          'security_measures',
          'performance_metrics'
        ]
      },
      {
        name: 'business_requirements',
        weight: 0.25,
        checks: [
          'value_proposition',
          'roi_analysis',
          'timeline_realism',
          'resource_allocation',
          'risk_assessment'
        ]
      },
      {
        name: 'document_requirements',
        weight: 0.2,
        checks: [
          'format_compliance',
          'content_completeness',
          'professional_tone',
          'grammar_spelling',
          'visual_design'
        ]
      },
      {
        name: 'legal_compliance',
        weight: 0.25,
        checks: [
          'terms_and_conditions',
          'liability_coverage',
          'intellectual_property',
          'confidentiality',
          'regulatory_compliance'
        ]
      }
    ],
    thresholdScores: {
      excellent: 90,
      good: 80,
      acceptable: 70,
      needs_improvement: 60,
      poor: 50
    }
  },

  // Weekly Report Configuration
  weeklyReport: {
    reportSections: [
      'executive_summary',
      'performance_metrics',
      'proposal_pipeline',
      'team_performance',
      'compliance_trends',
      'recommendations',
      'forecast'
    ],
    kpiMetrics: [
      'total_proposals',
      'won_proposals',
      'lost_proposals',
      'average_cycle_time',
      'compliance_scores',
      'team_productivity',
      'client_satisfaction'
    ]
  }
};

/**
 * AI Service Class
 */
class AIService {
  constructor() {
    this.providers = new Map();
    this.initializeProviders();
    this.cache = new Map();
    this.cacheExpiration = 300000; // 5 minutes

    logger.info('AI Integration Service initialized');
  }

  /**
   * Initialize AI providers
   */
  initializeProviders() {
    // Initialize OpenAI provider
    if (AI_CONFIG.providers.openai.apiKey) {
      this.providers.set('openai', new OpenAIProvider(AI_CONFIG.providers.openai));
    }

    // Initialize Claude provider
    if (AI_CONFIG.providers.claude.apiKey) {
      this.providers.set('claude', new ClaudeProvider(AI_CONFIG.providers.claude));
    }

    // Initialize custom AI provider
    if (AI_CONFIG.providers.custom.apiKey) {
      this.providers.set('custom', new CustomAIProvider(AI_CONFIG.providers.custom));
    }

    logger.info(`Initialized ${this.providers.size} AI providers`);
  }

  /**
   * Get AI provider by preference
   */
  getProvider(providerName = 'openai') {
    return this.providers.get(providerName) || this.providers.get('openai');
  }

  /**
   * Generate cache key
   */
  generateCacheKey(method, params) {
    return `${method}:${JSON.stringify(params)}`;
  }

  /**
   * Check cache
   */
  checkCache(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiration) {
      return cached.data;
    }
    return null;
  }

  /**
   * Store in cache
   */
  storeCache(cacheKey, data) {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * RFP Parser - Parse RFP document and extract metadata
   */
  async parseRFP(fileData, options = {}) {
    try {
      const cacheKey = this.generateCacheKey('parseRFP', {
        format: fileData.format,
        size: fileData.size
      });

      // Check cache first
      const cached = this.checkCache(cacheKey);
      if (cached) {
        logger.info('RFP parse result retrieved from cache');
        return cached;
      }

      logger.info(`Parsing RFP document (${fileData.format}, ${fileData.size} bytes)`);

      // Get AI provider
      const provider = this.getProvider(options.provider);

      // Prepare parsing prompt
      const prompt = this.generateRFPParsingPrompt(fileData);

      // Call AI provider
      const response = await provider.complete(prompt);

      // Parse AI response
      const metadata = this.parseRFPResponse(response);

      // Validate extracted metadata
      const validatedMetadata = this.validateRFPMetadata(metadata);

      // Store in cache
      this.storeCache(cacheKey, validatedMetadata);

      logger.info(`RFP parsed successfully: ${validatedMetadata.confidence}% confidence`);

      return {
        success: true,
        metadata: validatedMetadata,
        confidence: validatedMetadata.confidence,
        extractedFields: Object.keys(validatedMetadata),
        processingTime: validatedMetadata.processingTime
      };

    } catch (error) {
      logger.error('RFP parsing failed:', error);
      return {
        success: false,
        error: error.message,
        metadata: null
      };
    }
  }

  /**
   * Generate RFP parsing prompt
   */
  generateRFPParsingPrompt(fileData) {
    return `
You are an expert RFP analyst. Analyze the provided RFP document and extract the following information in JSON format:

${AI_CONFIG.rfpParser.extractionFields.map(field => `- ${field}`).join('\n')}

Instructions:
1. Extract all available information accurately
2. If information is not available, use "N/A" as the value
3. Provide confidence score (0-100) for each extracted field
4. Ensure the JSON is valid and properly formatted
5. Focus on critical information like title, client name, budget, timeline, and requirements
6. For requirements, extract both technical and business specifications
7. Include contact information if available

RFP Details:
- Format: ${fileData.format}
- Size: ${fileData.size} bytes
- Preview: ${fileData.preview || 'No preview available'}

Respond with JSON only, no additional text:
`;
  }

  /**
   * Parse AI response for RFP metadata
   */
  parseRFPResponse(response) {
    try {
      // Extract JSON from AI response
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : response;

      const metadata = JSON.parse(jsonString);

      // Calculate overall confidence
      const fieldConfidences = Object.values(metadata).reduce((acc, field) => {
        if (typeof field === 'object' && field.confidence) {
          return acc + field.confidence;
        }
        return acc;
      }, 0);

      const overallConfidence = Math.round(fieldConfidences / Object.keys(metadata).length);

      return {
        ...metadata,
        confidence: Math.min(overallConfidence, 100),
        processingTime: Date.now()
      };

    } catch (error) {
      logger.error('Error parsing RFP response:', error);
      return {
        confidence: 0,
        error: 'Failed to parse AI response'
      };
    }
  }

  /**
   * Validate RFP metadata
   */
  validateRFPMetadata(metadata) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      missingCriticalFields: [],
      extractedFields: Object.keys(metadata)
    };

    // Check critical fields
    const criticalFields = ['title', 'clientName'];
    for (const field of criticalFields) {
      if (!metadata[field] || metadata[field] === 'N/A') {
        validation.missingCriticalFields.push(field);
        validation.warnings.push(`Missing critical field: ${field}`);
      }
    }

    // Validate confidence threshold
    if (metadata.confidence < AI_CONFIG.rfpParser.confidenceThreshold) {
      validation.warnings.push('Low confidence score - manual verification recommended');
    }

    // Check for inconsistencies
    if (metadata.budgetLow && metadata.budgetHigh && metadata.budgetLow > metadata.budgetHigh) {
      validation.errors.push('Budget range inconsistency');
      validation.isValid = false;
    }

    // Set overall validity
    if (validation.errors.length > 0 || validation.missingCriticalFields.length > 0) {
      validation.isValid = false;
    }

    return validation;
  }

  /**
   * AI Draft Builder - Generate proposal draft using LLM
   */
  async generateDraft(options) {
    try {
      const {
        proposalId,
        template,
        requirements,
        user,
        metadata = {}
      } = options;

      const cacheKey = this.generateCacheKey('generateDraft', {
        proposalId,
        template,
        requirementsCount: requirements?.length || 0
      });

      // Check cache
      const cached = this.checkCache(cacheKey);
      if (cached) {
        logger.info('Draft generation result retrieved from cache');
        return cached;
      }

      logger.info(`Generating AI draft for proposal ${proposalId} using template: ${template}`);

      // Get AI provider
      const provider = this.getProvider(user?.aiProvider || 'openai');

      // Get template configuration
      const templateConfig = AI_CONFIG.draftBuilder.templates[template] ||
                             AI_CONFIG.draftBuilder.templates[AI_CONFIG.draftBuilder.defaultTemplate];

      // Generate drafting prompt
      const prompt = this.generateDraftBuilderPrompt(templateConfig, requirements, metadata, user);

      // Call AI provider
      const response = await provider.complete(prompt, {
        maxTokens: templateConfig.maxTokens || AI_CONFIG.draftBuilder.maxTokens
      });

      // Process AI response
      const draft = this.processDraftResponse(response, templateConfig);

      // Store in cache
      this.storeCache(cacheKey, draft);

      logger.info(`AI draft generated successfully for proposal ${proposalId}`);

      return {
        success: true,
        draftId: `DRAFT_${proposalId}_${Date.now()}`,
        content: draft.content,
        sections: draft.sections,
        wordCount: draft.wordCount,
        estimatedReadingTime: draft.estimatedReadingTime,
        aiModel: provider.model,
        confidence: draft.confidence,
        processingTime: draft.processingTime,
        template: template
      };

    } catch (error) {
      logger.error('AI draft generation failed:', error);
      return {
        success: false,
        error: error.message,
        draftId: null,
        content: null
      };
    }
  }

  /**
   * Generate draft builder prompt
   */
  generateDraftBuilderPrompt(templateConfig, requirements, metadata, user) {
    const sections = templateConfig.sections.map(section => section).join('\n\n');

    return `
You are an expert proposal writer with experience in ${user?.role || 'proposal writing'}.

Generate a comprehensive proposal draft based on the following information:

TEMPLATE STRUCTURE:
${sections}

REQUIREMENTS:
${requirements ? requirements.map(req => `- ${req}`).join('\n') : 'No specific requirements provided'}

METADATA:
${metadata ? Object.entries(metadata).map(([key, value]) => `- ${key}: ${value}`).join('\n') : 'No metadata provided'}

USER CONTEXT:
${user ? `- Role: ${user.role}\n- Experience: ${user.experience || 'Not specified'}\n- Department: ${user.department}` : ''}

INSTRUCTIONS:
1. Follow the template structure exactly
2. Generate professional, persuasive content
3. Address all requirements thoroughly
4. Include realistic examples and case studies
5. Ensure logical flow and consistency
6. Use business-appropriate language
7. Include specific metrics and KPIs where applicable
8. Add executive summary with clear value proposition
9. Include technical details for credibility
10. Ensure compliance with proposal best practices

OUTPUT FORMAT:
- Use Markdown format with proper section headers
- Include practical, actionable content
- Provide realistic examples
- Ensure appropriate length for corporate proposal
- Include contact information and next steps

Focus on delivering value and demonstrating expertise while maintaining professionalism.
`;
  }

  /**
   * Process AI response for draft
   */
  processDraftResponse(response, templateConfig) {
    try {
      const content = response;
      const sections = this.parseDraftSections(content, templateConfig.sections);
      const wordCount = content.split(/\s+/).length;

      // Estimate reading time (average 200 words per minute)
      const estimatedReadingTime = Math.ceil(wordCount / 200);

      // Calculate confidence based on content quality metrics
      const confidence = this.calculateDraftConfidence(content, sections, wordCount);

      return {
        content,
        sections,
        wordCount,
        estimatedReadingTime,
        confidence,
        processingTime: Date.now()
      };

    } catch (error) {
      logger.error('Error processing draft response:', error);
      return {
        content: response,
        sections: [],
        wordCount: 0,
        estimatedReadingTime: 0,
        confidence: 0,
        processingTime: Date.now()
      };
    }
  }

  /**
   * Parse draft sections from AI response
   */
  parseDraftSections(content, templateSections) {
    const sections = [];

    for (const sectionConfig of templateSections) {
      const sectionRegex = new RegExp(`##\\s*${sectionConfig}\\s*([\\s\\S]*?)(?=\\n\\s*##|$)`, 'i');
      const match = content.match(sectionRegex);

      if (match) {
        sections.push({
          name: sectionConfig,
          content: match[1].trim(),
          wordCount: match[1].split(/\s+/).length
        });
      } else {
        sections.push({
          name: sectionConfig,
          content: `Section ${sectionConfig} not found.`,
          wordCount: 0
        });
      }
    }

    return sections;
  }

  /**
   * Calculate draft confidence score
   */
  calculateDraftConfidence(content, sections, wordCount) {
    let confidence = 50; // Base score

    // Penalize short content
    if (wordCount < 500) {
      confidence -= 20;
    } else if (wordCount > 3000) {
      confidence += 10;
    }

    // Reward complete sections
    const completeSections = sections.filter(s => s.wordCount > 50).length;
    confidence += (completeSections / sections.length) * 20;

    // Penalize sections marked as not found
    const incompleteSections = sections.filter(s => s.content.includes('not found')).length;
    confidence -= (incompleteSections / sections.length) * 15;

    // Reward professional language indicators
    const professionalKeywords = [
      'strategic', 'comprehensive', 'tailored', 'innovative',
      'scalable', 'robust', 'efficient', 'optimize'
    ];

    const keywordMatches = professionalKeywords.filter(keyword =>
      content.toLowerCase().includes(keyword.toLowerCase())
    ).length;

    confidence += Math.min(keywordMatches * 2, 15);

    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * AI Compliance Checker - Validate proposal against requirements
   */
  async checkCompliance(options) {
    try {
      const { proposalId, clientDocuments, proposalContent } = options;

      const cacheKey = this.generateCacheKey('checkCompliance', {
        proposalId,
        documentCount: clientDocuments?.length || 0
      });

      // Check cache
      const cached = this.checkCache(cacheKey);
      if (cached) {
        logger.info('Compliance check result retrieved from cache');
        return cached;
      }

      logger.info(`Checking compliance for proposal ${proposalId}`);

      // Get AI provider
      const provider = this.getProvider(options.provider || 'openai');

      // Generate compliance checking prompt
      const prompt = this.generateCompliancePrompt(clientDocuments, proposalContent);

      // Call AI provider
      const response = await provider.complete(prompt);

      // Process compliance response
      const complianceResult = this.processComplianceResponse(response);

      // Store in cache
      this.storeCache(cacheKey, complianceResult);

      logger.info(`Compliance check completed: ${complianceResult.overallScore}/100`);

      return {
        success: true,
        proposalId,
        overallScore: complianceResult.overallScore,
        grade: complianceResult.grade,
        areas: complianceResult.areas,
        issues: complianceResult.issues,
        recommendations: complianceResult.recommendations,
        riskLevel: complianceResult.riskLevel,
        processingTime: complianceResult.processingTime
      };

    } catch (error) {
      logger.error('Compliance check failed:', error);
      return {
        success: false,
        error: error.message,
        overallScore: 0
      };
    }
  }

  /**
   * Generate compliance checking prompt
   */
  generateCompliancePrompt(clientDocuments, proposalContent) {
    return `
You are a compliance expert specializing in proposal evaluation. Analyze the proposal against the client requirements and document compliance.

CLIENT DOCUMENTS:
${clientDocuments?.map(doc => `- ${doc.name} (${doc.type}): ${doc.summary}`).join('\n') || 'No client documents provided'}

PROPOSAL CONTENT:
${proposalContent ? proposalContent.substring(0, 2000) + '...' : 'No proposal content provided'}

COMPLIANCE AREAS TO CHECK:
${AI_CONFIG.complianceChecker.complianceAreas.map(area => `
${area.name} (Weight: ${area.weight * 100}%):
${area.checks.map(check => `- ${check}`).join('\n')}`).join('\n\n')}

EVALUATION CRITERIA:
1. Assess proposal compliance against each requirement
2. Identify gaps and inconsistencies
3. Evaluate completeness of technical and business aspects
4. Check document formatting and presentation
5. Review legal and regulatory compliance
6. Assess overall risk level

OUTPUT REQUIREMENTS:
Respond with JSON format containing:
{
  "overallScore": 0-100,
  "grade": "excellent|good|acceptable|needs_improvement|poor",
  "areas": [
    {
      "name": "area_name",
      "weight": 0.25,
      "score": 0-100,
      "status": "pass|fail|partial",
      "issues": ["issue1", "issue2"],
      "recommendations": ["rec1", "rec2"]
    }
  ],
  "issues": [
    {
      "area": "area_name",
      "severity": "low|medium|high|critical",
      "description": "description",
      "suggestion": "suggestion"
    }
  ],
  "recommendations": [
    {
      "priority": "low|medium|high",
      "description": "description",
      "action": "action"
    }
  ],
  "riskLevel": "low|medium|high|critical"
}

Scoring Guidelines:
- Excellent: 90-100
- Good: 80-89
- Acceptable: 70-79
- Needs Improvement: 60-69
- Poor: Below 60

Provide only JSON response, no additional text.
`;
  }

  /**
   * Process compliance response
   */
  processComplianceResponse(response) {
    try {
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : response;

      const result = JSON.parse(jsonString);

      // Calculate overall score from areas
      let calculatedScore = 0;
      if (result.areas && result.areas.length > 0) {
        calculatedScore = result.areas.reduce((acc, area) => {
          return acc + (area.score * area.weight);
        }, 0);

        // Normalize to 0-100 scale
        const totalWeight = result.areas.reduce((acc, area) => acc + area.weight, 0);
        calculatedScore = (calculatedScore / totalWeight) * 100;
      }

      // Ensure score is within bounds
      result.overallScore = Math.min(100, Math.max(0, calculatedScore));

      // Determine grade based on score
      if (result.grade) {
        result.grade = result.grade.toLowerCase();
      } else {
        result.grade = this.getGradeFromScore(result.overallScore);
      }

      // Determine risk level
      if (!result.riskLevel) {
        result.riskLevel = this.getRiskLevel(result.overallScore, result.issues);
      }

      return {
        ...result,
        calculatedScore,
        processingTime: Date.now()
      };

    } catch (error) {
      logger.error('Error processing compliance response:', error);
      return {
        overallScore: 0,
        grade: 'poor',
        areas: [],
        issues: [],
        recommendations: [],
        riskLevel: 'high',
        processingTime: Date.now()
      };
    }
  }

  /**
   * Get grade from score
   */
  getGradeFromScore(score) {
    const threshold = AI_CONFIG.complianceChecker.thresholdScores;

    if (score >= threshold.excellent) return 'excellent';
    if (score >= threshold.good) return 'good';
    if (score >= threshold.acceptable) return 'acceptable';
    if (score >= threshold.needs_improvement) return 'needs_improvement';
    return 'poor';
  }

  /**
   * Get risk level from score and issues
   */
  getRiskLevel(score, issues) {
    const criticalIssues = issues.filter(issue => issue.severity === 'critical');

    if (criticalIssues.length > 0) return 'critical';
    if (score < 50) return 'high';
    if (score < 70) return 'medium';
    return 'low';
  }

  /**
   * AI Weekly Report Generator (Bab 15)
   */
  async generateWeeklyReport(options = {}) {
    try {
      const { reportDate, user, metrics = {} } = options;

      const cacheKey = this.generateCacheKey('generateWeeklyReport', {
        reportDate,
        userId: user?.id
      });

      // Check cache (weekly report can be cached for 1 day)
      const cached = this.checkCache(cacheKey);
      if (cached) {
        logger.info('Weekly report retrieved from cache');
        return cached;
      }

      logger.info(`Generating AI weekly report for ${reportDate}`);

      // Get AI provider
      const provider = this.getProvider('openai');

      // Fetch metrics for the week
      const metricsData = await this.fetchWeeklyMetrics(reportDate);

      // Generate report prompt
      const prompt = this.generateWeeklyReportPrompt(metricsData, reportDate);

      // Generate PDF report
      const reportContent = await provider.complete(prompt);

      // Process report content
      const report = this.processWeeklyReport(reportContent, metricsData, reportDate);

      // Generate PDF
      const pdfBuffer = await this.generateWeeklyReportPDF(report);

      // Store report in cache (24 hour expiration)
      const cacheData = {
        reportId: report.reportId,
        reportPath: report.reportPath,
        pdfBuffer,
        report,
        metricsData,
        reportDate,
        generatedAt: new Date().toISOString()
      };

      // Extend cache expiration for weekly reports
      const expiration = 24 * 60 * 60 * 1000; // 24 hours
      this.cache.set(cacheKey, { ...cacheData, expiration });

      // Store report file
      await this.storeWeeklyReportFile(report.reportId, pdfBuffer);

      // Schedule email delivery
      await this.scheduleWeeklyReportDelivery(report);

      logger.info(`Weekly report generated successfully: ${report.reportId}`);

      return {
        success: true,
        reportId: report.reportId,
        reportPath: report.reportPath,
        report,
        metricsData,
        pdfBuffer,
        scheduledDelivery: report.scheduledDelivery,
        processingTime: report.processingTime
      };

    } catch (error) {
      logger.error('Weekly report generation failed:', error);
      return {
        success: false,
        error: error.message,
        reportId: null
      };
    }
  }

  /**
   * Generate weekly report prompt
   */
  generateWeeklyReportPrompt(metricsData, reportDate) {
    const weekStart = new Date(reportDate);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    return `
You are a business analyst generating a weekly executive report for proposal management system.

REPORTING PERIOD:
- Week: ${weekStart.toDateString()} - ${weekEnd.toDateString()}
- Generated: ${new Date().toISOString()}

METRICS DATA:
${Object.entries(metricsData).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

REPORT SECTIONS REQUIRED:
${AI_CONFIG.weeklyReport.reportSections.join('\n')}

INSTRUCTIONS:
1. Generate a comprehensive executive summary highlighting key achievements
2. Include data-driven insights with specific metrics and percentages
3. Analyze trends and patterns from the weekly data
4. Provide actionable recommendations for improvement
5. Assess team performance and productivity
6. Include risk factors and mitigation strategies
7. Forecast next week's expectations based on current trends
8. Format for executive audience (concise, professional, visual)

STYLE REQUIREMENTS:
- Professional corporate tone
- Data-driven analysis with specific numbers
- Clear action items and recommendations
- Forward-looking strategic insights
- Appropriate visual formatting for PDF

OUTPUT FORMAT:
- Generate content suitable for corporate PDF report
- Include executive summary at the beginning
- Use headings and bullet points for clarity
- Provide specific metrics and percentages
- Include call-to-action items

Focus on delivering value to executive leadership with actionable insights.
`;
  }

  /**
   * Fetch weekly metrics from databases
   */
  async fetchWeeklyMetrics(reportDate) {
    // This would connect to analytics replica database
    // For now, return mock data

    const weekStart = new Date(reportDate);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    return {
      reportDate: reportDate,
      weekRange: `${weekStart.toDateString()} - ${weekEnd.toDateString()}`,

      // Pipeline metrics
      totalProposals: Math.floor(Math.random() * 50) + 10,
      submittedProposals: Math.floor(Math.random() * 30) + 5,
      wonProposals: Math.floor(Math.random() * 15) + 2,
      lostProposals: Math.floor(Math.random() * 10) + 1,

      // Financial metrics
      totalRevenue: Math.floor(Math.random() * 2000000) + 500000,
      averageDealSize: Math.floor(Math.random() * 100000) + 20000,

      // Performance metrics
      averageCycleTime: Math.floor(Math.random() * 20) + 10, // days
      submissionRate: Math.floor(Math.random() * 80) + 15, // percentage

      // Team metrics
      teamProductivity: Math.floor(Math.random() * 100) + 20,
      complianceAverage: Math.floor(Math.random() * 30) + 70, // percentage

      // Trend metrics
      proposalVolumeTrend: Math.random() > 0.5 ? 'increasing' : 'decreasing',
      winRateTrend: Math.random() > 0.6 ? 'improving' : 'declining',

      // Top performers
      topSalesPerson: 'John Smith',
      topProposal: 'Digital Transformation Project',
      longestProposal: 'AI Implementation Initiative'
    };
  }

  /**
   * Process weekly report content
   */
  processWeeklyReportContent(content, metricsData, reportDate) {
    try {
      const lines = content.split('\n').filter(line => line.trim());
      const sections = {};

      // Parse sections based on keywords
      let currentSection = '';
      for (const line of lines) {
        if (line.startsWith('#') && !line.startsWith('# ')) {
          currentSection = line.replace('#', '').trim();
          sections[currentSection] = [];
        } else if (currentSection) {
          sections[currentSection].push(line);
        }
      }

      return {
        sections,
        content,
        metricsData,
        reportDate,
        processingTime: Date.now()
      };

    } catch (error) {
      logger.error('Error processing weekly report content:', error);
      return {
        sections: {},
        content,
        metricsData,
        reportDate,
        processingTime: Date.now()
      };
    }
  }

  /**
   * Process weekly report
   */
  processWeeklyReport(reportContent, metricsData, reportDate) {
    const report = {
      reportId: `WEEKLY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      reportDate,

      // Extract key insights from metrics
      insights: {
        winRate: metricsData.submittedProposals > 0
          ? Math.round((metricsData.wonProposals / metricsData.submittedProposals) * 100)
          : 0,

        revenuePerProposal: metricsData.wonProposals > 0
          ? Math.round(metricsData.totalRevenue / metricsData.wonProposals)
          : 0,

        productivityRate: metricsData.teamProductivity,

        complianceScore: metricsData.complianceAverage,

        trends: {
          volume: metricsData.proposalVolumeTrend,
          success: metricsData.winRateTrend
        }
      },

      processingTime: Date.now()
    };

    return {
      ...report,
      reportPath: `reports/weekly/${report.reportId}.pdf`,
      reportContent: reportContent.content
    };
  }

  /**
   * Generate weekly report PDF
   */
  async generateWeeklyReportPDF(report) {
    try {
      // In production, use PDF generation library like puppeteer
      // For now, return mock PDF buffer

      const pdfContent = `
        Weekly Proposal Management Report
        ========================================
        Report Date: ${report.reportDate}

        Executive Summary
        ----------------
        ${report.reportContent.sections['Executive Summary']?.join('\n') || 'Executive summary not found'}

        Key Metrics
        -----------
        Total Proposals: ${report.metricsData.totalProposals}
        Submitted: ${report.metricsData.submittedProposals}
        Won: ${report.metricsData.wonProposals}
        Win Rate: ${report.insights.winRate}%

        Performance Analysis
        -----------------
        ${report.reportContent.sections['Performance Analysis']?.join('\n') || 'Performance analysis not found'}

        Team Performance
        ----------------
        ${report.reportContent.sections['Team Performance']?.join('\n') || 'Team performance not found'}

        Recommendations
        ---------------
        ${report.reportContent.sections['Recommendations']?.join('\n') || 'Recommendations not found'}

        Report Generated: ${new Date().toISOString()}
      `;

      return Buffer.from(pdfContent, 'utf8');

    } catch (error) {
      logger.error('Error generating PDF:', error);
      return Buffer.from('Error generating PDF');
    }
  }

  /**
   * Store weekly report file
   */
  async storeWeeklyReportFile(reportId, pdfBuffer) {
    try {
      const reportsDir = path.join(process.cwd(), 'reports', 'weekly');
      await fs.mkdir(reportsDir, { recursive: true });

      const filePath = path.join(reportsDir, `${reportId}.pdf`);
      await fs.writeFile(filePath, pdfBuffer);

      logger.info(`Weekly report stored: ${filePath}`);
      return filePath;

    } catch (error) {
      logger.error('Error storing weekly report file:', error);
      throw error;
    }
  }

  /**
   * Schedule weekly report delivery
   */
  async scheduleWeeklyReportDelivery(report) {
    try {
      // Schedule email delivery to GM/Directors
      const deliveryTime = new Date();
      deliveryTime.setHours(9, 0, 0, 0); // 9:00 AM every Monday
      deliveryTime.setDate(deliveryTime.getDate() + 1); // Tomorrow

      if (deliveryTime.getDay() !== 1) {
        // Next Monday
        const daysUntilMonday = (8 - deliveryTime.getDay() + 7) % 7;
        deliveryTime.setDate(deliveryTime.getDate() + daysUntilMonday);
      }

      logger.info(`Weekly report scheduled for delivery to GM/Directors on ${deliveryTime.toISOString()}`);

      // In production, integrate with email service
      return {
        scheduledDelivery: deliveryTime.toISOString(),
        recipients: ['gm', 'directors'],
        reportId: report.reportId
      };

    } catch (error) {
      logger.error('Error scheduling weekly report delivery:', error);
      throw error;
    }
  }

  /**
   * Win Probability Estimator
   */
  async estimateWinProbability(proposalData) {
    try {
      const cacheKey = this.generateCacheKey('estimateWinProbability', {
        proposalId: proposalData.proposalId
      });

      // Check cache
      const cached = this.checkCache(cacheKey);
      if (cached) {
        return cached;
      }

      logger.info(`Estimating win probability for proposal ${proposalData.proposalId}`);

      // Get AI provider
      const provider = this.getProvider('openai');

      // Generate win probability estimation prompt
      const prompt = this.generateWinProbabilityPrompt(proposalData);

      // Call AI provider
      const response = await provider.complete(prompt);

      // Process win probability response
      const probability = this.processWinProbabilityResponse(response);

      // Store in cache
      this.processCache(cacheKey, probability);

      logger.info(`Win probability estimated: ${probability.probability}% for proposal ${proposalData.proposalId}`);

      return {
        success: true,
        proposalId: proposalData.proposalId,
        probability: probability.probability,
        confidence: probability.confidence,
        factors: probability.factors,
        riskLevel: probability.riskLevel,
        recommendations: probability.recommendations,
        processingTime: probability.processingTime
      };

    } catch (error) {
      logger.error('Win probability estimation failed:', error);
      return {
        success: false,
        error: error.message,
        probability: 0
      };
    }
  }

  /**
   * Generate win probability estimation prompt
   */
  generateWinProbabilityPrompt(proposalData) {
    return `
You are an expert business analyst specializing in proposal success prediction. Analyze the proposal data and estimate the probability of winning.

PROPOSAL DATA:
${Object.entries(proposalData).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

ANALYSIS FACTORS TO CONSIDER:
1. Historical win rates for similar proposals
2. Client relationship and past engagement
3. Proposal quality and completeness
4. Competitive landscape
5. Pricing and value proposition
6. Technical capability and resources
7. Timeline and delivery feasibility
8. Risk factors and mitigation strategies

EVALUATION CRITERIA:
- Historical performance (30%)
- Client relationship (25%)
- Proposal quality (20%)
- Competitive position (15%)
- Pricing strategy (10%)

OUTPUT REQUIREMENTS:
Respond with JSON format containing:
{
  "probability": 0-100,
  "confidence": 0-100,
  "factors": [
    {
      "factor": "factor_name",
      "score": 0-100,
      "weight": 0.25,
      "impact": "positive|negative|neutral",
      "description": "description"
    }
  ],
  "riskLevel": "low|medium|high|critical",
  "recommendations": [
    {
      "priority": "low|medium|high",
      "description": "description",
      "action": "action"
    }
  ]
}

SCORING:
- Low (0-40): High risk, significant concerns
- Medium (41-70): Moderate risk, some improvements needed
- High (71-85): Good chance, well-positioned
- Very High (86-95): Strong position, high confidence
- Exceptional (96-100): Very likely to win

Provide only JSON response, no additional text.
`;
  }

  /**
   * Process win probability response
   */
  processWinProbabilityResponse(response) {
    try {
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : response;

      const result = JSON.parse(jsonString);

      // Calculate overall probability from factors
      let calculatedProbability = 0;
      if (result.factors && result.factors.length > 0) {
        calculatedProbability = result.factors.reduce((acc, factor) => {
          return acc + (factor.score * factor.weight);
        }, 0);

        // Normalize to 0-100 scale
        const totalWeight = result.factors.reduce((acc, factor) => acc + factor.weight, 0);
        calculatedProbability = (calculatedProbability / totalWeight) * 100;
      }

      // Ensure probability is within bounds
      result.probability = Math.min(100, Math.max(0, calculatedProbability));

      // Determine risk level
      if (!result.riskLevel) {
        result.riskLevel = this.getRiskLevel(result.probability, result.factors);
      }

      return {
        ...result,
        calculatedProbability,
        processingTime: Date.now()
      };

    } catch (error) {
      logger.error('Error processing win probability response:', error);
      return {
        probability: 0,
        confidence: 0,
        factors: [],
        riskLevel: 'high',
        recommendations: [],
        processingTime: Date.now()
      };
    }
  }

  /**
   * Get risk level from probability
   */
  getRiskLevel(probability, factors) {
    const negativeFactors = factors?.filter(f => f.impact === 'negative');

    if (negativeFactors && negativeFactors.length > 0) {
      return 'high';
    }

    if (probability < 40) return 'high';
    if (probability < 70) return 'medium';
    return 'low';
  }

  /**
   * Custom AI provider interface
   */
  class CustomAIProvider {
    constructor(config) {
      this.config = config;
    }

    async complete(prompt, options = {}) {
      // Custom AI provider implementation
      // This would integrate with enterprise AI systems
      logger.info('Using Custom AI provider');

      // Mock implementation
      return {
        choices: [{
          text: 'Custom AI response',
        }],
        usage: {
          prompt_tokens: prompt.length,
          completion_tokens: 500
        }
      };
    }
  }

  /**
   * OpenAI provider interface
   */
  class OpenAIProvider {
    constructor(config) {
      this.config = config;
    }

    async complete(prompt, options = {}) {
      const url = `${this.config.baseURL}/chat/completions`;

      const requestBody = {
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options.maxTokens || this.config.maxTokens,
        temperature: this.config.temperature,
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;

      } catch (error) {
        logger.error('OpenAI API error:', error);
        throw error;
      }
    }
  }

  /**
   * Claude provider interface
   */
  class ClaudeProvider {
    constructor(config) {
      this.config = config;
    }

    async complete(prompt, options = {}) {
      const url = `${this.config.baseURL}/messages`;

      const requestBody = {
        model: this.config.model,
        max_tokens: options.maxTokens || this.config.maxTokens,
        messages: [{ role: 'user', content: prompt }]
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'x-api-key': this.config.apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`Claude API error: ${response.status}`);
        }

        const data = await response.json();
        return data.content[0].text;

      } catch (error) {
        logger.error('Claude API error:', error);
        throw error;
      }
    }
  }

  /**
   * Process cache with expiration
   */
  processCache(cacheKey, data) {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      expiration: this.cacheExpiration
    });
  }

  /**
   * Initialize service
   */
  async initialize() {
    logger.info('AI Integration Service initialized');

    // Warm up cache with common operations
    await this.warmUpCache();

    logger.info('AI Service ready for integration');
  }

  /**
   * Warm up cache with common operations
   */
  async warmUpCache() {
    try {
      // Pre-generate common prompts
      const commonPrompts = [
        {
          type: 'draft_template',
          template: 'digital-transformation',
          requirements: ['Web Development', 'Mobile App']
        },
        {
          type: 'compliance_check',
          areas: ['technical', 'business']
        },
        {
          type: 'win_probability',
          factors: ['pricing', 'timeline', 'resources']
        }
      ];

      for (const promptData of commonPrompts) {
        const cacheKey = this.generateCacheKey('warmup', promptData);
        this.storeCache(cacheKey, {
          warmedUp: true,
          timestamp: Date.now()
        });
      }

      logger.info(`AI cache warmed up with ${commonPrompts.length} common operations`);

    } catch (error) {
      logger.error('Error warming up AI cache:', error);
    }
  }

  /**
   * Get service statistics
   */
  getStatistics() {
    return {
      cache: {
        size: this.cache.size,
        expiration: this.cacheExpiration
      },
      providers: {
        count: this.providers.size,
        list: Array.from(this.providers.keys())
      },
      config: AI_CONFIG,
      capabilities: [
        'RFP Parser',
        'AI Draft Builder',
        'AI Compliance Checker',
        'Weekly Report Generator',
        'Win Probability Estimator'
      ]
    };
  }
}

// Export AI service instance
const aiService = new AIService();

export default aiService;
export { AIService, OpenAIProvider, ClaudeProvider, CustomAIProvider };
