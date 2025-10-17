#!/usr/bin/env node

/**
 * GLM-4.6 Watch Mode
 * Watch for changes and auto-sync with GLM-4.6
 */

const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');
const readline = require('readline');

class GLMWatchMode {
  constructor() {
    this.workspacePath = process.cwd();
    this.zaiApiKey = process.env.ZAI_API_KEY;
    this.zaiBaseUrl = process.env.ZAI_BASE_URL || 'https://api.z.ai/v1';
    this.watchPatterns = [
      'src/**/*.tsx',
      'src/**/*.ts',
      'src/**/*.js',
      'src/**/*.jsx',
      'app/**/*.tsx',
      'app/**/*.ts',
      'components/**/*.tsx',
      'lib/**/*.ts',
      'hooks/**/*.ts'
    ];
    this.isRunning = false;
  }

  async initialize() {
    console.log('👀 GLM-4.6 Watch Mode');
    console.log('========================');
    
    if (!this.zaiApiKey) {
      console.error('❌ ZAI_API_KEY not found');
      process.exit(1);
    }

    // Check if chokidar is installed
    try {
      require('chokidar');
    } catch (error) {
      console.log('📦 Installing chokidar for file watching...');
      const { spawn } = require('child_process');
      await new Promise((resolve, reject) => {
        const npm = spawn('npm', ['install', 'chokidar'], { stdio: 'inherit' });
        npm.on('close', (code) => code === 0 ? resolve() : reject());
      });
    }

    console.log('✅ GLM Watch Mode initialized');
  }

  async getWatchMode() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

    console.log('\n👀 Watch Options:');
    console.log('1. Watch and auto-improve files');
    console.log('2. Watch and generate tests');
    console.log('3. Watch and generate documentation');
    console.log('4. Watch and optimize performance');
    console.log('5. Custom watch rules');

    const choice = await question('\nSelect watch mode (1-5): ');
    rl.close();

