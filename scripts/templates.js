#!/usr/bin/env node

/**
 * GLM-4.6 Project Templates
 * Predefined templates for common project types
 */

const fs = require('fs-extra');
const path = require('path');

class GLMTemplates {
  constructor() {
    this.templates = {
      'strategic-proposal': {
        name: 'Strategic Proposal App',
        description: 'Complete strategic proposal management application',
        prompt: `Generate a complete Strategic Proposal App with Next.js 15, TypeScript, and Tailwind CSS.

Features to include:
- Proposal creation wizard
- Template library
- Team collaboration
- Document management
- Analytics dashboard
- Client management
- Proposal tracking
- PDF export
- Real-time collaboration
- GLM-4.6 AI integration for content generation

Requirements:
- Use shadcn/ui components
- Include proper authentication
- Add database schema with Prisma
- Include API routes for all features
- Add proper error handling and loading states
- Make it fully responsive
- Include comprehensive documentation

Return as complete project structure with all necessary files.`
      },
      'dashboard': {
        name: 'Admin Dashboard',
        description: 'Modern admin dashboard with analytics',
        prompt: `Generate a complete Admin Dashboard with Next.js 15, TypeScript, and Tailwind CSS.

Features to include:
- User management
- Analytics dashboard
- Real-time data visualization
- Settings management
- Role-based access control
- Activity logs
- Reporting system
- Notifications
- Dark mode support
- Responsive design

Requirements:
- Use Chart.js or Recharts for visualizations
- Include shadcn/ui components
- Add proper authentication
- Include API routes
- Add database schema
- Make it fully responsive
- Include comprehensive documentation

Return as complete project structure with all necessary files.`
      },
      'ecommerce': {
        name: 'E-commerce Platform',
        description: 'Full-featured e-commerce platform',
        prompt: `Generate a complete E-commerce Platform with Next.js 15, TypeScript, and Tailwind CSS.

Features to include:
- Product catalog
- Shopping cart
- User authentication
- Payment integration (Stripe)
- Order management
- Inventory management
- Product search and filtering
- User reviews
- Admin panel
- Responsive design

Requirements:
- Use shadcn/ui components
- Include Stripe integration
- Add proper authentication
- Include database schema with Prisma
- Add API routes for all features
- Include proper error handling
- Make it fully responsive
- Include comprehensive documentation

Return as complete project structure with all necessary files.`
      },
      'blog': {
        name: 'Blog Platform',
        description: 'Modern blog platform with CMS',
        prompt: `Generate a complete Blog Platform with Next.js 15, TypeScript, and Tailwind CSS.

Features to include:
- Article creation and editing
- Markdown support
- Category and tag management
- User authentication
- Comment system
- Search functionality
- SEO optimization
- RSS feed
- Dark mode support
- Responsive design

Requirements:
- Use shadcn/ui components
- Include MDX support
- Add proper authentication
- Include database schema with Prisma
- Add API routes for all features
- Include proper error handling
- Make it fully responsive
- Include comprehensive documentation

Return as complete project structure with all necessary files.`
      },
      'saas': {
        name: 'SaaS Application',
        description: 'Multi-tenant SaaS application',
        prompt: `Generate a complete SaaS Application with Next.js 15, TypeScript, and Tailwind CSS.

Features to include:
- Multi-tenant architecture
- User authentication and authorization
- Subscription management
- Billing integration (Stripe)
- Team management
- API rate limiting
- Analytics dashboard
- Settings management
- Notification system
- Responsive design

Requirements:
- Use shadcn/ui components
- Include Stripe integration
- Add proper authentication
- Include database schema with Prisma
- Add API routes for all features
- Include proper error handling
- Make it fully responsive
- Include comprehensive documentation

Return as complete project structure with all necessary files.`
      }
    };
  }

  listTemplates() {
    console.log('📋 Available Templates:');
    console.log('======================');
    
    Object.entries(this.templates).forEach(([key, template]) => {
      console.log(`\n🏷️  ${key}`);
      console.log(`📝 ${template.name}`);
      console.log(`📄 ${template.description}`);
    });
  }

  getTemplate(templateKey) {
    return this.templates[templateKey];
  }

  async createFromTemplate(templateKey, projectName) {
    const template = this.getTemplate(templateKey);
    if (!template) {
      throw new Error(`Template '${templateKey}' not found`);
    }

    console.log(`🚀 Creating project from template: ${template.name}`);
    
    // Import GLM generator
    const GLMProjectGenerator = require('./glm-generate');
    const generator = new GLMProjectGenerator();
    
    await generator.initialize();
    
    const projectInfo = {
      projectName,
      projectDesc: template.description,
      projectType: templateKey
    };

    const files = await generator.generateFromGLM({
      ...projectInfo,
      prompt: template.prompt
    });

    const projectPath = await generator.createFiles(files, projectName);
    await generator.installDependencies(projectPath);

    return projectPath;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const templates = new GLMTemplates();

  if (args.length === 0) {
    templates.listTemplates();
    process.exit(0);
  }

  const [command, templateKey, projectName] = args;

  switch (command) {
    case 'list':
      templates.listTemplates();
      break;
      
    case 'create':
      if (!templateKey || !projectName) {
        console.error('❌ Usage: node templates.js create <template-key> <project-name>');
        process.exit(1);
      }
      
      templates.createFromTemplate(templateKey, projectName)
        .then((projectPath) => {
          console.log(`🎉 Template project created: ${projectPath}`);
        })
        .catch((error) => {
          console.error('❌ Failed to create template:', error.message);
          process.exit(1);
        });
      break;
      
    default:
      console.error('❌ Unknown command:', command);
      console.log('Available commands: list, create');
      process.exit(1);
  }
}

