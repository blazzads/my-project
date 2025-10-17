#!/usr/bin/env node

/**
 * GLM-4.6 Project Generator
 * Generate complete Next.js projects from GLM-4.6 responses
 */

const fs = require("fs-extra");
const path = require("path");
const readline = require("readline");

class GLMProjectGenerator {
  constructor() {
    this.workspacePath = process.cwd();
    this.zaiApiKey = process.env.ZAI_API_KEY;
    this.zaiBaseUrl =
      process.env.ZAI_BASE_URL || "https://api.z.ai/api/paas/v4";
  }

  async initialize() {
    console.log("🚀 GLM-4.6 Project Generator");
    console.log("================================");

    if (!this.zaiApiKey) {
      console.error("❌ ZAI_API_KEY not found in environment variables");
      console.log("Please set ZAI_API_KEY in your .env file");
      process.exit(1);
    }

    console.log("✅ GLM Client initialized");
  }

  async getUserInput() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (prompt) =>
      new Promise((resolve) => rl.question(prompt, resolve));

    const projectName = await question("📝 Project name: ");
    const projectDesc = await question("📋 Project description: ");
    const projectType = await question("🏗️  Project type (web/app/api): ");

    rl.close();

    return { projectName, projectDesc, projectType };
  }

  async generateFromGLM(projectInfo) {
    console.log("🤖 Generating project with GLM-4.6...");

    const prompt = this.buildPrompt(projectInfo);

    try {
      const response = await this.callGLMAPI(prompt);
      const files = this.parseGLMResponse(response);

      console.log(`📁 Found ${files.length} files to create`);
      return files;
    } catch (error) {
      console.error("❌ Failed to generate from GLM:", error.message);
      throw error;
    }
  }

  buildPrompt({ projectName, projectDesc, projectType }) {
    return `Generate a complete Next.js 15 project with the following specifications:

Project Name: ${projectName}
Description: ${projectDesc}
Type: ${projectType}

Requirements:
- Use TypeScript
- Use Tailwind CSS with shadcn/ui components
- Include proper error handling
- Add loading states
- Include environment configuration
- Add database schema with Prisma (if needed)
- Include API routes (if needed)
- Add proper TypeScript types
- Include README.md with setup instructions

Return the response in this exact JSON format:
{
  "files": [
    {
      "path": "src/app/page.tsx",
      "content": "// File content here",
      "type": "typescript"
    },
    {
      "path": "package.json",
      "content": "// Package.json content",
      "type": "json"
    }
  ]
}

Make sure all file paths are correct and the content is production-ready.`;
  }

  async callGLMAPI(prompt) {
    const fetch = require("node-fetch");

    const response = await fetch(`${this.zaiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.zaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "glm-4.6",
        messages: [
          {
            role: "system",
            content:
              "You are an expert Next.js 15 developer. Generate complete, production-ready projects with proper structure and best practices.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `GLM API Error: ${response.status} ${response.statusText}`,
      );
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
        const language = match[1] || "text";
        const filePath = match[2] || `file-${files.length}.${language}`;
        const content = match[3].trim();

        files.push({
          path: filePath,
          content,
          type: language,
        });
      }

      return files;
    } catch (error) {
      console.error("❌ Failed to parse GLM response:", error.message);
      return [];
    }
  }

  async createFiles(files, projectName) {
    console.log("📁 Creating files...");

    const projectPath = path.join(this.workspacePath, projectName);

    // Create project directory
    await fs.ensureDir(projectPath);

    for (const file of files) {
      const filePath = path.join(projectPath, file.path);
      const dir = path.dirname(filePath);

      // Create directory if it doesn't exist
      await fs.ensureDir(dir);

      // Write file
      await fs.writeFile(filePath, file.content, "utf8");
      console.log(`✅ Created: ${file.path}`);
    }

    return projectPath;
  }

  async installDependencies(projectPath) {
    console.log("📦 Installing dependencies...");

    const { spawn } = require("child_process");

    return new Promise((resolve, reject) => {
      const npm = spawn("npm", ["install"], {
        cwd: projectPath,
        stdio: "inherit",
      });

      npm.on("close", (code) => {
        if (code === 0) {
          console.log("✅ Dependencies installed");
          resolve();
        } else {
          reject(new Error(`npm install failed with code ${code}`));
        }
      });
    });
  }

  async run() {
    try {
      await this.initialize();

      const projectInfo = await this.getUserInput();
      const files = await this.generateFromGLM(projectInfo);

      if (files.length === 0) {
        console.log("❌ No files generated");
        return;
      }

      const projectPath = await this.createFiles(
        files,
        projectInfo.projectName,
      );
      await this.installDependencies(projectPath);

      console.log("🎉 Project generated successfully!");
      console.log(`📁 Location: ${projectPath}`);
      console.log("🚀 Next steps:");
      console.log(`   cd ${projectInfo.projectName}`);
      console.log("   npm run dev");
    } catch (error) {
      console.error("❌ Generation failed:", error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const generator = new GLMProjectGenerator();
  generator.run();
}

module.exports = GLMProjectGenerator;