    return choice;
  }

  async startWatcher(mode) {
    console.log(`👀 Starting watch mode ${mode}...`);
    console.log('📁 Watching files:', this.watchPatterns.join(', '));
    console.log('⏹️  Press Ctrl+C to stop watching\n');

    this.isRunning = true;

    const watcher = chokidar.watch(this.watchPatterns, {
      ignored: /node_modules|\.next|dist|build/,
      persistent: true,
      ignoreInitial: true
    });

    watcher.on('change', async (filePath) => {
      if (!this.isRunning) return;
      
      console.log(`📝 File changed: ${filePath}`);
      await this.processFileChange(filePath, mode);
    });

    watcher.on('add', async (filePath) => {
      if (!this.isRunning) return;
      
      console.log(`➕ File added: ${filePath}`);
      await this.processFileAdd(filePath, mode);
    });

    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\n⏹️  Stopping watch mode...');
      this.isRunning = false;
      watcher.close();
      process.exit(0);
    });
  }

  async processFileChange(filePath, mode) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const relativePath = path.relative(this.workspacePath, filePath);

      switch (mode) {
        case '1':
          await this.improveFile(relativePath, content);
          break;
        case '2':
          await this.generateTest(relativePath, content);
          break;
        case '3':
          await this.generateDocumentation(relativePath, content);
          break;
        case '4':
          await this.optimizePerformance(relativePath, content);
          break;
        case '5':
          await this.customProcessing(relativePath, content);
          break;
      }
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
    }
  }

  async processFileAdd(filePath, mode) {
    // Similar to processFileChange but for new files
    await this.processFileChange(filePath, mode);
  }

  async improveFile(filePath, content) {
    console.log(`🔧 Improving ${filePath}...`);

    const prompt = `Improve this TypeScript/React file for better performance, readability, and maintainability:

File: ${filePath}
Content:
\`\`\`typescript
${content}
\`\`\`

Requirements:
- Fix any potential bugs or issues
- Improve performance
- Add better error handling
- Improve code readability
- Add missing TypeScript types
- Follow React best practices
- Add helpful comments where needed

Return only the improved code without explanations.`;

    try {
      const improvedContent = await this.callGLMAPI(prompt);
      await this.writeFile(filePath, improvedContent);
      console.log(`✅ Improved: ${filePath}`);
    } catch (error) {
      console.error(`❌ Failed to improve ${filePath}:`, error.message);
    }
  }

  async generateTest(filePath, content) {
    console.log(`🧪 Generating test for ${filePath}...`);

    const testPath = this.getTestPath(filePath);
    
    const prompt = `Generate comprehensive tests for this TypeScript/React file:

File: ${filePath}
Content:
\`\`\`typescript
${content}
\`\`\`

Requirements:
- Use Jest and React Testing Library
- Test all components and functions
- Include edge cases
- Test error handling
- Test loading states
- Use proper TypeScript types
- Follow testing best practices

Return the complete test file content.`;

    try {
      const testContent = await this.callGLMAPI(prompt);
      await this.writeFile(testPath, testContent);
      console.log(`✅ Test generated: ${testPath}`);
    } catch (error) {
      console.error(`❌ Failed to generate test for ${filePath}:`, error.message);
    }
  }

  async generateDocumentation(filePath, content) {
    console.log(`📚 Generating documentation for ${filePath}...`);

    const docPath = this.getDocPath(filePath);
    
    const prompt = `Generate comprehensive documentation for this TypeScript/React file:

File: ${filePath}
Content:
\`\`\`typescript
${content}
\`\`\`

Requirements:
- Generate JSDoc comments for all functions
- Create usage examples
- Document props and return types
- Explain complex logic
- Add troubleshooting tips
- Include best practices
- Format in Markdown

Return the complete documentation in Markdown format.`;

    try {
      const docContent = await this.callGLMAPI(prompt);
      await this.writeFile(docPath, docContent);
      console.log(`✅ Documentation generated: ${docPath}`);
    } catch (error) {
      console.error(`❌ Failed to generate documentation for ${filePath}:`, error.message);
    }
  }

  async optimizePerformance(filePath, content) {
    console.log(`⚡ Optimizing performance for ${filePath}...`);

    const prompt = `Optimize this TypeScript/React file for better performance:

File: ${filePath}
Content:
\`\`\`typescript
${content}
\`\`\`

Requirements:
- Identify and fix performance bottlenecks
- Add React.memo where appropriate
- Optimize re-renders
- Add useMemo and useCallback where needed
- Improve bundle size
- Add lazy loading if applicable
- Fix memory leaks
- Add performance monitoring

Return the optimized code with comments explaining changes.`;

    try {
      const optimizedContent = await this.callGLMAPI(prompt);
      await this.writeFile(filePath, optimizedContent);
      console.log(`✅ Optimized: ${filePath}`);
    } catch (error) {
      console.error(`❌ Failed to optimize ${filePath}:`, error.message);
    }
  }

  async customProcessing(filePath, content) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

    const customPrompt = await question(`💭 Enter custom processing for ${filePath}: `);
    rl.close();

    const fullPrompt = `${customPrompt}

File: ${filePath}
Content:
\`\`\`typescript
${content}
\`\`\`

Return the processed code.`;

    try {
      const processedContent = await this.callGLMAPI(fullPrompt);
      await this.writeFile(filePath, processedContent);
      console.log(`✅ Custom processing completed: ${filePath}`);
    } catch (error) {
      console.error(`❌ Failed custom processing for ${filePath}:`, error.message);
    }
  }

  getTestPath(filePath) {
    const dir = path.dirname(filePath);
    const name = path.basename(filePath, path.extname(filePath));
    return path.join(dir, `${name}.test.tsx`);
  }

  getDocPath(filePath) {
    const dir = path.dirname(filePath);
    const name = path.basename(filePath, path.extname(filePath));
    return path.join(dir, `${name}.md`);
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
            content: 'You are an expert TypeScript and React developer. Focus on code quality, performance, and best practices.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      throw new Error(`GLM API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async writeFile(filePath, content) {
    const fullPath = path.join(this.workspacePath, filePath);
    
    // Create backup
    if (await fs.pathExists(fullPath)) {
      const backupPath = `${fullPath}.backup.${Date.now()}`;
      await fs.copy(fullPath, backupPath);
    }

    // Extract code from response if it's in a code block
    const codeMatch = content.match(/```(?:typescript|javascript|tsx|jsx)?\n?([\s\S]*?)\n?```/);
    const cleanContent = codeMatch ? codeMatch[1] : content;

    await fs.writeFile(fullPath, cleanContent, 'utf8');
  }

  async run() {
    try {
      await this.initialize();
      
      const mode = await this.getWatchMode();
      await this.startWatcher(mode);
      
    } catch (error) {
      console.error('❌ Watch mode failed:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const watch = new GLMWatchMode();
  watch.run();
}

