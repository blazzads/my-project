#!/usr/bin/env node

/**
 * Quick Export Tool
 * Super simple way to export GLM-4.6 generated code
 * Just paste the response and get files!
 */

const fs = require('fs');
const path = require('path');

class QuickExport {
  constructor() {
    this.outputDir = './quick-export';
  }

  async init() {
    console.log('⚡ GLM-4.6 Quick Export');
    console.log('========================');
    console.log('Fastest way to export GLM code! 🚀\n');

    // Create output directory
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async getGLMResponse() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('📋 Paste your GLM-4.6 response below:');
    console.log('(Press Enter twice when done)\n');

    const lines = [];
    
    return new Promise((resolve) => {
      rl.on('line', (line) => {
        if (line === '' && lines.length > 0 && lines[lines.length - 1] === '') {
          rl.close();
          resolve(lines.join('\n').slice(0, -1)); // Remove last empty line
        } else {
          lines.push(line);
        }
      });
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

    // If no files found with paths, try to extract code blocks without paths
    if (files.length === 0) {
      const simpleCodeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      let fileIndex = 1;
      
      while ((match = simpleCodeBlockRegex.exec(response)) !== null) {
        const language = match[1] || 'text';
        const content = match[2].trim();
        
        // Guess file extension based on language
        const extensions = {
          'typescript': 'ts',
          'javascript': 'js',
          'tsx': 'tsx',
          'jsx': 'jsx',
          'python': 'py',
          'json': 'json',
          'css': 'css',
          'html': 'html',
          'markdown': 'md',
          'yaml': 'yaml',
          'yml': 'yml',
          'sql': 'sql',
          'prisma': 'prisma'
        };
        
        const ext = extensions[language] || 'txt';
        const fileName = `file-${fileIndex}.${ext}`;
        
        files.push({
          path: fileName,
          content: content,
          type: language
        });
        
        fileIndex++;
      }
    }

    return files;
  }

  async saveFiles(files) {
    console.log(`\n📁 Saving ${files.length} files...`);
    
    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      try {
        const filePath = path.join(this.outputDir, file.path);
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

    console.log(`\n📊 Results: ${successCount} files saved, ${errorCount} errors`);
    return successCount;
  }

  createSummary(files) {
    const summary = `# GLM-4.6 Export Summary

Generated on: ${new Date().toLocaleString()}
Total files: ${files.length}

## Files Created:

${files.map(file => `- **${file.path}** (${file.type})`).join('\n')}

## Usage:

1. Check the files in the \`./quick-export\` directory
2. Copy them to your project
3. Install dependencies if needed
4. Run your application

## Tips:

- Make sure to install required dependencies
- Check environment variables
- Test each component individually
- Follow the file structure for best results
`;

    fs.writeFileSync(path.join(this.outputDir, 'README.md'), summary);
    console.log('📄 Created: README.md with file summary');
  }

  async run() {
    try {
      await this.init();
      
      const response = await this.getGLMResponse();
      const files = this.parseFiles(response);
      
      if (files.length === 0) {
        console.log('❌ No code blocks found in response');
        console.log('Make sure your GLM response includes code blocks with ```');
        return;
      }

      const successCount = await this.saveFiles(files);
      this.createSummary(files);
      
      console.log(`\n🎉 Success! ${successCount} files exported to: ${this.outputDir}`);
      console.log('\n📁 Check the files:');
      files.forEach(file => {
        console.log(`   📄 ${file.path}`);
      });
      
      console.log('\n💡 Next steps:');
      console.log('   1. Review the exported files');
      console.log('   2. Copy them to your project');
      console.log('   3. Install dependencies: npm install');
      console.log('   4. Test your application');

    } catch (error) {
      console.error('\n❌ Error:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const exporter = new QuickExport();
  exporter.run();
}

module.exports = QuickExport;