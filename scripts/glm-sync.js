#!/usr/bin/env node

/**
 * GLM-4.6 File Synchronizer
 * Sync individual files or components from GLM-4.6
 */

const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');

class GLMFileSync {
  constructor() {
    this.workspacePath = process.cwd();
    this.zaiApiKey = process.env.ZAI_API_KEY;
    this.zaiBaseUrl = process.env.ZAI_BASE_URL || 'https://api.z.ai/v1';
  }

  async initialize() {
    console.log('🔄 GLM-4.6 File Synchronizer');
    console.log('==============================');
    
    if (!this.zaiApiKey) {
      console.error('❌ ZAI_API_KEY not found');
      process.exit(1);
    }

    console.log('✅ GLM Client initialized');
  }

  async getSyncMode() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

    console.log('\n📋 Sync Options:');
    console.log('1. Generate new component');
    console.log('2. Update existing file');
    console.log('3. Generate API route');
    console.log('4. Generate utility function');
    console.log('5. Generate database schema');
    console.log('6. Custom prompt');

    const choice = await question('\nSelect option (1-6): ');
    rl.close();

    return choice;
  }

  async getComponentInfo() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

    const componentName = await question('📝 Component name: ');
    const componentDesc = await question('📋 Component description: ');
    const componentType = await question('🏗️  Type (page/component/hook/util): ');

    rl.close();

    return { componentName, componentDesc, componentType };
  }

  async generateComponent(componentInfo) {
    console.log('🤖 Generating component with GLM-4.6...');

    const prompt = this.buildComponentPrompt(componentInfo);
    
    try {
      const response = await this.callGLMAPI(prompt);
      const files = this.parseGLMResponse(response);
      
      console.log(`📁 Found ${files.length} files to create`);
      return files;
    } catch (error) {
      console.error('❌ Failed to generate component:', error.message);
      throw error;
    }
  }

  buildComponentPrompt({ componentName, componentDesc, componentType }) {
    const prompts = {
      page: `Generate a Next.js 15 page component with the following details:
Name: ${componentName}
Description: ${componentDesc}

Requirements:
- Use TypeScript
- Use Tailwind CSS with shadcn/ui components
- Include proper metadata
- Add loading states
- Include error handling
- Make it responsive
- Add proper TypeScript types`,

      component: `Generate a React component with the following details:
Name: ${componentName}
Description: ${componentDesc}

Requirements:
- Use TypeScript
- Use Tailwind CSS with shadcn/ui components
- Include proper props interface
- Add loading states
- Include error handling
- Make it reusable
- Add proper TypeScript types`,

      hook: `Generate a custom React hook with the following details:
Name: ${componentName}
Description: ${componentDesc}

Requirements:
- Use TypeScript
- Include proper types
- Add error handling
- Include loading states
- Make it reusable
- Add JSDoc comments`,

      util: `Generate a utility function/module with the following details:
Name: ${componentName}
Description: ${componentDesc}

Requirements:
- Use TypeScript
- Include proper types
- Add error handling
- Make it reusable
- Add JSDoc comments
- Include examples`
    };

    const basePrompt = prompts[componentType] || prompts.component;

    return `${basePrompt}

Return the response in this format:
{
  "files": [
    {
      "path": "src/components/${componentName}.tsx",
      "content": "// File content here",
      "type": "typescript"
    }
  ]
}

Make sure all file paths are correct and the content is production-ready.`;
  }

  async callGLMAPI(prompt) {
    const fetch = require('node-fetch');
    
    const response = await fetch(`${this.zaiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.zaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'glm-4.6',
        messages: [
          {
            role: 'system',
            content: 'You are an expert Next.js 15 and React developer. Generate clean, production-ready code following best practices.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      throw new Error(`GLM API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  parseGLMResponse(response) {
    try {
      // Try to parse as JSON first
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.files || [];
      }

      // Fallback: parse code blocks
      const codeBlockRegex = /```(\w+)?[:\s]*([\w\/\.]+)\n?([\s\S]*?)```/g;
      const files = [];
      let match;

      while ((match = codeBlockRegex.exec(response)) !== null) {
        const language = match[1] || 'text';
        const filePath = match[2] || `file-${files.length}.${language}`;
        const content = match[3].trim();

        files.push({
          path: filePath,
          content,
          type: language
        });
      }

      return files;
    } catch (error) {
      console.error('❌ Failed to parse GLM response:', error.message);
      return [];
    }
  }

  async syncFiles(files) {
    console.log('📁 Syncing files...');

    for (const file of files) {
      const filePath = path.join(this.workspacePath, file.path);
      const dir = path.dirname(filePath);

      // Create directory if it doesn't exist
      await fs.ensureDir(dir);

      // Check if file exists
      const fileExists = await fs.pathExists(filePath);
      
      if (fileExists) {
        // Create backup
        const backupPath = `${filePath}.backup.${Date.now()}`;
        await fs.copy(filePath, backupPath);
        console.log(`💾 Backup created: ${path.basename(backupPath)}`);
      }

      // Write file
      await fs.writeFile(filePath, file.content, 'utf8');
      console.log(`✅ ${fileExists ? 'Updated' : 'Created'}: ${file.path}`);
    }

    // Format files
    await this.formatFiles(files);
  }

  async formatFiles(files) {
    console.log('🎨 Formatting files...');

    for (const file of files) {
      if (file.type === 'typescript' || file.type === 'javascript') {
        const filePath = path.join(this.workspacePath, file.path);
        
        try {
          // Run prettier
          const { spawn } = require('child_process');
          await new Promise((resolve, reject) => {
            const prettier = spawn('npx', ['prettier', '--write', filePath], {
              stdio: 'pipe'
            });
            
            prettier.on('close', (code) => {
              if (code === 0) {
                console.log(`🎨 Formatted: ${file.path}`);
                resolve();
              } else {
                reject(new Error(`Prettier failed for ${file.path}`));
              }
            });
          });
        } catch (error) {
          console.log(`⚠️  Could not format ${file.path}: ${error.message}`);
        }
      }
    }
  }

  async run() {
    try {
      await this.initialize();
      
      const mode = await this.getSyncMode();
      
      switch (mode) {
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
          const componentInfo = await this.getComponentInfo();
          const files = await this.generateComponent(componentInfo);
          await this.syncFiles(files);
          break;
          
        case '6':
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          const customPrompt = await new Promise(resolve => 
            rl.question('📝 Enter your custom prompt: ', resolve)
          );
          
          rl.close();
          
          const customResponse = await this.callGLMAPI(customPrompt);
          const customFiles = this.parseGLMResponse(customResponse);
          await this.syncFiles(customFiles);
          break;
          
        default:
          console.log('❌ Invalid option');
          return;
      }

      console.log('🎉 Files synced successfully!');
      
    } catch (error) {
      console.error('❌ Sync failed:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const sync = new GLMFileSync();
  sync.run();
}

module.exports = GLMFileSync;