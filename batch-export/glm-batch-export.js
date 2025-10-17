#!/usr/bin/env node
require("dotenv").config();

/**
 * GLM-4.6 Batch Export Tool
 * Generate and export multiple files at once from GLM-4.6
 * Perfect for beginners - no complex setup needed!
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

class GLMBatchExport {
  constructor() {
    this.apiKey = process.env.ZAI_API_KEY;
    this.baseUrl = "https://api.z.ai/api/paas/v4";
    this.outputDir = "./glm-export";
  }

  async init() {
    console.log("🚀 GLM-4.6 Batch Export Tool");
    console.log("================================");
    console.log("Perfect for beginners! 🎯\n");

    if (!this.apiKey) {
      console.error("❌ ZAI_API_KEY not found in environment variables");
      console.log("Please set your ZAI API key:");
      console.log("export ZAI_API_KEY=your_api_key_here");
      process.exit(1);
    }

    console.log("✅ API Key found");
    console.log("📁 Output directory:", this.outputDir);
  }

  async getProjectInfo() {
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (prompt) =>
      new Promise((resolve) => rl.question(prompt, resolve));

    console.log("\n📋 Project Information:");

    const projectName = await question("📝 Project name (e.g., my-app): ");
    const projectDesc = await question(
      "📄 Project description (e.g., Todo app with Next.js): ",
    );

    console.log("\n🏗️  What do you want to generate?");
    console.log("1. Complete Next.js project");
    console.log("2. React components only");
    console.log("3. API routes only");
    console.log("4. Database schema only");
    console.log("5. Custom request");

    const choice = await question("\nSelect option (1-5): ");

    rl.close();

    return { projectName, projectDesc, choice };
  }

  buildPrompt(projectInfo) {
    const { projectName, projectDesc, choice } = projectInfo;

    const prompts = {
      1: `Generate a complete Next.js 15 project called "${projectName}" with the following description: ${projectDesc}

Include ALL these files:
- package.json with all dependencies
- src/app/page.tsx (main page)
- src/app/layout.tsx (root layout)
- src/components/ui/button.tsx
- src/components/ui/card.tsx
- src/lib/glm-client.ts (GLM-4.6 integration)
- src/app/api/glm/route.ts (API route)
- tailwind.config.js
- next.config.js
- tsconfig.json
- .env.local.example
- README.md with setup instructions

Requirements:
- Use TypeScript
- Use Tailwind CSS
- Include GLM-4.6 API integration
- Add proper error handling
- Make it production-ready
- Include installation instructions

Return the response in this format:
\`\`\`json:package.json
{
  "name": "${projectName}",
  "version": "0.1.0",
  ...
}
\`\`\`

\`\`\`typescript:src/app/page.tsx
import { Button } from '@/components/ui/button';
export default function Home() {
  return (
    <main>
      <h1>${projectDesc}</h1>
      <Button>Click me</Button>
    </main>
  );
}
\`\`\`

[Continue with all other files...]`,

      2: `Generate React components for: ${projectDesc}

Include these components:
- src/components/${projectName}Card.tsx
- src/components/${projectName}List.tsx
- src/components/${projectName}Form.tsx
- src/components/ui/button.tsx
- src/components/ui/card.tsx
- src/components/ui/input.tsx

Requirements:
- Use TypeScript
- Use Tailwind CSS
- Include proper props interfaces
- Add loading states
- Make components reusable

Return each file in format: \`\`\`typescript:src/components/FileName.tsx\`\`\``,

      3: `Generate API routes for: ${projectDesc}

Include these routes:
- src/app/api/${projectName}/route.ts
- src/app/api/${projectName}/[id]/route.ts
- src/app/api/glm/route.ts (GLM-4.6 integration)

Requirements:
- Use TypeScript
- Include proper error handling
- Add request validation
- Include response types
- Add rate limiting

Return each file in format: \`\`\`typescript:src/app/api/.../route.ts\`\`\``,

      4: `Generate database schema for: ${projectDesc}

Include these files:
- prisma/schema.prisma
- src/lib/db.ts
- scripts/seed.ts

Requirements:
- Use Prisma ORM
- Include proper relationships
- Add indexes for performance
- Include seed data
- Add TypeScript types

Return each file in format: \`\`\`prisma:prisma/schema.prisma\`\`\``,

      5: `Custom request for: ${projectDesc}

Generate the files you think are most appropriate for this project.
Include all necessary files for a complete, working application.

Return each file in format: \`\`\`language:file/path\`\`\``,
    };

    return prompts[choice] || prompts["5"];
  }

  async callGLMAPI(prompt) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        model: "glm-4.6",
        messages: [
          {
            role: "system",
            content:
              "You are an expert Next.js 15 developer. Generate complete, production-ready projects. Always return ALL files requested with proper file paths and complete content.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 8192,
      });

      const options = {
        hostname: "api.z.ai",
        port: 443,
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": data.length,
        },
      };

      const req = https.request(options, (res) => {
        let responseData = "";

        res.on("data", (chunk) => {
          responseData += chunk;
        });

        res.on("end", () => {
          try {
            const parsed = JSON.parse(responseData);
            resolve(parsed.choices[0].message.content);
          } catch (error) {
            reject(new Error("Failed to parse API response"));
          }
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }

  parseFilesFromResponse(response) {
    const files = [];

    // Pattern to match code blocks with file paths
    const codeBlockRegex =
      /```(\w+)?[:\s]*([^\s\n]+\.[^\s\n]+)\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || "text";
      const filePath = match[2];
      const content = match[3].trim();

      files.push({
        path: filePath,
        content: content,
        type: language,
      });
    }

    // Fallback: try to extract JSON and files
    if (files.length === 0) {
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.files) {
            return parsed.files;
          }
        }
      } catch (error) {
        console.log("⚠️  Could not parse JSON from response");
      }
    }

    return files;
  }

  async createFiles(files, projectName) {
    console.log(`\n📁 Creating ${files.length} files...`);

    // Create output directory
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
        fs.writeFileSync(filePath, file.content, "utf8");
        console.log(`✅ ${file.path}`);
        successCount++;
      } catch (error) {
        console.error(`❌ ${file.path}: ${error.message}`);
        errorCount++;
      }
    }

    console.log(
      `\n📊 Results: ${successCount} files created, ${errorCount} errors`,
    );
    return projectPath;
  }

  createInstallScript(projectPath, projectName) {
    const installScript = `#!/bin/bash
echo "🚀 Installing ${projectName}..."
echo "================================"

# Navigate to project directory
cd "${projectPath}"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env file
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local file..."
    echo "ZAI_API_KEY=your_api_key_here" > .env.local
    echo "DATABASE_URL=postgresql://user:password@localhost:5432/${projectName}" >> .env.local
    echo "NEXTAUTH_URL=http://localhost:3000" >> .env.local
    echo "NEXTAUTH_SECRET=your-secret-key" >> .env.local
fi

# Setup database if Prisma exists
if [ -f "prisma/schema.prisma" ]; then
    echo "🗄️  Setting up database..."
    npx prisma generate
    npx prisma db push
fi

echo "✅ Setup complete!"
echo ""
echo "🚀 Next steps:"
echo "   cd ${projectPath}"
echo "   npm run dev"
echo ""
echo "📝 Don't forget to:"
echo "   1. Add your ZAI_API_KEY to .env.local"
echo "   2. Setup your database if needed"
echo "   3. Configure any other environment variables"
`;

    const scriptPath = path.join(projectPath, "install.sh");
    fs.writeFileSync(scriptPath, installScript);

    // Make script executable
    try {
      fs.chmodSync(scriptPath, "755");
    } catch (error) {
      console.log("⚠️  Could not make install script executable");
    }
  }

  async run() {
    try {
      await this.init();

      const projectInfo = await this.getProjectInfo();
      const prompt = this.buildPrompt(projectInfo);

      console.log("\n🤖 Calling GLM-4.6 API...");
      console.log("This may take 30-60 seconds...\n");

      const response = await this.callGLMAPI(prompt);
      const files = this.parseFilesFromResponse(response);

      if (files.length === 0) {
        console.log("❌ No files found in response");
        console.log("Please try again or check your API key");
        return;
      }

      console.log(`📁 Found ${files.length} files to create`);

      const projectPath = await this.createFiles(
        files,
        projectInfo.projectName,
      );
      this.createInstallScript(projectPath, projectInfo.projectName);

      console.log(`\n🎉 Success! Project exported to: ${projectPath}`);
      console.log("\n🚀 Quick start:");
      console.log(`   cd ${projectPath}`);
      console.log("   ./install.sh");
      console.log("   npm run dev");

      console.log("\n📁 Files created:");
      files.forEach((file) => {
        console.log(`   ✅ ${file.path}`);
      });
    } catch (error) {
      console.error("\n❌ Error:", error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const exporter = new GLMBatchExport();
  exporter.run();
}

module.exports = GLMBatchExport;
