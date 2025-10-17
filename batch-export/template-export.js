#!/usr/bin/env node

/**
 * Template Export Tool
 * Export from predefined templates for common projects
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

class TemplateExport {
  constructor() {
    this.apiKey = process.env.ZAI_API_KEY;
    this.baseUrl = 'https://api.z.ai/v1';
    this.outputDir = './template-export';
    this.templates = {
      'proposal-app': {
        name: 'Strategic Proposal App',
        description: 'Complete proposal management system',
        files: [
          'package.json',
          'src/app/page.tsx',
          'src/app/layout.tsx',
          'src/components/ProposalCard.tsx',
          'src/components/ProposalForm.tsx',
          'src/components/ui/button.tsx',
          'src/components/ui/card.tsx',
          'src/components/ui/input.tsx',
          'src/components/ui/textarea.tsx',
          'src/lib/glm-client.ts',
          'src/app/api/proposals/route.ts',
          'src/app/api/glm/route.ts',
          'src/types/proposal.ts',
          'tailwind.config.js',
          'next.config.js',
          'tsconfig.json',
          '.env.local.example',
          'README.md'
        ]
      },
      'dashboard': {
        name: 'Admin Dashboard',
        description: 'Modern admin dashboard with analytics',
        files: [
          'package.json',
          'src/app/page.tsx',
          'src/app/layout.tsx',
          'src/components/Dashboard.tsx',
          'src/components/Sidebar.tsx',
          'src/components/Analytics.tsx',
          'src/components/ui/button.tsx',
          'src/components/ui/card.tsx',
          'src/lib/glm-client.ts',
          'src/app/api/analytics/route.ts',
          'src/app/api/glm/route.ts',
          'src/types/dashboard.ts',
          'tailwind.config.js',
          'next.config.js',
          'tsconfig.json',
          '.env.local.example',
          'README.md'
        ]
      },
      'blog': {
        name: 'Blog Platform',
        description: 'Modern blog with markdown support',
        files: [
          'package.json',
          'src/app/page.tsx',
          'src/app/layout.tsx',
          'src/components/BlogPost.tsx',
          'src/components/BlogList.tsx',
          'src/components/ui/button.tsx',
          'src/components/ui/card.tsx',
          'src/lib/glm-client.ts',
          'src/lib/markdown.ts',
          'src/app/api/posts/route.ts',
          'src/app/api/glm/route.ts',
          'src/types/blog.ts',
          'tailwind.config.js',
          'next.config.js',
          'tsconfig.json',
          '.env.local.example',
          'README.md'
        ]
      }
    };
  }

  async init() {
    console.log('📋 GLM-4.6 Template Export');
    console.log('==============================');
    console.log('Export from professional templates! 🎯\n');

    if (!this.apiKey) {
      console.error('❌ ZAI_API_KEY not found');
      console.log('Set your API key: export ZAI_API_KEY=your_key');
      process.exit(1);
    }

    console.log('✅ API Key found');
  }

  showTemplates() {
    console.log('\n📋 Available Templates:');
    console.log('========================');
    
    Object.entries(this.templates).forEach(([key, template]) => {
      console.log(`\n🏷️  ${key}`);
      console.log(`📝 ${template.name}`);
      console.log(`📄 ${template.description}`);
      console.log(`📁 ${template.files.length} files included`);
    });
  }

  async selectTemplate() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

    this.showTemplates();
    
    const templateKey = await question('\n🎯 Select template (proposal-app/dashboard/blog): ');
    const projectName = await question('📝 Project name: ');
    
    rl.close();

    return { templateKey, projectName };
  }

  buildTemplatePrompt(templateKey, projectName) {
    const template = this.templates[templateKey];
    if (!template) {
      throw new Error(`Template '${templateKey}' not found`);
    }

    return `Generate a complete ${template.name} with the following specifications:

Project Name: ${projectName}
Description: ${template.description}

Generate ALL these files with complete, production-ready code:

${template.files.map(file => `- ${file}`).join('\n')}

Requirements:
- Use TypeScript
- Use Tailwind CSS with shadcn/ui components
- Include GLM-4.6 API integration
- Add proper error handling and loading states
- Include TypeScript interfaces and types
- Make it fully responsive
- Add comprehensive comments
- Include proper imports and exports
- Make it production-ready

Return each file in this exact format:
\`\`\`language:file/path
[complete file content here]
\`\`\`

Make sure to include ALL files listed above with complete, working code.`;
  }

  async callGLMAPI(prompt) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        model: 'glm-4.6',
        messages: [
          {
            role: 'system',
            content: 'You are an expert Next.js 15 developer. Generate complete, production-ready projects. Always return ALL files requested with proper file paths and complete content.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 8192
      });

      const options = {
        hostname: 'api.z.ai',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            resolve(parsed.choices[0].message.content);
          } catch (error) {
            reject(new Error('Failed to parse API response'));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }

  parseFiles(response) {
    const files = [];
    
    // Pattern to match code blocks with file paths
    const codeBlockRegex = /```(\w+)?[:\s]*([^\s\n]+\.[^\s\n]+)\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || 'text';
      const filePath = match[2];
      const content = match[3].trim();

      files.push({
        path: filePath,
        content: content,
        type: language
      });
    }

    return files;
  }

  async createFiles(files, projectName) {
    console.log(`\n📁 Creating ${files.length} files...`);
    
    const projectPath = path.join(this.outputDir, projectName);
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }

    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      try {
        const filePath = path.join(projectPath, file.path);
        const dir = path.dirname(filePath);

        // Create directory if it doesn't exist
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Write file
        fs.writeFileSync(filePath, file.content, 'utf8');
        console.log(`✅ ${file.path}`);
        successCount++;
      } catch (error) {
        console.error(`❌ ${file.path}: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n📊 Results: ${successCount} files created, ${errorCount} errors`);
    return projectPath;
  }

  createSetupScript(projectPath, projectName) {
    const setupScript = `#!/bin/bash
echo "🚀 Setting up ${projectName}..."
echo "================================"

cd "${projectPath}"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env.local
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local..."
    cat > .env.local << EOF
ZAI_API_KEY=your_api_key_here
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
EOF
fi

# Setup database if Prisma exists
if [ -f "prisma/schema.prisma" ]; then
    echo "🗄️  Setting up database..."
    npx prisma generate
    npx prisma db push
fi

echo "✅ Setup complete!"
echo ""
echo "🚀 Start your application:"
echo "   npm run dev"
echo ""
echo "📝 Don't forget to add your ZAI_API_KEY to .env.local"
`;

    const scriptPath = path.join(projectPath, 'setup.sh');
    fs.writeFileSync(scriptPath, setupScript);
    
    try {
      fs.chmodSync(scriptPath, '755');
    } catch (error) {
      console.log('⚠️  Could not make setup script executable');
    }
  }

  async run() {
    try {
      await this.init();
      
      const { templateKey, projectName } = await this.selectTemplate();
      
      console.log(`\n🤖 Generating ${templateKey} template...`);
      console.log('This may take 30-60 seconds...\n');
      
      const prompt = this.buildTemplatePrompt(templateKey, projectName);
      const response = await this.callGLMAPI(prompt);
      const files = this.parseFiles(response);
      
      if (files.length === 0) {
        console.log('❌ No files found in response');
        return;
      }

      const projectPath = await this.createFiles(files, projectName);
      this.createSetupScript(projectPath, projectName);
      
      console.log(`\n🎉 Template exported to: ${projectPath}`);
      console.log('\n🚀 Quick start:');
      console.log(`   cd ${projectPath}`);
      console.log('   ./setup.sh');
      console.log('   npm run dev');

    } catch (error) {
      console.error('\n❌ Error:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const exporter = new TemplateExport();
  exporter.run();
}

module.exports = TemplateExport;